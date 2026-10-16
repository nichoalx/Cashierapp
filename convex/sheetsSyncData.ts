import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";

type StockSnapshot = Doc<"stockSnapshots">;

function latestSnapshotsByKey(snapshots: StockSnapshot[]) {
  const latest = new Map<string, StockSnapshot>();
  for (const snapshot of snapshots) {
    const key = `${snapshot.date}::${snapshot.productId}::${snapshot.variantId ?? ""}`;
    const existing = latest.get(key);
    const snapshotTime = snapshot._creationTime ?? snapshot.timestamp;
    const existingTime = existing?._creationTime ?? existing?.timestamp ?? 0;
    if (!existing || snapshotTime > existingTime) {
      latest.set(key, snapshot);
    }
  }
  return [...latest.values()];
}

function previousDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 1, day));
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}

/** Today's date in the shop's timezone, "YYYY-MM-DD". */
function jakartaToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

const stockKey = (s: { productId: Id<"products">; variantId?: Id<"productVariants"> }) =>
  `${s.productId}::${s.variantId ?? ""}`;

// Internal data helpers for the Sheets sync action.
// Lives outside `sheetsSync.ts` because that file uses the Node.js runtime,
// which only permits action definitions — queries/mutations must be in V8-runtime files.

/**
 * Snapshot today's stock for every product/variant that has no snapshot row
 * today yet, so manual fixes (setSnapshotQuantity) are preserved. Runs at
 * 23:55 WIB from crons.ts to capture closing stock.
 */
export const takeSnapshotIfMissing = internalMutation({
  args: {},
  handler: async (ctx) => {
    const date = jakartaToday();

    const existing = await ctx.db
      .query("stockSnapshots")
      .withIndex("by_date", q => q.eq("date", date))
      .collect();
    const haveKey = new Set(existing.map(stockKey));

    const stockRows = await ctx.db.query("stock").collect();
    const now = Date.now();
    let created = 0;
    for (const s of stockRows) {
      if (haveKey.has(stockKey(s))) continue;
      await ctx.db.insert("stockSnapshots", {
        date,
        productId: s.productId,
        variantId: s.variantId,
        quantity: s.quantity,
        timestamp: now,
      });
      created++;
    }
    return { created, date };
  },
});

/**
 * Deprecated no-op: older app builds call this on every view of today's log.
 * Kept only so devices still on an old build don't error until they update.
 * It deliberately writes nothing — rows written mid-day would stop the 23:55
 * closing snapshot from filling those products. Delete once every device runs
 * the new build.
 */
export const takeSnapshotNow = mutation({
  args: {},
  handler: async () => jakartaToday(),
});

// ─── Monthly tab data ────────────────────────────────────────────────────────
// A single query may make at most 4,096 index reads and scan 32,000 documents.
// One query over a busy month (~1,500 orders, a db.get per item and member,
// plus every payment in history) blew past both. loadMonthData instead stitches
// together small queries: the month's orders and the whole-history ledger are
// read in pages, and small tables are loaded once into maps.

const MONTH_TX_PAGE = 300;
const LEDGER_PAGE = 2000;

function monthBounds(yearMonth: string) {
  return { start: `${yearMonth}-01`, end: `${yearMonth}-31` };
}

type Page<T> = { rows: T[]; continueCursor: string; isDone: boolean };

async function collectPages<T>(fetchPage: (cursor: string | null) => Promise<Page<T>>): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | null = null;
  for (;;) {
    const page = await fetchPage(cursor);
    rows.push(...page.rows);
    if (page.isDone) return rows;
    cursor = page.continueCursor;
  }
}

type TxDetail = {
  date: string;
  orderNumber: number;
  timestamp: number;
  totalAmount: number;
  amountPaid: number;
  discount: number;
  remarks: string;
  memberName: string;
  items: Array<{ productName: string; quantity: number; unit: string; unitPrice: number; totalAmount: number }>;
};

type LedgerTx = {
  _id: Id<"transactions">;
  date: string;
  orderNumber: number;
  totalAmount: number;
  amountPaid?: number;
  memberId?: Id<"members">;
};

type LedgerPayment = Pick<Doc<"payments">, "_id" | "transactionId" | "date" | "amount" | "timestamp">;

type SnapshotRow = {
  date: string;
  productId: Id<"products">;
  variantId?: Id<"productVariants">;
  quantity: number;
};

