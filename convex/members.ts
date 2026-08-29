import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // Flat read: one document per member, no fan-out. outstanding/visitCount/
    // lastVisitDate are denormalized onto the member by recomputeMemberStats().
    // ctx.storage.getUrl is not a database read, so it costs nothing here.
    const members = await ctx.db.query("members").collect();

    return await Promise.all(members.map(async (m) => {
      const profileImageUrl = m.profileImageId
        ? await ctx.storage.getUrl(m.profileImageId)
        : null;
      return {
        ...m,
        outstanding: m.outstanding ?? 0,
        visitCount: m.visitCount ?? 0,
        lastVisitDate: m.lastVisitDate,
        profileImageUrl: profileImageUrl ?? undefined,
      };
    }));
  },
});

/**
 * Identity-only member list for screens that just need to pick a member
 * (HomeScreen cart, TransactionLogScreen filter). Skips balances and profile
 * image URLs entirely.
 */
export const listBasic = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const members = await ctx.db.query("members").collect();
    return members.map(m => ({
      _id: m._id,
      _creationTime: m._creationTime,
      name: m.name,
      phone: m.phone,
    }));
  },
});

const DEFAULT_HISTORY_LIMIT = 20;

export const getWithHistory = query({
  args: { memberId: v.id("members"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const member = await ctx.db.get(args.memberId);
    if (!member) return null;

    // Read one page of orders, newest first, instead of the member's entire
    // history. Take limit+1 to detect whether a "Muat lagi" page exists without
    // a second query.
    const limit = args.limit ?? DEFAULT_HISTORY_LIMIT;
    const page = await ctx.db
      .query("transactions")
      .withIndex("by_memberId", q => q.eq("memberId", args.memberId))
      .order("desc")
      .take(limit + 1);

    const hasMore = page.length > limit;
    const txs = hasMore ? page.slice(0, limit) : page;

    txs.sort((a, b) => b.timestamp - a.timestamp);

    let windowOutstanding = 0;
    const orders = await Promise.all(txs.map(async (tx) => {
      const pyRows = await ctx.db
        .query("payments")
        .withIndex("by_transactionId", q => q.eq("transactionId", tx._id))
        .collect();
      const recorded = pyRows.reduce((s, p) => s + p.amount, 0);
      const initialPaid = tx.amountPaid ?? tx.totalAmount;
      const balance = Math.max(0, tx.totalAmount - initialPaid - recorded);
      windowOutstanding += balance;

      const rawItems = await ctx.db
        .query("transactionItems")
        .withIndex("by_transactionId", q => q.eq("transactionId", tx._id))
        .collect();
      const items = await Promise.all(rawItems.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        const variant = item.variantId ? await ctx.db.get(item.variantId) : null;
        return {
          productShortName: item.displayName ?? product?.name ?? '?',
          quantity: item.quantity,
          unit: product?.unit ?? 'pcs',
          color: item.displayColor ?? product?.color ?? '#9a9db5',
          plasticSize: variant?.variantValue,
        };
      }));

      return {
        id: tx._id,
        orderNumber: tx.orderNumber,
        date: tx.date,
        timestamp: tx.timestamp,
        total: tx.totalAmount,
        discount: tx.discount ?? 0,
        amountPaid: initialPaid,
        balance,
        items,
      };
    }));

    const profileImageUrl = member.profileImageId
      ? await ctx.storage.getUrl(member.profileImageId)
      : null;
    return {
      member: { ...member, profileImageUrl: profileImageUrl ?? undefined },
      orders,
      // Debt across ALL history, not just the loaded page — read from the
      // denormalized field. Falls back to the loaded window only for rows not
      // yet touched by the backfill.
      totalOutstanding: member.outstanding ?? windowOutstanding,
      totalOrderCount: member.visitCount ?? txs.length,
      hasMore,
    };
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

export const update = mutation({
  args: {
    memberId: v.id("members"),
    name: v.string(),
    phone: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    await ctx.db.patch(args.memberId, { name: args.name, phone: args.phone, color: args.color });
  },
});

export const remove = mutation({
  args: { memberId: v.id("members") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const hasTx = await ctx.db
      .query("transactions")
      .withIndex("by_memberId", q => q.eq("memberId", args.memberId))
      .first();
    if (hasTx) throw new Error("Anggota memiliki riwayat transaksi.");
    await ctx.db.delete(args.memberId);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    return await ctx.storage.generateUploadUrl();
  },
});

export const setProfileImage = mutation({
  args: { memberId: v.id("members"), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const member = await ctx.db.get(args.memberId);
    if (member?.profileImageId) await ctx.storage.delete(member.profileImageId);
    await ctx.db.patch(args.memberId, { profileImageId: args.storageId });
  },
});

export const removeProfileImage = mutation({
  args: { memberId: v.id("members") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const member = await ctx.db.get(args.memberId);
    if (member?.profileImageId) await ctx.storage.delete(member.profileImageId);
    await ctx.db.patch(args.memberId, { profileImageId: undefined });
  },
});
