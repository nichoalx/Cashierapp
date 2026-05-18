import { mutation } from "./_generated/server";
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

    const totalAmount = args.items.reduce((s, i) => s + i.totalAmount, 0);

    const txId = await ctx.db.insert("transactions", {
      orderNumber,
      date,
      timestamp: now,
      totalAmount,
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
