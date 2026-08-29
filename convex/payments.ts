import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { recomputeMemberStats } from "./memberStats";

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
    const paymentId = await ctx.db.insert("payments", {
      transactionId: args.transactionId,
      date: args.date,
      amount: args.amount,
      timestamp: Date.now(),
    });

    const tx = await ctx.db.get(args.transactionId);
    await recomputeMemberStats(ctx, tx?.memberId);

    return paymentId;
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

export const remove = mutation({
  args: { paymentId: v.id("payments") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const payment = await ctx.db.get(args.paymentId);
    if (!payment) return;

    // Read the transaction before deleting so we know whose stats to refresh.
    const tx = await ctx.db.get(payment.transactionId);
    await ctx.db.delete(args.paymentId);
    await recomputeMemberStats(ctx, tx?.memberId);
  },
});

export const update = mutation({
  args: { paymentId: v.id("payments"), amount: v.number(), date: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    if (args.amount <= 0) throw new Error("Amount must be positive");

    const payment = await ctx.db.get(args.paymentId);
    if (!payment) throw new Error("Pembayaran tidak ditemukan");

    await ctx.db.patch(args.paymentId, { amount: args.amount, date: args.date });

    const tx = await ctx.db.get(payment.transactionId);
    await recomputeMemberStats(ctx, tx?.memberId);
  },
});
