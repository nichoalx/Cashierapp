import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const create = mutation({
  args: {
    items: v.array(v.object({
      productId: v.id("products"),
      variantId: v.optional(v.id("productVariants")),
      quantity: v.number(),
      unitPrice: v.number(),
      totalAmount: v.number(),
    })),
    remarks: v.optional(v.string()),
    memberId: v.optional(v.id("members")),
    discount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const now = Date.now();
    const date = new Date(now).toISOString().slice(0, 10);

    const todayTxs = await ctx.db
      .query("transactions")
      .withIndex("by_date", q => q.eq("date", date))
      .collect();
    const orderNumber = todayTxs.length + 1;

    const subtotal = args.items.reduce((s, i) => s + i.totalAmount, 0);
    const discount = Math.max(0, Math.min(args.discount ?? 0, subtotal));
    const totalAmount = subtotal - discount;

    const txId = await ctx.db.insert("transactions", {
      orderNumber,
      date,
      timestamp: now,
      totalAmount,
      discount: discount > 0 ? discount : undefined,
      remarks: args.remarks,
      memberId: args.memberId,
    });

    for (const item of args.items) {
      await ctx.db.insert("transactionItems", {
        transactionId: txId,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalAmount: item.totalAmount,
      });

      // Decrement stock for this product/variant
      const stockEntry = item.variantId
        ? await ctx.db
            .query("stock")
            .withIndex("by_variantId", q => q.eq("variantId", item.variantId!))
            .first()
        : await ctx.db
            .query("stock")
            .withIndex("by_productId", q => q.eq("productId", item.productId))
            .filter(q => q.eq(q.field("variantId"), undefined))
            .first();

      if (stockEntry) {
        await ctx.db.patch(stockEntry._id, {
          quantity: Math.max(0, stockEntry.quantity - item.quantity),
        });
      }
    }

    return txId;
  },
});

export const listByDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const txs = await ctx.db
      .query("transactions")
      .withIndex("by_date", q => q.eq("date", args.date))
      .collect();

    txs.sort((a, b) => a.timestamp - b.timestamp);

    return Promise.all(txs.map(async (tx) => {
      const rawItems = await ctx.db
        .query("transactionItems")
        .withIndex("by_transactionId", q => q.eq("transactionId", tx._id))
        .collect();

      const items = await Promise.all(rawItems.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        const variant = item.variantId ? await ctx.db.get(item.variantId) : null;
        return {
          id: item._id,
          productId: item.productId,
          variantId: item.variantId,
          productName: product?.fullName ?? 'Unknown',
          productShortName: product?.name ?? '?',
          quantity: item.quantity,
          unit: product?.unit ?? 'pcs',
          unitPrice: item.unitPrice,
          total: item.totalAmount,
          color: product?.color ?? '#9a9db5',
          plasticSize: variant?.variantValue,
        };
      }));

      let memberName: string | undefined;
      if (tx.memberId) {
        const member = await ctx.db.get(tx.memberId);
        memberName = member?.name;
      }

      return {
        id: tx._id,
        orderNumber: tx.orderNumber,
        timestamp: tx.timestamp,
        total: tx.totalAmount,
        discount: tx.discount ?? 0,
        remarks: tx.remarks,
        memberId: tx.memberId,
        memberName,
        items,
      };
    }));
  },
});

export const update = mutation({
  args: {
    txId: v.id("transactions"),
    updatedItems: v.array(v.object({
      id: v.id("transactionItems"),
      quantity: v.number(),
      totalAmount: v.number(),
    })),
    removedItemIds: v.array(v.id("transactionItems")),
    remarks: v.optional(v.string()),
    memberId: v.optional(v.id("members")),
    discount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    for (const item of args.updatedItems) {
      await ctx.db.patch(item.id, { quantity: item.quantity, totalAmount: item.totalAmount });
    }
    for (const itemId of args.removedItemIds) {
      await ctx.db.delete(itemId);
    }

    const remaining = await ctx.db
      .query("transactionItems")
      .withIndex("by_transactionId", q => q.eq("transactionId", args.txId))
      .collect();
    const subtotal = remaining.reduce((s, i) => s + i.totalAmount, 0);

    const existing = await ctx.db.get(args.txId);
    const requestedDiscount = args.discount ?? existing?.discount ?? 0;
    const discount = Math.max(0, Math.min(requestedDiscount, subtotal));

    await ctx.db.patch(args.txId, {
      totalAmount: subtotal - discount,
      discount: discount > 0 ? discount : undefined,
      remarks: args.remarks,
      memberId: args.memberId,
    });
  },
});

export const remove = mutation({
  args: { txId: v.id("transactions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const items = await ctx.db
      .query("transactionItems")
      .withIndex("by_transactionId", q => q.eq("transactionId", args.txId))
      .collect();
    for (const item of items) {
      await ctx.db.delete(item._id);
    }
    await ctx.db.delete(args.txId);
  },
});