type ProductInfo = {
  productId: Id<"products">;
  variantId?: Id<"productVariants">;
  label: string;
  unit: string;
  sortKey: string;
};

type PaymentDetail = {
  transactionId: Id<"transactions">;
  orderNumber: number;
  txDate: string;
  memberName: string;
  txTotal: number;
  amountPaid: number;
  paymentDate: string;
  amount: number;
  balance: number;
  isOpeningBalance: boolean;
};

type MonthData = {
  txDetails: TxDetail[];
  snapshots: SnapshotRow[];
  prevMonthSnapshots: SnapshotRow[];
  productInfo: ProductInfo[];
  paymentDetails: PaymentDetail[];
  priceHistory: Doc<"priceHistory">[];
  currentPrices: Doc<"prices">[];
  priceProducts: Array<{ productId: Id<"products">; label: string }>;
};

/** One page of a month's orders with item, product and member names resolved. */
export const getMonthTxPage = internalQuery({
  args: { yearMonth: v.string(), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args): Promise<Page<TxDetail>> => {
    const { start, end } = monthBounds(args.yearMonth);
    const result = await ctx.db
      .query("transactions")
      .withIndex("by_date", q => q.gte("date", start).lte("date", end))
      .paginate({ cursor: args.cursor, numItems: MONTH_TX_PAGE });

    // Small tables: load once instead of a db.get per item / per order.
    const products = new Map((await ctx.db.query("products").collect()).map(p => [p._id, p]));
    const variants = new Map((await ctx.db.query("productVariants").collect()).map(pv => [pv._id, pv]));
    const members = new Map((await ctx.db.query("members").collect()).map(m => [m._id, m]));

    const rows = await Promise.all(result.page.map(async (tx) => {
      const items = await ctx.db
        .query("transactionItems")
        .withIndex("by_transactionId", q => q.eq("transactionId", tx._id))
        .collect();
      return {
        date: tx.date,
        orderNumber: tx.orderNumber,
        timestamp: tx.timestamp,
        totalAmount: tx.totalAmount,
        amountPaid: tx.amountPaid ?? tx.totalAmount,
        discount: tx.discount ?? 0,
        remarks: tx.remarks ?? "",
        memberName: tx.memberId ? members.get(tx.memberId)?.name ?? "" : "",
        items: items.map(item => {
          const product = products.get(item.productId);
          const variant = item.variantId ? variants.get(item.variantId) : undefined;
          return {
            productName: variant
              ? `${product?.fullName ?? "?"} ${variant.variantValue}`
              : (product?.fullName ?? "?"),
            quantity: item.quantity,
            unit: product?.unit ?? "pcs",
            unitPrice: item.unitPrice,
            totalAmount: item.totalAmount,
          };
        }),
      };
    }));
    return { rows, continueCursor: result.continueCursor, isDone: result.isDone };
  },
});

/** One page of every transaction (oldest first), slimmed to what the payment ledger needs. */
export const getLedgerTxPage = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args): Promise<Page<LedgerTx>> => {
    const result = await ctx.db.query("transactions").paginate({ cursor: args.cursor, numItems: LEDGER_PAGE });
    const rows = result.page.map(tx => ({
      _id: tx._id,
      date: tx.date,
      orderNumber: tx.orderNumber,
      totalAmount: tx.totalAmount,
      amountPaid: tx.amountPaid,
      memberId: tx.memberId,
    }));
    return { rows, continueCursor: result.continueCursor, isDone: result.isDone };
  },
});

/** One page of every payment (oldest first). */
export const getLedgerPaymentPage = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args): Promise<Page<LedgerPayment>> => {
    const result = await ctx.db.query("payments").paginate({ cursor: args.cursor, numItems: LEDGER_PAGE });
    const rows = result.page.map(p => ({
      _id: p._id,
      transactionId: p.transactionId,
      date: p.date,
      amount: p.amount,
      timestamp: p.timestamp,
    }));
    return { rows, continueCursor: result.continueCursor, isDone: result.isDone };
  },
});

