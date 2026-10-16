import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { adjustOutstandingAround } from "./memberStats";

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
    return await adjustOutstandingAround(ctx, args.transactionId, () =>
      ctx.db.insert("payments", {
        transactionId: args.transactionId,
        date: args.date,
        amount: args.amount,
        timestamp: Date.now(),
      }),
    );
  },
});

export const remove = mutation({
  args: { paymentId: v.id("payments") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const payment = await ctx.db.get(args.paymentId);
    if (!payment) return;

    await adjustOutstandingAround(ctx, payment.transactionId, () =>
      ctx.db.delete(args.paymentId),
    );
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

    await adjustOutstandingAround(ctx, payment.transactionId, () =>
      ctx.db.patch(args.paymentId, { amount: args.amount, date: args.date }),
    );
  },
});
