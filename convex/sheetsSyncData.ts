import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// Internal data helpers for the Sheets sync action.
// Lives outside `sheetsSync.ts` because that file uses the Node.js runtime,
// which only permits action definitions — queries/mutations must be in V8-runtime files.

/** Take a stock snapshot for today if one doesn't already exist. */
export const takeSnapshotIfMissing = internalMutation({
  args: {},
  handler: async (ctx) => {
    const date = new Date().toISOString().slice(0, 10);
    const existing = await ctx.db
      .query("stockSnapshots")
      .withIndex("by_date", q => q.eq("date", date))
      .first();
    if (existing) return { created: false, date };

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

    return { txDetails, snapshots, productInfo };
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
