import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

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
        discount: tx.discount ?? 0,
        remarks: tx.remarks ?? "",
        memberName: member?.name ?? "",
        items: itemDetails,
      };
    }));

    const allSnapshots = await ctx.db.query("stockSnapshots").collect();
    const snapshots = allSnapshots.filter(s => s.date.startsWith(monthPrefix));

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
    const monthPayments = allPayments
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

    const paymentDetails = await Promise.all(monthPayments.map(async (p) => {
      const tx = await ctx.db.get(p.transactionId);
      const member = tx?.memberId ? await ctx.db.get(tx.memberId) : null;
      return {
        orderNumber: tx?.orderNumber ?? 0,
        txDate: tx?.date ?? "",
        memberName: member?.name ?? "",
        txTotal: tx?.totalAmount ?? 0,
        paymentDate: p.date,
        amount: p.amount,
        balance: paymentBalanceMap.get(p._id) ?? 0,
      };
    }));

    return { txDetails, snapshots, productInfo, paymentDetails };
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

export const getPaymentsForSync = internalQuery({
  args: {},
  handler: async (ctx) => {
    const payments = await ctx.db.query("payments").collect();
    payments.sort((a, b) => a.timestamp - b.timestamp);

    // Compute running balance per transaction
    const uniqueTxIds = [...new Set(payments.map(p => p.transactionId))];
    const txCache = new Map<string, { totalAmount: number; amountPaid: number; orderNumber: number; date: string; memberId?: string }>();
    for (const txId of uniqueTxIds) {
      const tx = await ctx.db.get(txId);
      if (tx) txCache.set(txId, { totalAmount: tx.totalAmount, amountPaid: tx.amountPaid ?? tx.totalAmount, orderNumber: tx.orderNumber, date: tx.date, memberId: tx.memberId });
    }
    const memberCache = new Map<string, string>();
    for (const txData of txCache.values()) {
      if (txData.memberId && !memberCache.has(txData.memberId)) {
        const m = await ctx.db.get(txData.memberId as Id<"members">);
        if (m) memberCache.set(txData.memberId, m.name);
      }
    }
    const runningByTx = new Map<string, number>();

    return payments.map(p => {
      const txData = txCache.get(p.transactionId);
      const prev = runningByTx.get(p.transactionId) ?? 0;
      const newRunning = prev + p.amount;
      runningByTx.set(p.transactionId, newRunning);
      const txTotal = txData?.totalAmount ?? 0;
      const amountPaid = txData?.amountPaid ?? 0;
      const balance = Math.max(0, Math.round(txTotal - amountPaid - newRunning));
      return {
        orderNumber: txData?.orderNumber ?? 0,
        txDate: txData?.date ?? "",
        memberName: txData?.memberId ? (memberCache.get(txData.memberId) ?? "") : "",
        txTotal,
        paymentDate: p.date,
        amount: p.amount,
        balance,
      };
    });
  },
});
