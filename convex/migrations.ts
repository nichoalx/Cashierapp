import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { recomputeMemberStats } from "./memberStats";

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

/**
 * One-time backfill: populate the denormalized member stats (outstanding,
 * visitCount, lastVisitDate) introduced to stop members:list from scanning the
 * whole transaction + payment history on every read.
 *
 * Safe to re-run — recomputeMemberStats() derives every value from source rows,
 * so running it twice produces the same result.
 *
 * Processes members in batches to stay under the 4096-read limit. Run repeatedly
 * from the Convex dashboard (Functions → migrations:backfillMemberStats → Run)
 * until it returns done: true, passing the returned cursor back as `after`.
 */
export const backfillMemberStats = internalMutation({
  args: { after: v.optional(v.id("members")), batchSize: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 25;
    const all = await ctx.db.query("members").collect();

    const startIndex = args.after
      ? all.findIndex(m => m._id === args.after) + 1
      : 0;
    const batch = all.slice(startIndex, startIndex + batchSize);

    for (const member of batch) {
      await recomputeMemberStats(ctx, member._id);
    }

    const nextIndex = startIndex + batch.length;
    const done = nextIndex >= all.length;
    const cursor = done ? null : batch[batch.length - 1]?._id ?? null;

    // Chain the next batch automatically so a single Run backfills everyone.
    // Each batch is its own transaction, so the 4096-read limit applies per
    // batch rather than to the whole job.
    if (!done && cursor) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillMemberStats, {
        after: cursor,
        batchSize,
      });
    }

    return {
      updated: batch.length,
      processed: nextIndex,
      total: all.length,
      done,
      cursor,
      // The remaining batches run in the background right after this returns.
      // Use migrations:checkMemberStatsBackfill to confirm completion.
      continuing: !done,
    };
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
