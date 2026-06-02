import { v } from "convex/values";
import { internalMutation, internalQuery, mutation } from "./_generated/server";
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

// Internal data helpers for the Sheets sync action.
// Lives outside `sheetsSync.ts` because that file uses the Node.js runtime,
// which only permits action definitions — queries/mutations must be in V8-runtime files.

/** Create today's stock snapshot only if one doesn't already exist. Manual fixes are preserved. */
export const takeSnapshotIfMissing = internalMutation({
  args: {},
  handler: async (ctx) => {
    const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

    const existing = await ctx.db
      .query("stockSnapshots")
      .withIndex("by_date", q => q.eq("date", date))
      .collect();
    if (existing.length > 0) return { created: false, date };

    const stockRows = await ctx.db.query("stock").collect();
    const now = Date.now();
    for (const s of stockRows) {
      await ctx.db.insert("stockSnapshots", {
        date,
        productId: s.productId,
        variantId: s.variantId,
        quantity: s.quantity,
        timestamp: now,
      });
    }
    return { created: true, date };
  },
});

/** All data needed to render a monthly tab. */
export const getMonthData = internalQuery({
  args: { yearMonth: v.string() }, // "YYYY-MM"
  handler: async (ctx, args) => {
    const monthPrefix = args.yearMonth;

    const allTxs = await ctx.db.query("transactions").collect();
    const txs = allTxs
      .filter(tx => tx.date.startsWith(monthPrefix))
      .sort((a, b) => a.timestamp - b.timestamp);

    const txDetails = await Promise.all(txs.map(async (tx) => {
      const items = await ctx.db
        .query("transactionItems")
        .withIndex("by_transactionId", q => q.eq("transactionId", tx._id))
        .collect();
      const itemDetails = await Promise.all(items.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        const variant = item.variantId ? await ctx.db.get(item.variantId) : null;
        return {
          productName: variant
            ? `${product?.fullName ?? "?"} ${variant.variantValue}`
            : (product?.fullName ?? "?"),
          quantity: item.quantity,
          unit: product?.unit ?? "pcs",
          unitPrice: item.unitPrice,
          totalAmount: item.totalAmount,
        };
      }));
      const member = tx.memberId ? await ctx.db.get(tx.memberId) : null;
      return {
        date: tx.date,
        orderNumber: tx.orderNumber,
        timestamp: tx.timestamp,
        totalAmount: tx.totalAmount,
        amountPaid: tx.amountPaid ?? tx.totalAmount,
        discount: tx.discount ?? 0,
        remarks: tx.remarks ?? "",
        memberName: member?.name ?? "",
        items: itemDetails,
      };
    }));

    const allSnapshots = latestSnapshotsByKey(await ctx.db.query("stockSnapshots").collect());
    const snapshots = allSnapshots.filter(s => s.date.startsWith(monthPrefix));

    // Most recent snapshot before this month — used as delta baseline for the first date
    const monthStart = `${monthPrefix}-01`;
    const previousCalendarDate = previousDate(monthStart);
    const hasPreviousCalendarSnapshot = allSnapshots.some(s => s.date === previousCalendarDate);
    const latestPrevDate = allSnapshots
      .map(s => s.date)
      .filter(d => hasPreviousCalendarSnapshot ? d === previousCalendarDate : d < monthStart)
      .sort()
      .pop() ?? null;
    const prevMonthSnapshots = latestPrevDate
      ? allSnapshots.filter(s => s.date === latestPrevDate)
      : [];

    const allProducts = await ctx.db
      .query("products")
      .filter(q => q.eq(q.field("isActive"), true))
      .collect();
    const products = allProducts.filter(p => p.name !== "E");

    const productInfo: Array<{
      productId: Id<"products">;
      variantId?: Id<"productVariants">;
      label: string;
      unit: string;
      sortKey: string;
    }> = [];

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

    const allPayments = await ctx.db.query("payments").collect();
    const currentMonthPayments = allPayments
      .filter(p => p.date.startsWith(monthPrefix))
      .sort((a, b) => a.timestamp - b.timestamp);

    // Compute running balance for every payment globally (so cross-month payments are accurate)
    const sortedAllPayments = [...allPayments].sort((a, b) => a.timestamp - b.timestamp);
    const uniquePaymentTxIds = [...new Set(sortedAllPayments.map(p => p.transactionId))];
    const paymentTxCache = new Map<string, { totalAmount: number; amountPaid: number }>();
    for (const txId of uniquePaymentTxIds) {
      const tx = await ctx.db.get(txId);
      if (tx) paymentTxCache.set(txId, { totalAmount: tx.totalAmount, amountPaid: tx.amountPaid ?? tx.totalAmount });
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
    const currentMonthPaymentDetails = await Promise.all(currentMonthPayments.map(async (p) => {
      const tx = await ctx.db.get(p.transactionId);
      const member = tx?.memberId ? await ctx.db.get(tx.memberId) : null;
      return {
        transactionId: p.transactionId,
        orderNumber: tx?.orderNumber ?? 0,
        txDate: tx?.date ?? "",
        memberName: member?.name ?? "",
        txTotal: tx?.totalAmount ?? 0,
        amountPaid: tx?.amountPaid ?? 0,
        paymentDate: p.date,
        amount: p.amount,
        balance: paymentBalanceMap.get(p._id) ?? 0,
        isOpeningBalance: false,
      };
    }));

    // Carry-forward: credit transactions from any month with outstanding balance and no payment this month
    const txIdsWithCurrentMonthPayment = new Set(currentMonthPayments.map(p => p.transactionId.toString()));
    const carryForwardDetails: typeof currentMonthPaymentDetails = [];
    for (const tx of allTxs) {
      if (tx.date > monthEndDate) continue;
      if (txIdsWithCurrentMonthPayment.has(tx._id)) continue;
      const initialPaid = tx.amountPaid ?? tx.totalAmount;
      if (initialPaid >= tx.totalAmount) continue;
      const totalExtraPayments = monthEndRunning.get(tx._id) ?? 0;
      const remaining = Math.max(0, Math.round(tx.totalAmount - initialPaid - totalExtraPayments));
      if (remaining <= 0) continue;
      const member = tx.memberId ? await ctx.db.get(tx.memberId) : null;
      carryForwardDetails.push({
        transactionId: tx._id,
        orderNumber: tx.orderNumber,
        txDate: tx.date,
        memberName: member?.name ?? "",
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
    const openingByGroupKey = new Map<string, (typeof baseDetails)[number]>();
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
    const paymentDetails: typeof baseDetails = [];
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

    const allPriceHistory = await ctx.db
      .query("priceHistory")
      .withIndex("by_changedAt")
      .collect();
    const allCurrentPrices = await ctx.db.query("prices").collect();
    const priceProducts = productInfo
      .filter(pi => !pi.variantId)
      .map(pi => ({ productId: pi.productId, label: pi.label }));

    return { txDetails, snapshots, prevMonthSnapshots, productInfo, paymentDetails, priceHistory: allPriceHistory, currentPrices: allCurrentPrices, priceProducts };
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
 * Reconstruct a stock snapshot for a past date by reversing all sales transactions
 * that occurred after that date. Assumes stock changes only come from sales.
 */
export const reconstructSnapshotForDate = mutation({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // Build current stock baseline
    const stockRows = await ctx.db.query("stock").collect();
    const qtyMap = new Map<string, { productId: Id<"products">; variantId?: Id<"productVariants">; quantity: number }>();
    for (const s of stockRows) {
      const key = `${s.productId}::${s.variantId ?? ""}`;
      qtyMap.set(key, { productId: s.productId, variantId: s.variantId, quantity: s.quantity });
    }

    // Add back quantities from all transactions AFTER the target date (reverse sales)
    const allTxs = await ctx.db.query("transactions").collect();
    const laterTxs = allTxs.filter(tx => tx.date > args.date);
    for (const tx of laterTxs) {
      const items = await ctx.db
        .query("transactionItems")
        .withIndex("by_transactionId", q => q.eq("transactionId", tx._id))
        .collect();
      for (const item of items) {
        const key = `${item.productId}::${item.variantId ?? ""}`;
        const entry = qtyMap.get(key);
        if (entry) entry.quantity += item.quantity;
      }
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

/** Public mutation — call from the client to capture today's stock snapshot automatically. */
export const takeSnapshotNow = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    const existing = await ctx.db
      .query("stockSnapshots")
      .withIndex("by_date", q => q.eq("date", date))
      .collect();
    for (const s of existing) await ctx.db.delete(s._id);
    const stockRows = await ctx.db.query("stock").collect();
    const now = Date.now();
    for (const s of stockRows) {
      await ctx.db.insert("stockSnapshots", {
        date, productId: s.productId, variantId: s.variantId, quantity: s.quantity, timestamp: now,
      });
    }
    return date;
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
