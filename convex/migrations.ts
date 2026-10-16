import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { transactionBalance } from "./memberStats";

/**
 * One-time backfill: mark old eceran transactionItems with displayName/displayColor.
 *
 * Criteria (both must match):
 *   1. product.unit === 'kg'  (soybean item)
 *   2. item.quantity < 10     (eceran threshold)
 *   3. parent transaction has no memberId  (all eceran buyers were unknown)
 *
 * Run once from the Convex dashboard → Functions → migrations:backfillEceranDisplay → Run.
 */
export const backfillEceranDisplay = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allItems = await ctx.db.query("transactionItems").collect();

    let scanned = 0;
    let updated = 0;

    for (const item of allItems) {
      scanned++;

      // Already has a display override — skip
      if (item.displayName !== undefined) continue;

      // Only soybean (kg) items
      const product = await ctx.db.get(item.productId);
      if (!product || product.unit !== "kg") continue;

      // Eceran threshold
      if (item.quantity >= 10) continue;

      // Extra safety: eceran buyers were always anonymous
      const tx = await ctx.db.get(item.transactionId);
      if (tx?.memberId) continue;

      await ctx.db.patch(item._id, {
        displayName: "E",
        displayColor: "#9b6dff",
      });
      updated++;
    }

    return { scanned, updated };
  },
});

const BACKFILL_PAGE = 500;

/**
 * Recompute every member's denormalized stats (outstanding, visitCount,
 * lastVisitDate) from source rows, correcting any drift in the values the
 * mutations maintain by delta. Runs nightly from crons.ts; safe to re-run.
 *
 * Walks members one at a time (by creation order) and each member's
 * transactions one page at a time, scheduling itself for the next page or
 * member. No single run reads more than BACKFILL_PAGE transactions, however
 * long a member's history grows. Totals for a member spanning several pages are
 * carried in `inProgress`.
 *
 * Start it with no args (Functions → migrations:backfillMemberStats → Run); the
 * rest of the chain runs in the background. Confirm with
 * migrations:checkMemberStatsBackfill.
 */
export const backfillMemberStats = internalMutation({
  args: {
    // _creationTime of the last member fully processed — continue after it.
    after: v.optional(v.number()),
    inProgress: v.optional(v.object({
      memberId: v.id("members"),
      cursor: v.string(),
      outstanding: v.number(),
      visitCount: v.number(),
      lastTimestamp: v.number(),
      lastVisitDate: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const continuing = args.inProgress ? await ctx.db.get(args.inProgress.memberId) : null;
    const progress = continuing ? args.inProgress : undefined;
    // Not mid-member (or that member was deleted mid-run): take the next one.
    const member = continuing ?? await ctx.db
      .query("members")
      .withIndex("by_creation_time", q => q.gt("_creationTime", args.after ?? 0))
      .first();
    if (!member) return { done: true };

    const page = await ctx.db
      .query("transactions")
      .withIndex("by_memberId", q => q.eq("memberId", member._id))
      .paginate({ cursor: progress?.cursor ?? null, numItems: BACKFILL_PAGE });

    // Look up every transaction's payments concurrently.
    const balances = await Promise.all(page.page.map(tx => transactionBalance(ctx, tx)));
    const outstanding = (progress?.outstanding ?? 0) + balances.reduce((s, b) => s + b, 0);
    const visitCount = (progress?.visitCount ?? 0) + page.page.length;
    let lastTimestamp = progress?.lastTimestamp ?? -1;
    let lastVisitDate = progress?.lastVisitDate;
    for (const tx of page.page) {
      if (tx.timestamp > lastTimestamp) {
        lastTimestamp = tx.timestamp;
        lastVisitDate = tx.date;
      }
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillMemberStats, {
        after: args.after,
        inProgress: {
          memberId: member._id,
          cursor: page.continueCursor,
          outstanding,
          visitCount,
          lastTimestamp,
          lastVisitDate,
        },
      });
      return { done: false, member: member.name };
    }

    await ctx.db.patch(member._id, { outstanding, visitCount, lastVisitDate });
    await ctx.scheduler.runAfter(0, internal.migrations.backfillMemberStats, {
      after: member._creationTime,
    });
    return { done: false, member: member.name };
  },
});

/**
 * One-time cleanup: delete payments whose transaction no longer exists.
 * transactions.remove used to leave them behind; it now deletes them.
 * Returns the deleted rows so the result can be checked.
 */
export const deleteOrphanPayments = internalMutation({
  args: {},
  handler: async (ctx) => {
    const txIds = new Set((await ctx.db.query("transactions").collect()).map(tx => tx._id));
    const payments = await ctx.db.query("payments").collect();
    const orphans = payments.filter(p => !txIds.has(p.transactionId));
    for (const p of orphans) {
      await ctx.db.delete(p._id);
    }
    return orphans.map(p => ({ date: p.date, amount: p.amount, transactionId: p.transactionId }));
  },
});

/**
 * Verification helper for backfillMemberStats. Reports how many members still
 * have no denormalized stats. Run it after the backfill — missing should be 0.
 *
 * Worth checking explicitly: the members list sorts un-backfilled members to the
 * bottom (they read as Rp 0), so a partial backfill looks fine on screen.
 */
export const checkMemberStatsBackfill = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("members").collect();
    const missing = all.filter(m => m.outstanding === undefined);
    return {
      total: all.length,
      backfilled: all.length - missing.length,
      missing: missing.length,
      done: missing.length === 0,
      missingNames: missing.slice(0, 10).map(m => m.name),
    };
  },
});