/** Stock snapshots, product layout, prices and member names for a monthly tab. */
export const getMonthStatic = internalQuery({
  args: { yearMonth: v.string() },
  handler: async (ctx, args) => {
    const { start, end } = monthBounds(args.yearMonth);
    const toRow = (s: StockSnapshot): SnapshotRow => ({
      date: s.date, productId: s.productId, variantId: s.variantId, quantity: s.quantity,
    });

    const snapshots = latestSnapshotsByKey(await ctx.db
      .query("stockSnapshots")
      .withIndex("by_date", q => q.gte("date", start).lte("date", end))
      .collect()).map(toRow);

    // Today's closing snapshot is only written at 23:55 WIB (crons.ts). Until
    // then, show each product's live stock level as today's amount.
    const today = jakartaToday();
    if (today >= start && today <= end) {
      const haveKey = new Set(snapshots.filter(s => s.date === today).map(stockKey));
      for (const s of await ctx.db.query("stock").collect()) {
        if (haveKey.has(stockKey(s))) continue;
        snapshots.push({ date: today, productId: s.productId, variantId: s.variantId, quantity: s.quantity });
      }
    }

    // Most recent snapshot date before this month — the delta baseline for its
    // first date. Prefers the calendar day right before the 1st when present.
    const previousCalendarDate = previousDate(start);
    const onPreviousCalendarDate = await ctx.db
      .query("stockSnapshots")
      .withIndex("by_date", q => q.eq("date", previousCalendarDate))
      .first();
    const latestPrevDate = onPreviousCalendarDate
      ? previousCalendarDate
      : (await ctx.db
          .query("stockSnapshots")
          .withIndex("by_date", q => q.lt("date", start))
          .order("desc")
          .first())?.date ?? null;
    const prevMonthSnapshots = latestPrevDate
      ? latestSnapshotsByKey(await ctx.db
          .query("stockSnapshots")
          .withIndex("by_date", q => q.eq("date", latestPrevDate))
          .collect()).map(toRow)
      : [];

    const allProducts = await ctx.db
      .query("products")
      .filter(q => q.eq(q.field("isActive"), true))
      .collect();
    const products = allProducts.filter(p => p.name !== "E");

    const productInfo: ProductInfo[] = [];
    for (const p of products) {
      const variants = await ctx.db
        .query("productVariants")
        .withIndex("by_productId", q => q.eq("productId", p._id))
        .collect();
      if (variants.length === 0) {
        productInfo.push({
          productId: p._id,
          label: p.name,
          unit: p.unit,
          sortKey: `${p.unit === "kg" ? "0" : "2"}-${p.name}`,
        });
      } else {
        for (const variant of variants) {
          productInfo.push({
            productId: p._id,
            variantId: variant._id,
            label: `${p.name} ${variant.variantValue}`,
            unit: p.unit,
            sortKey: `1-${p.name}-${variant.variantValue}`,
          });
        }
      }
    }
    productInfo.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    const priceHistory = await ctx.db
      .query("priceHistory")
      .withIndex("by_changedAt")
      .collect();
    const currentPrices = await ctx.db.query("prices").collect();
    const priceProducts = productInfo
      .filter(pi => !pi.variantId)
      .map(pi => ({ productId: pi.productId, label: pi.label }));

    const memberNames = (await ctx.db.query("members").collect()).map(m => ({ id: m._id, name: m.name }));

    return { snapshots, prevMonthSnapshots, productInfo, priceHistory, currentPrices, priceProducts, memberNames };
  },
});

/**
 * Payment table rows for a month: this month's payments with each one's running
 * balance, carry-forward rows for credit still open at month end, and an
 * opening-balance row for older credit paid this month. Needs the whole
 * ledger because balances accumulate across months.
 */
