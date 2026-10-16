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

// Find transaction items near a target quantity for two products — used to
// track down mis-labelled entries (e.g. BH entered instead of SBS).
export const findMislabel = internalQuery({
  args: { nameA: v.string(), nameB: v.string(), targetQty: v.number(), tolerance: v.number() },
  handler: async (ctx, args) => {
    const pA = await ctx.db.query("products").withIndex("by_name", q => q.eq("name", args.nameA)).first();
    const pB = await ctx.db.query("products").withIndex("by_name", q => q.eq("name", args.nameB)).first();
    if (!pA || !pB) return { error: "product not found" };

    const allItems = await ctx.db.query("transactionItems").collect();
    const near = allItems.filter(i =>
      (String(i.productId) === String(pA._id) || String(i.productId) === String(pB._id)) &&
      Math.abs(i.quantity - args.targetQty) <= args.tolerance
    );

    return Promise.all(near.map(async i => {
      const tx = await ctx.db.get(i.transactionId);
      const product = await ctx.db.get(i.productId);
      return {
        date: tx?.date,
        orderNumber: tx?.orderNumber,
        product: product?.name,
        displayName: i.displayName,
        qty: i.quantity,
        txId: i.transactionId,
      };
    }));
  },
});

// List ALL transaction items for a named product, sorted by date/order.
export const listAllForProduct = internalQuery({
  args: { productName: v.string() },
  handler: async (ctx, args) => {
    const product = await ctx.db.query("products").withIndex("by_name", q => q.eq("name", args.productName)).first();
    if (!product) return [];
    const allItems = await ctx.db.query("transactionItems").collect();
    const matching = allItems.filter(i => String(i.productId) === String(product._id));
    const results = await Promise.all(matching.map(async i => {
      const tx = await ctx.db.get(i.transactionId);
      return { date: tx?.date ?? "?", order: tx?.orderNumber ?? 0, qty: i.quantity, displayName: i.displayName ?? product.name };
    }));
    return results.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
  },
});

// Full audit from a start date to now.
// Returns per-product: total sold, total added, current stock, and implied
// opening stock on the start date (current + sold - added).
// Run via: npx convex run stockReconcile:audit --args '{"fromDate":"2026-05-26"}'
export const audit = internalQuery({
  args: { fromDate: v.string() },
  handler: async (ctx, args) => {
    const fromTs = new Date(args.fromDate).getTime();

    // All transactions on or after fromDate
    const allTxs = await ctx.db.query("transactions").collect();
    const txsInRange = allTxs.filter(tx => tx.timestamp >= fromTs);

    // Flatten all transaction items in range
    const allItems = (
      await Promise.all(
        txsInRange.map(tx =>
          ctx.db
            .query("transactionItems")
            .withIndex("by_transactionId", q => q.eq("transactionId", tx._id))
            .collect()
        )
      )
    ).flat();

    // Sum sold per (productId, variantId) key
    const sold: Record<string, number> = {};
    for (const item of allItems) {
      const k = String(item.variantId ?? item.productId);
      sold[k] = (sold[k] ?? 0) + item.quantity;
    }

    // Sum stock additions in range
    const allAdditions = await ctx.db
      .query("stockAdditions")
      .withIndex("by_timestamp")
      .order("asc")
      .collect();
    const additionsInRange = allAdditions.filter(a => a.timestamp >= fromTs);

    const added: Record<string, number> = {};
    for (const a of additionsInRange) {
      const k = String(a.variantId ?? a.productId);
      added[k] = (added[k] ?? 0) + a.quantity;
    }

    // Build result rows per stock entry
    const stockRows = await ctx.db.query("stock").collect();
    const rows = await Promise.all(
      stockRows.map(async s => {
        const product = await ctx.db.get(s.productId);
        const variant = s.variantId ? await ctx.db.get(s.variantId) : null;
        const name = variant
          ? `${product?.name ?? "?"} ${variant.variantValue}`
          : (product?.name ?? "Unknown");

        const k = String(s.variantId ?? s.productId);
        const soldQty  = sold[k]  ?? 0;
        const addedQty = added[k] ?? 0;
        // If accounting is perfect: current = openingStock + added - sold
        // So: openingStock = current - added + sold
        const impliedOpening = s.quantity - addedQty + soldQty;

        return {
          name,
          unit: product?.unit ?? "?",
          currentStock: s.quantity,
          soldSinceFromDate: soldQty,
          addedSinceFromDate: addedQty,
          impliedOpeningStock: impliedOpening,
        };
      })
    );

    // Also return daily breakdown for BH (productId lookup by name)
    const bhProduct = await ctx.db.query("products").withIndex("by_name", q => q.eq("name", "BH")).first();
    let bhDailyBreakdown: Array<{ date: string; sold: number; added: number; txCount: number }> = [];

    if (bhProduct) {
      const bhTxs = txsInRange.sort((a, b) => a.timestamp - b.timestamp);
      const byDate: Record<string, { sold: number; added: number; txCount: number }> = {};

      for (const tx of bhTxs) {
        const items = await ctx.db
          .query("transactionItems")
          .withIndex("by_transactionId", q => q.eq("transactionId", tx._id))
          .collect();
        const bhItems = items.filter(i => i.productId === bhProduct._id);
        if (bhItems.length > 0) {
          byDate[tx.date] = byDate[tx.date] ?? { sold: 0, added: 0, txCount: 0 };
          byDate[tx.date].txCount += 1;
          for (const item of bhItems) {
            byDate[tx.date].sold += item.quantity;
          }
        }
      }

      const bhAdditions = additionsInRange.filter(a => a.productId === bhProduct._id);
      for (const a of bhAdditions) {
        const date = new Date(a.timestamp).toISOString().slice(0, 10);
        byDate[date] = byDate[date] ?? { sold: 0, added: 0, txCount: 0 };
        byDate[date].added += a.quantity;
      }

      bhDailyBreakdown = Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, ...v }));
    }

    return { rows, bhDailyBreakdown };
  },
});
