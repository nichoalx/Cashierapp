import { MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Recompute and persist a member's denormalized stats (outstanding, visitCount,
 * lastVisitDate) onto the member document.
 *
 * Call this from every mutation that can change them: transaction create /
 * update / remove and payment record. Recomputing from source (rather than
 * applying deltas) keeps the values self-healing — a missed call is corrected
 * by the next write touching that member.
 *
 * The math here is intentionally identical to what members.list used to do
 * inline, so values are unchanged; they're just computed on write instead of
 * on every read.
 *
 * No-ops on undefined (walk-in transactions have no member) or a member that
 * has already been deleted.
 */
export async function recomputeMemberStats(
  ctx: MutationCtx,
  memberId: Id<"members"> | undefined | null,
) {
  if (!memberId) return;
  const member = await ctx.db.get(memberId);
  if (!member) return;

  const txs = await ctx.db
    .query("transactions")
    .withIndex("by_memberId", q => q.eq("memberId", memberId))
    .collect();

  let outstanding = 0;
  let lastVisitDate: string | undefined;
  let lastTimestamp = -1;

  for (const tx of txs) {
    const initialPaid = tx.amountPaid ?? tx.totalAmount;
    const pyRows = await ctx.db
      .query("payments")
      .withIndex("by_transactionId", q => q.eq("transactionId", tx._id))
      .collect();
    const recorded = pyRows.reduce((s, p) => s + p.amount, 0);
    outstanding += Math.max(0, tx.totalAmount - initialPaid - recorded);

    if (tx.timestamp > lastTimestamp) {
      lastTimestamp = tx.timestamp;
      lastVisitDate = tx.date;
    }
  }

  await ctx.db.patch(memberId, {
    outstanding,
    visitCount: txs.length,
    lastVisitDate,
  });
}
