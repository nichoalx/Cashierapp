import { internalMutation } from "./_generated/server";

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
