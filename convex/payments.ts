import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const record = mutation({
  args: {
    transactionId: v.id("transactions"),
    date: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    if (args.amount <= 0) throw new Error("Amount must be positive");
    return await ctx.db.insert("payments", {
      transactionId: args.transactionId,
      date: args.date,
      amount: args.amount,
      timestamp: Date.now(),
    });
  },
});

export const listByTransaction = query({
  args: { transactionId: v.id("transactions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_transactionId", q => q.eq("transactionId", args.transactionId))
      .collect();
    return payments.sort((a, b) => a.timestamp - b.timestamp);
  },
});