function buildPaymentDetails(
  yearMonth: string,
  allTxs: LedgerTx[],
  allPayments: LedgerPayment[],
  memberNames: Map<Id<"members">, string>,
): PaymentDetail[] {
  const monthPrefix = yearMonth;
  const txById = new Map(allTxs.map(tx => [tx._id, tx]));
  const memberName = (memberId?: Id<"members">) => (memberId ? memberNames.get(memberId) ?? "" : "");

  const currentMonthPayments = allPayments
    .filter(p => p.date.startsWith(monthPrefix))
    .sort((a, b) => a.timestamp - b.timestamp);

  // Compute running balance for every payment globally (so cross-month payments are accurate)
  const sortedAllPayments = [...allPayments].sort((a, b) => a.timestamp - b.timestamp);
  const paymentTxCache = new Map<string, { totalAmount: number; amountPaid: number }>();
  for (const p of sortedAllPayments) {
    const tx = txById.get(p.transactionId);
    if (tx) paymentTxCache.set(p.transactionId, { totalAmount: tx.totalAmount, amountPaid: tx.amountPaid ?? tx.totalAmount });
  }
  const runningByPaymentTx = new Map<string, number>();
  const paymentBalanceMap = new Map<string, number>();
  for (const p of sortedAllPayments) {
    const txData = paymentTxCache.get(p.transactionId);
    if (!txData) continue;
    const prev = runningByPaymentTx.get(p.transactionId) ?? 0;
    const newRunning = prev + p.amount;
    runningByPaymentTx.set(p.transactionId, newRunning);
    paymentBalanceMap.set(p._id, Math.max(0, Math.round(txData.totalAmount - txData.amountPaid - newRunning)));
  }

  // Month-end snapshot for carry-forward balance — only payments up to end of displayed month
  const monthEndDate = `${monthPrefix}-31`;
  const monthEndRunning = new Map<string, number>();
  for (const p of sortedAllPayments) {
    if (p.date > monthEndDate) continue;
    monthEndRunning.set(p.transactionId, (monthEndRunning.get(p.transactionId) ?? 0) + p.amount);
  }

  // Current month payment events
  const currentMonthPaymentDetails: PaymentDetail[] = currentMonthPayments.map((p) => {
    const tx = txById.get(p.transactionId);
    return {
      transactionId: p.transactionId,
      orderNumber: tx?.orderNumber ?? 0,
      txDate: tx?.date ?? "",
      memberName: memberName(tx?.memberId),
      txTotal: tx?.totalAmount ?? 0,
      amountPaid: tx?.amountPaid ?? 0,
      paymentDate: p.date,
      amount: p.amount,
      balance: paymentBalanceMap.get(p._id) ?? 0,
      isOpeningBalance: false,
    };
  });

  // Carry-forward: credit transactions from any month with outstanding balance and no payment this month
  const txIdsWithCurrentMonthPayment = new Set<string>(currentMonthPayments.map(p => p.transactionId));
  const carryForwardDetails: PaymentDetail[] = [];
  for (const tx of allTxs) {
    if (tx.date > monthEndDate) continue;
    if (txIdsWithCurrentMonthPayment.has(tx._id)) continue;
    const initialPaid = tx.amountPaid ?? tx.totalAmount;
    if (initialPaid >= tx.totalAmount) continue;
    const totalExtraPayments = monthEndRunning.get(tx._id) ?? 0;
    const remaining = Math.max(0, Math.round(tx.totalAmount - initialPaid - totalExtraPayments));
    if (remaining <= 0) continue;
    carryForwardDetails.push({
      transactionId: tx._id,
      orderNumber: tx.orderNumber,
      txDate: tx.date,
      memberName: memberName(tx.memberId),
      txTotal: tx.totalAmount,
      amountPaid: tx.amountPaid ?? 0,
      paymentDate: "",
      amount: 0,
      balance: remaining,
      isOpeningBalance: false,
    });
  }

  const baseDetails = [...currentMonthPaymentDetails, ...carryForwardDetails];
  baseDetails.sort((a, b) => {
    const d = a.txDate.localeCompare(b.txDate);
    return d !== 0 ? d : a.orderNumber - b.orderNumber;
  });

  // Opening balance ("Saldo Awal"): for credits that originated in an earlier month
  // and received a payment THIS month, show the balance carried into this month so the
  // tab reconciles on its own. Computed identically to the global balance math above,
  // so it equals the prior month's closing Sisa.
  const monthStartDate = `${monthPrefix}-01`;
  const MONTH_LABELS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const pm = Number(monthPrefix.split("-")[1]);
  const prevMonthLabel = MONTH_LABELS[(pm - 2 + 12) % 12]; // month before the one being synced
  const openingLabel = `Sisa dari ${prevMonthLabel}`;
  const paidBeforeMonth = new Map<string, number>();
  for (const p of sortedAllPayments) {
    if (p.date < monthStartDate) {
      paidBeforeMonth.set(p.transactionId, (paidBeforeMonth.get(p.transactionId) ?? 0) + p.amount);
    }
  }
  const openingByGroupKey = new Map<string, PaymentDetail>();
  for (const d of currentMonthPaymentDetails) {
    if (!d.txDate || d.txDate >= monthStartDate) continue; // originated this month — no carry-in
    const key = `${d.orderNumber}::${d.txDate}::${d.memberName}`;
    if (openingByGroupKey.has(key)) continue;
    const txData = paymentTxCache.get(d.transactionId);
    if (!txData) continue;
    const paidBefore = paidBeforeMonth.get(d.transactionId) ?? 0;
    const opening = Math.max(0, Math.round(txData.totalAmount - txData.amountPaid - paidBefore));
    if (opening <= 0) continue;
    openingByGroupKey.set(key, {
      transactionId: d.transactionId,
      orderNumber: d.orderNumber,
      txDate: d.txDate,
      memberName: d.memberName,
      txTotal: d.txTotal,
      amountPaid: d.amountPaid,
      paymentDate: openingLabel,
      amount: 0,
      balance: opening,
      isOpeningBalance: true,
    });
  }

  // Weave each opening row in front of its order's first payment row
  const paymentDetails: PaymentDetail[] = [];
  const emittedOpening = new Set<string>();
  for (const row of baseDetails) {
    const key = `${row.orderNumber}::${row.txDate}::${row.memberName}`;
    if (!emittedOpening.has(key)) {
      const opening = openingByGroupKey.get(key);
      if (opening) paymentDetails.push(opening);
      emittedOpening.add(key);
    }
    paymentDetails.push(row);
  }
  return paymentDetails;
}

