import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const check = internalQuery({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const stockRows = await ctx.db.query("stock").collect();

    // All transaction items for today
    const todayTxs = await ctx.db
      .query("transactions")
      .withIndex("by_date", q => q.eq("date", args.date))
      .collect();

    const allItems = (
      await Promise.all(
        todayTxs.map(tx =>
          ctx.db
            .query("transactionItems")
            .withIndex("by_transactionId", q => q.eq("transactionId", tx._id))
            .collect()
        )
      )
    ).flat();

    // Sum sold per product/variant key
    const sold: Record<string, number> = {};
    for (const i of allItems) {
      const k = String(i.variantId ?? i.productId);
      sold[k] = (sold[k] ?? 0) + i.quantity;
    }

    // Stock additions today
    const start = new Date(args.date).getTime();
    const end   = start + 86_400_000;
    const allAdditions = await ctx.db
      .query("stockAdditions")
      .withIndex("by_timestamp")
      .order("asc")
      .collect();
    const todayAdditions = allAdditions.filter(a => a.timestamp >= start && a.timestamp < end);

    const added: Record<string, number> = {};
    for (const a of todayAdditions) {
      const k = String(a.variantId ?? a.productId);
      added[k] = (added[k] ?? 0) + a.quantity;
    }

    // Build reconciliation rows
    return Promise.all(
      stockRows.map(async s => {
        const product = await ctx.db.get(s.productId);
        const variant = s.variantId ? await ctx.db.get(s.variantId) : null;
        const productName = variant
          ? `${product?.fullName ?? "?"} ${variant.variantValue}`
          : (product?.fullName ?? "Unknown");

        const k = String(s.variantId ?? s.productId);
        const soldQty  = sold[k]  ?? 0;
        const addedQty = added[k] ?? 0;
        // implied opening stock = current + sold - added
        const impliedOpen = s.quantity + soldQty - addedQty;

        return { productName, current: s.quantity, soldToday: soldQty, addedToday: addedQty, impliedOpen };
      })
    );
  },
});
