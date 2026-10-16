import { MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

// Member stats (outstanding, visitCount, lastVisitDate) are denormalized onto
// the member document. Writes keep them current by applying deltas for just the
// rows they touch — never by rescanning the member's history, which timed out
// for members with ~1,500+ orders. The nightly migrations:backfillMemberStats
// cron recomputes everything from source to correct any drift.

/** Unpaid balance of a transaction given its recorded payments. */
export function unpaidBalance(tx: Doc<"transactions">, payments: Doc<"payments">[]) {
  const recorded = payments.reduce((s, p) => s + p.amount, 0);
  const initialPaid = tx.amountPaid ?? tx.totalAmount;
  return Math.max(0, tx.totalAmount - initialPaid - recorded);
}

/** Unpaid balance of one transaction, net of the checkout payment and every recorded payment. */
export async function transactionBalance(ctx: MutationCtx, tx: Doc<"transactions">) {
  const pyRows = await ctx.db
    .query("payments")
    .withIndex("by_transactionId", q => q.eq("transactionId", tx._id))
    .collect();
  return unpaidBalance(tx, pyRows);
}

/**
 * Shift a member's stored outstanding / visitCount by the given deltas and
 * refresh lastVisitDate from their newest remaining transaction.
 *
 * Transactions are always inserted with timestamp = Date.now(), so creation
 * order is timestamp order and the by_memberId index's last row is the latest
 * visit.
 *
 * No-ops on undefined (walk-in transactions have no member) or a member that
 * has already been deleted.
 */
export async function adjustMemberStats(
  ctx: MutationCtx,
  memberId: Id<"members"> | undefined,
  delta: { outstanding: number; visits: number },
) {
  if (!memberId) return;
  const member = await ctx.db.get(memberId);
  if (!member) return;

  const latest = await ctx.db
    .query("transactions")
    .withIndex("by_memberId", q => q.eq("memberId", memberId))
    .order("desc")
    .first();

  await ctx.db.patch(memberId, {
    outstanding: (member.outstanding ?? 0) + delta.outstanding,
    visitCount: (member.visitCount ?? 0) + delta.visits,
    lastVisitDate: latest?.date,
  });
}

/**
 * Run `change` (a write to one transaction's payments) and shift the member's
 * stored outstanding by however much that transaction's balance moved.
 */
export async function adjustOutstandingAround<T>(
  ctx: MutationCtx,
  transactionId: Id<"transactions">,
  change: () => Promise<T>,
): Promise<T> {
  const tx = await ctx.db.get(transactionId);
  if (!tx?.memberId) return change();

  const before = await transactionBalance(ctx, tx);
  const result = await change();
  const after = await transactionBalance(ctx, tx);

  if (after !== before) {
    await adjustMemberStats(ctx, tx.memberId, { outstanding: after - before, visits: 0 });
  }
  return result;
}
