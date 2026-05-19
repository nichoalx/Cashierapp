import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const stockRows = await ctx.db.query("stock").collect();

    return Promise.all(stockRows.map(async (s) => {
      const product = await ctx.db.get(s.productId);
      const variant = s.variantId ? await ctx.db.get(s.variantId) : null;
      const productName = variant
        ? `${product?.fullName ?? '?'} ${variant.variantValue}`
        : (product?.fullName ?? 'Unknown');
      return {
        id: s._id,
        productId: s.productId,
        variantId: s.variantId,
        productName,
        productShortName: product?.name ?? '?',
        quantity: s.quantity,
        unit: product?.unit ?? 'pcs',
        minThreshold: s.minThreshold,
        color: product?.color ?? '#9a9db5',
      };
    }));
  },
});

export const addStock = mutation({
  args: {
    stockId: v.id("stock"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const stockEntry = await ctx.db.get(args.stockId);
    if (!stockEntry) throw new Error("Stock entry not found");

    await ctx.db.patch(args.stockId, {
      quantity: stockEntry.quantity + args.quantity,
    });

    return await ctx.db.insert("stockAdditions", {
      productId: stockEntry.productId,
      variantId: stockEntry.variantId,
      quantity: args.quantity,
      timestamp: Date.now(),
    });
  },
});

export const listAdditions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const additions = await ctx.db
      .query("stockAdditions")
      .withIndex("by_timestamp")
      .order("desc")
      .take(100);

    return Promise.all(additions.map(async (a) => {
      const product = await ctx.db.get(a.productId);
      const variant = a.variantId ? await ctx.db.get(a.variantId) : null;
      const productName = variant
        ? `${product?.fullName ?? '?'} ${variant.variantValue}`
        : (product?.fullName ?? 'Unknown');
      return {
        id: a._id,
        productName,
        quantity: a.quantity,
        unit: product?.unit ?? 'pcs',
        timestamp: a.timestamp,
      };
    }));
  },
});

export const undoAddition = mutation({
  args: { additionId: v.id("stockAdditions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const addition = await ctx.db.get(args.additionId);
    if (!addition) throw new Error("Addition not found");

    const stockEntry = addition.variantId
      ? await ctx.db
          .query("stock")
          .withIndex("by_variantId", q => q.eq("variantId", addition.variantId!))
          .first()
      : await ctx.db
          .query("stock")
          .withIndex("by_productId", q => q.eq("productId", addition.productId))
          .filter(q => q.eq(q.field("variantId"), undefined))
          .first();

    if (stockEntry) {
      await ctx.db.patch(stockEntry._id, {
        quantity: Math.max(0, stockEntry.quantity - addition.quantity),
      });
    }

    await ctx.db.delete(args.additionId);
  },
});