/** All data needed to render a monthly tab. Called by the Sheets sync action. */
export const loadMonthData = internalAction({
  args: { yearMonth: v.string() }, // "YYYY-MM"
  handler: async (ctx, args): Promise<MonthData> => {
    const { yearMonth } = args;
    const txDetails = await collectPages(cursor =>
      ctx.runQuery(internal.sheetsSyncData.getMonthTxPage, { yearMonth, cursor }));
    txDetails.sort((a, b) => a.timestamp - b.timestamp);

    const ledgerTxs = await collectPages(cursor =>
      ctx.runQuery(internal.sheetsSyncData.getLedgerTxPage, { cursor }));
    const ledgerPayments = await collectPages(cursor =>
      ctx.runQuery(internal.sheetsSyncData.getLedgerPaymentPage, { cursor }));
    const { memberNames, ...rest } = await ctx.runQuery(internal.sheetsSyncData.getMonthStatic, { yearMonth });

    const paymentDetails = buildPaymentDetails(
      yearMonth,
      ledgerTxs,
      ledgerPayments,
      new Map(memberNames.map(m => [m.id, m.name])),
    );
    return { txDetails, paymentDetails, ...rest };
  },
});

/**
 * Surgically set a single snapshot's quantity by date + product label.
 * Collapses any duplicate snapshot rows for that (date, product, variant) into one,
 * so the value can't be shadowed by a stale newer duplicate in latestSnapshotsByKey.
 */
export const setSnapshotQuantity = mutation({
  args: {
    date: v.string(),                    // "YYYY-MM-DD"
    productName: v.string(),             // e.g. "SBS"
    variantValue: v.optional(v.string()),// e.g. "12x14" (omit for non-variant products)
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const product = await ctx.db
      .query("products")
      .withIndex("by_name", q => q.eq("name", args.productName))
      .first();
    if (!product) throw new Error(`No product named "${args.productName}"`);

    let variantId: Id<"productVariants"> | undefined;
    if (args.variantValue !== undefined) {
      const variants = await ctx.db
        .query("productVariants")
        .withIndex("by_productId", q => q.eq("productId", product._id))
        .collect();
      const variant = variants.find(v => v.variantValue === args.variantValue);
      if (!variant) throw new Error(`No variant "${args.variantValue}" for ${args.productName}`);
      variantId = variant._id;
    }

    const matching = (await ctx.db
      .query("stockSnapshots")
      .withIndex("by_productId_date", q => q.eq("productId", product._id).eq("date", args.date))
      .collect())
      .filter(s => (s.variantId ?? undefined) === variantId);

    const now = Date.now();
    if (matching.length === 0) {
      await ctx.db.insert("stockSnapshots", {
        date: args.date, productId: product._id, variantId, quantity: args.quantity, timestamp: now,
      });
      return { action: "inserted", date: args.date, label: args.productName, quantity: args.quantity };
    }

    // Keep the newest record, set its value, delete the rest so no stale duplicate shadows it
    matching.sort((a, b) => (b._creationTime) - (a._creationTime));
    const [keep, ...extras] = matching;
    await ctx.db.patch(keep._id, { quantity: args.quantity, timestamp: now });
    for (const e of extras) await ctx.db.delete(e._id);
    return { action: "updated", date: args.date, label: args.productName, quantity: args.quantity, removedDuplicates: extras.length };
  },
});

