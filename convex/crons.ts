import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Nightly self-heal for the denormalized member stats.
 *
 * The mutations keep outstanding/visitCount/lastVisitDate current by delta on
 * every normal write. This catches anything that bypasses or drifts from them —
 * most commonly an edit made directly in the Convex dashboard's Data tab, which
 * runs no mutation and so leaves the cached values stale.
 *
 * Recomputes from source, so it is safe to run repeatedly. Runs at 02:00 WIB
 * (19:00 UTC) while the shop is closed — a write landing mid-run could be
 * overwritten by the page-by-page totals until the next night.
 */
crons.daily(
  "backfill member stats",
  { hourUTC: 19, minuteUTC: 0 },
  internal.migrations.backfillMemberStats,
  {},
);

/**
 * Closing stock snapshot for the Sheets stock column, at 23:55 WIB (16:55 UTC).
 * Only fills products with no snapshot row today, so manual corrections made
 * with sheetsSyncData:setSnapshotQuantity are kept.
 */
crons.daily(
  "closing stock snapshot",
  { hourUTC: 16, minuteUTC: 55 },
  internal.sheetsSyncData.takeSnapshotIfMissing,
  {},
);

/**
 * Nightly Sheets sync at 23:58 WIB (16:58 UTC), right after the closing
 * snapshot, so each day's final orders, payments and stock land in that month's
 * tab. Without it a month's last day never reached the sheet: after midnight
 * the in-app Sync button only syncs the new month.
 */
crons.daily(
  "nightly sheets sync",
  { hourUTC: 16, minuteUTC: 58 },
  internal.sheetsSync.syncInternal,
  {},
);

export default crons;
