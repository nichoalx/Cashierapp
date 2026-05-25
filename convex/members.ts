import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const members = await ctx.db.query("members").collect();

    // Attach outstanding balance to each member for the list view
    const withBalances = await Promise.all(members.map(async (m) => {
      const txs = await ctx.db
        .query("transactions")
        .withIndex("by_memberId", q => q.eq("memberId", m._id))
        .collect();

      let outstanding = 0;
      for (const tx of txs) {
        const initialPaid = tx.amountPaid ?? tx.totalAmount;
        const pyRows = await ctx.db
          .query("payments")
          .withIndex("by_transactionId", q => q.eq("transactionId", tx._id))
          .collect();
        const recorded = pyRows.reduce((s, p) => s + p.amount, 0);
        outstanding += Math.max(0, tx.totalAmount - initialPaid - recorded);
      }

      return { ...m, outstanding };
    }));

    return withBalances;
  },
});

export const getWithHistory = query({
  args: { memberId: v.id("members") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const member = await ctx.db.get(args.memberId);
    if (!member) return null;

    const txs = await ctx.db
      .query("transactions")
      .withIndex("by_memberId", q => q.eq("memberId", args.memberId))
      .collect();

    txs.sort((a, b) => b.timestamp - a.timestamp);

    let totalOutstanding = 0;
    const orders = await Promise.all(txs.map(async (tx) => {
      const pyRows = await ctx.db
        .query("payments")
        .withIndex("by_transactionId", q => q.eq("transactionId", tx._id))
        .collect();
      const recorded = pyRows.reduce((s, p) => s + p.amount, 0);
      const initialPaid = tx.amountPaid ?? tx.totalAmount;
      const balance = Math.max(0, tx.totalAmount - initialPaid - recorded);
      totalOutstanding += balance;

      return {
        id: tx._id,
        orderNumber: tx.orderNumber,
        date: tx.date,
        timestamp: tx.timestamp,
        total: tx.totalAmount,
        discount: tx.discount ?? 0,
        amountPaid: initialPaid,
        balance,
      };
    }));

    return { member, orders, totalOutstanding };
  },
});

export const add = mutation({
  args: { name: v.string(), phone: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    return await ctx.db.insert("members", { name: args.name, phone: args.phone });
  },
});

export const remove = mutation({
  args: { memberId: v.id("members") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    await ctx.db.delete(args.memberId);
  },
});