/**
 * Reconstruct a stock snapshot for a past date: start from today's live stock
 * and reverse everything that happened after that date — sales are added back,
 * stock additions and corrections are taken off. Sales are summed page by page
 * so dates far in the past stay within per-query read limits.
 */
export const reconstructSnapshotForDate = action({
  args: { date: v.string() },
  handler: async (ctx, args): Promise<{ date: string; count: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const soldRows = await collectPages(cursor =>
      ctx.runQuery(internal.sheetsSyncData.sumSoldAfterPage, { date: args.date, cursor }));
    const sold = new Map<string, number>();
    for (const { key, qty } of soldRows) sold.set(key, (sold.get(key) ?? 0) + qty);

    return await ctx.runMutation(internal.sheetsSyncData.writeReconstructedSnapshot, {
      date: args.date,
      sold: [...sold].map(([key, qty]) => ({ key, qty })),
    });
  },
});

/** Quantity sold per product/variant for one page of the transactions dated after `date`. */
export const sumSoldAfterPage = internalQuery({
  args: { date: v.string(), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args): Promise<Page<{ key: string; qty: number }>> => {
    const result = await ctx.db
      .query("transactions")
      .withIndex("by_date", q => q.gt("date", args.date))
      .paginate({ cursor: args.cursor, numItems: MONTH_TX_PAGE });
    const itemLists = await Promise.all(result.page.map(tx => ctx.db
      .query("transactionItems")
      .withIndex("by_transactionId", q => q.eq("transactionId", tx._id))
      .collect()));
    const sold = new Map<string, number>();
    for (const item of itemLists.flat()) {
      sold.set(stockKey(item), (sold.get(stockKey(item)) ?? 0) + item.quantity);
    }
    const rows = [...sold].map(([key, qty]) => ({ key, qty }));
    return { rows, continueCursor: result.continueCursor, isDone: result.isDone };
  },
});

/** Overwrite `date`'s snapshot with live stock + `sold` − additions/corrections made after it. */
export const writeReconstructedSnapshot = internalMutation({
  args: { date: v.string(), sold: v.array(v.object({ key: v.string(), qty: v.number() })) },
  handler: async (ctx, args) => {
    // Build current stock baseline
    const stockRows = await ctx.db.query("stock").collect();
    const qtyMap = new Map<string, { productId: Id<"products">; variantId?: Id<"productVariants">; quantity: number }>();
    for (const s of stockRows) {
      qtyMap.set(stockKey(s), { productId: s.productId, variantId: s.variantId, quantity: s.quantity });
    }

    // Add back everything sold after the target date
    for (const { key, qty } of args.sold) {
      const entry = qtyMap.get(key);
      if (entry) entry.quantity += qty;
    }

    // Take off stock that arrived (or was corrected) after the target date —
    // from 00:00 WIB (UTC+7, no DST) the next day.
    const [year, month, day] = args.date.split("-").map(Number);
    const nextDayStart = Date.UTC(year, month - 1, day + 1) - 7 * 3_600_000;
    const additions = await ctx.db
      .query("stockAdditions")
      .withIndex("by_timestamp", q => q.gte("timestamp", nextDayStart))
      .collect();
    for (const a of additions) {
      const entry = qtyMap.get(stockKey(a));
      if (entry) entry.quantity -= a.quantity;
    }
    const corrections = await ctx.db
      .query("stockCorrections")
      .withIndex("by_timestamp", q => q.gte("timestamp", nextDayStart))
      .collect();
    for (const c of corrections) {
      const entry = qtyMap.get(stockKey(c));
      if (entry) entry.quantity -= c.delta;
    }

    // Overwrite snapshot for target date
    const existing = await ctx.db
      .query("stockSnapshots")
      .withIndex("by_date", q => q.eq("date", args.date))
      .collect();
    for (const s of existing) await ctx.db.delete(s._id);
    const now = Date.now();
    for (const [, e] of qtyMap) {
      await ctx.db.insert("stockSnapshots", {
        date: args.date, productId: e.productId, variantId: e.variantId, quantity: e.quantity, timestamp: now,
      });
    }
    return { date: args.date, count: qtyMap.size };
  },
});

export const getMembersForSync = internalQuery({
  args: {},
  handler: async (ctx) => {
    const members = await ctx.db.query("members").collect();
    return members
      .sort((a, b) => a._creationTime - b._creationTime)
      .map((m: Doc<"members">) => ({
        name: m.name,
        phone: m.phone ?? "",
        joined: new Date(m._creationTime).toISOString().slice(0, 10),
      }));
  },
});
