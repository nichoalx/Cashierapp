import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Nightly self-heal for the denormalized member stats.
 *
 * The mutations keep outstanding/visitCount/lastVisitDate current on every
 * normal write. This catches anything that bypasses them — most commonly an
 * edit made directly in the Convex dashboard's Data tab, which runs no
 * mutation and so leaves the cached values stale.
 *
 * Recomputes from source, so it is safe to run repeatedly. Runs at 02:00 WIB
 * (19:00 UTC) while the shop is closed.
 */
crons.daily(
  "backfill member stats",
  { hourUTC: 19, minuteUTC: 0 },
  internal.migrations.backfillMemberStats,
  {},
);

export default crons;
