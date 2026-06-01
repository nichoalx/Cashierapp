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

/** Refresh the stock snapshot for today (always overwrites so the sheet stays current). */
export const takeSnapshotIfMissing = internalMutation({
  args: {},
  handler: async (ctx) => {
    const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

    // Always delete and re-insert today's snapshot so the sheet reflects the latest stock
    const existing = await ctx.db
      .query("stockSnapshots")
      .withIndex("by_date", q => q.eq("date", date))
      .collect();
    for (const s of existing) {
      await ctx.db.delete(s._id);
    }

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

    // Current month payment events
    const currentMonthPaymentDetails = await Promise.all(currentMonthPayments.map(async (p) => {
      const tx = await ctx.db.get(p.transactionId);
      const member = tx?.memberId ? await ctx.db.get(tx.memberId) : null;
      return {
        orderNumber: tx?.orderNumber ?? 0,
        txDate: tx?.date ?? "",
        memberName: member?.name ?? "",
        txTotal: tx?.totalAmount ?? 0,
        amountPaid: tx?.amountPaid ?? 0,
        paymentDate: p.date,
        amount: p.amount,
        balance: paymentBalanceMap.get(p._id) ?? 0,
      };
    }));

    // Carry-forward: credit transactions from any month with outstanding balance and no payment this month
    const txIdsWithCurrentMonthPayment = new Set(currentMonthPayments.map(p => p.transactionId.toString()));
    const carryForwardDetails: typeof currentMonthPaymentDetails = [];
    for (const tx of allTxs) {
      if (txIdsWithCurrentMonthPayment.has(tx._id)) continue;
      const initialPaid = tx.amountPaid ?? tx.totalAmount;
      if (initialPaid >= tx.totalAmount) continue;
      const totalExtraPayments = runningByPaymentTx.get(tx._id) ?? 0;
      const remaining = Math.max(0, Math.round(tx.totalAmount - initialPaid - totalExtraPayments));
      if (remaining <= 0) continue;
      const member = tx.memberId ? await ctx.db.get(tx.memberId) : null;
      carryForwardDetails.push({
        orderNumber: tx.orderNumber,
        txDate: tx.date,
        memberName: member?.name ?? "",
        txTotal: tx.totalAmount,
        amountPaid: tx.amountPaid ?? 0,
        paymentDate: "",
        amount: 0,
        balance: remaining,
      });
    }

    const paymentDetails = [...currentMonthPaymentDetails, ...carryForwardDetails];
    paymentDetails.sort((a, b) => {
      const d = a.txDate.localeCompare(b.txDate);
      return d !== 0 ? d : a.orderNumber - b.orderNumber;
    });

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
