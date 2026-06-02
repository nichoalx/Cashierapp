# Handoff: Google Sheets sync fails with `500 INTERNAL` on the current-month tab

## ✅ RESOLVED

**Root cause:** a **stale merged range** left on the June tab. `writeTab` did
`values.clear` (which removes values but NOT merges) then `values.update`.
`applyMonthFormatting` (runs after writeTab) merges date-header / multi-row cells;
those merges persist into the next sync. Once June's layout/data shifted, a stale
merge landed across row 19, and `values.update` cannot write across a merged range
— Google returned a bare `500 INTERNAL`.

**Proof:** row 19's exact data failed 6/6 at its real position (`A19`) but
succeeded 6/6 at a scratch cell (`A1`) → positional, not content.

**Immediate fix (done by user):** deleted the June tab and let the sync recreate
it fresh (no stale merges).

**Permanent fix (in code):** `writeTab` now issues `unmergeCells` over the whole
tab BEFORE writing values; `applyMonthFormatting` re-applies merges afterward. The
diagnostic harness (bisect / probe / structure inspection) has been removed.

Everything below is the original investigation, kept for reference.

---

> Looking for a second opinion. Below is the issue, every hypothesis tried, the
> hard evidence collected, and what remains uncertain.

## ⚠️ CRITICAL UPDATE (read this first)

Two earlier conclusions in this doc turned out to be **wrong**, do not trust them:

1. **Column-overflow theory is DISPROVEN.** Logs confirm the June tab is
   `1000r×27c` — it already has 27 columns. `ensureGridSize` logs
   `already fits 188r×27c`. So it is NOT a grid-dimension problem.

2. **The "poison rows" (19/22/23) and "poison cells" (cols 23–26) were
   RATE-LIMIT ARTIFACTS, not real.** The bisect + 27-cell column-isolation probe
   fired dozens of `values.update` calls within seconds and exhausted Google's
   ~60 writes/min quota. Once exhausted, *every* subsequent write fails — which is
   why the probe absurdly reported that writing `0` or `""` to `A1` "fails alone",
   and why the poison-row set changed between runs (3 then 2). Ignore those.

**The one reliable fact:** the single full-grid `values.update` of **188×27 RAW**
fails with a real `500 INTERNAL` on the *first* write of a run (only `clear`
precedes it, so it is not rate-limited). The grid fits the tab. ~5,076 cells is
trivial for Sheets, so a size limit is not plausible either.

**Current approach (latest code):** `writeTab` now writes the grid in **20-row
bands** (~10–11 total writes, well under quota). Either (a) all bands succeed →
the bug was a whole-request quirk and chunking is the fix, or (b) one band fails
reproducibly with a low call count → a *trustworthy* localization to ~20 rows,
which can then be narrowed with a paced probe. **Not yet test-run.**

---


## Summary

`convex/sheetsSync.ts` syncs transaction data to a Google Sheet. The action
`syncAll` (→ `doSyncMonth` → `writeTab`) fails **deterministically** when writing
the **June 2026** tab. Google returns a bare HTTP 500:

```
[update June 2026 (188r×27c)] Google Sheets API failed after 4 attempt(s):
http=500 code=500 status=INTERNAL message="Internal error encountered."
```

It started failing this month (June). Earlier months synced fine. NOTE: `syncAll`
only ever syncs the **current** month, so we have NOT confirmed whether other
months would also fail right now.

## The write that fails

In `writeTab` (`convex/sheetsSync.ts`):

1. `spreadsheets.values.clear({ range: "'June 2026'" })` — **succeeds**.
2. `spreadsheets.values.update({ range: "'June 2026'!A1", valueInputOption: "RAW", requestBody: { values: grid } })` — **fails** with the 500 above.

The grid is **188 rows × 27 columns** (~5,000 cells — trivially small).

## Hard evidence (collected via a bisect/probe harness added to `writeTab`)

- **Not Google being down / not the spreadsheet being dead.** A 1-cell probe
  write (`[["sync probe"]]` → `A1`) **succeeds** even while the full grid fails.
  `clear` (also a write op) succeeds too.
- **Not transient.** 100% reproducible across ~10 min and many attempts (plus 4
  internal backoff retries per attempt).
- **Not a bad string char or over-length cell.** We sanitize every cell: strip
  lone UTF-16 surrogates, strip C0/C1 control chars (keep tab/newline/CR), cap
  length at 40k. No change.
- **Not `NaN`/`Infinity`/`null`/`undefined`.** Sanitization coerces non-finite
  numbers and nullish to `""`. No change. The source query
  (`convex/sheetsSyncData.ts`) also guards every field with `?? 0` / `?? ""`, and
  schema numeric fields are all `v.number()`.
- **Row bisection** isolated exactly **3 "poison" rows** that fail even written
  alone (one 27-cell row at its real `A{n}` position):

  ```
  row 19: [10,"08.18","Mr. Bean",45,"kg",10300,463500,"",463500,"Harto","","","P 13x25",444,-5,"",37,"2026-05-29","Pendi (Bola)",1582500,0,"2026-06-01",1582500,0,"","",""]
  row 22: ["","","Tempe",1,"pcs",14000,14000,"","","","","","P 14x20",602,-7,"",45,"2026-05-29","Hendri",1055000,0,"2026-06-01",1055000,0,"","",""]
  row 23: [13,"08.23","SBS",23,"kg",10300,236900,"",236900,"Budi","","","P 14x25",1362,-5,"",3,"2026-05-30","Saimah",185400,0,"2026-06-01",176000,9400,"","",""]
  ```

- **Column isolation on a poison row:** writing **each of its 27 cells
  individually to `A1`** all **succeed**. Harness conclusion:

  ```
  every cell of row 19 writes fine alone → failure is combinatorial (row shape), not a single value.
  ```

### Leading hypothesis (UNVERIFIED at time of writing)

Single cells written to **`A1`** (column A) always succeed. A full 27-cell row
written at `A19` spans **`A19:AA19` — columns A–AA (27 columns)**. The combination
failing while every individual cell succeeds is the classic signature of **the tab
having fewer than 27 columns**: `values.update` does NOT auto-grow the grid, and
writing past the last column appears to return — for this spreadsheet — a bare
`500 INTERNAL` rather than the usual `400 "exceeds grid limits"`.

Why June specifically: the layout is a fixed **27 columns** (A–AA). The last two
columns (Z, AA) are the "price history" section, which seems to have pushed the
layout from ≤26 to 27 columns at some point. Existing month tabs were silently
widened to 27 by later `batchUpdate` **formatting** passes (which DO auto-expand
the grid). **June is the first brand-new tab created since the layout exceeded 26
columns**, and a newly-created tab defaults to **26 columns (A–Z)**. Its first
`values.update` of 27 columns overflows.

**Caveat that weakens the theory:** an earlier `ensureGridSize` fix that expands
the tab BEFORE writing did NOT resolve it (see Fix #4). If columns were the whole
story, that should have worked. Either the column count it read was wrong, the
`updateSheetProperties` didn't take effect, or columns are not actually the cause.

## Grid column layout (27 cols, A–AA) — built in `buildMonthGrid`

| Cols | Index | Section |
|------|-------|---------|
| A–K  | 0–10  | Transaction (Order, Time, Product, Qty, Unit, Unit Price, Item Total, Discount, Tx Total, Member, Remarks) |
| L    | 11    | gap |
| M–O  | 12–14 | Stock (label, amount, Δ) |
| P    | 15    | gap |
| Q–X  | 16–23 | Payments (Order #, Tx Date, Member, Tx Total, Dibayar Awal, Payment Date, Amount, Sisa) |
| Y    | 24    | gap |
| Z–AA | 25–26 | Price history (label, price) |

Header row and every data row are both 27 wide.

## Fixes attempted (in order)

1. **Retry with backoff** (`withRetry`, 4 attempts). No effect — error is
   deterministic. Kept (harmless).
2. **Richer error extraction** (`describeGoogleError`) — pulls
   `response.data.error` (http/code/status/message/details) from the GaxiosError
   instead of the bare `.message`. This is what made the bug legible. Kept.
3. **Cell sanitization** — NaN/Infinity/null→`""`, strip surrogates/control chars,
   cap length 40k. No effect; kept as hardening.
4. **`ensureGridSize` v1** — expand the tab's grid before writing, using a
   `columnCount` obtained from `ensureTab` (which read it via `spreadsheets.get`
   WITHOUT explicit `fields`, and from the `addSheet` reply). **Did NOT fix it.**
   This is the central mystery if the column theory is right.
5. **`ensureGridSize` v2 (latest, NOT yet test-run)** — re-fetches ground-truth
   dimensions with explicit
   `fields: "sheets(properties(sheetId,gridProperties(rowCount,columnCount)))"`,
   logs current-vs-needed, expands to `neededCols + 3` cols / `neededRows + 200`
   rows. Expected next-run log:
   `[ensureGridSize] sheet <id>: expanding 188r×26c → 388r×30c (need 188r×27c)`.

## Open questions for a fresh perspective

1. **Is column overflow really the cause?** `ensureGridSize` v2 should confirm: if
   June logs `<27c`, expands, and the write then succeeds → solved. If June logs
   `≥27c already fits` and the write STILL fails → theory is wrong.
2. **Why did `ensureGridSize` v1 not work?** If columns are the cause, v1's expand
   should have fixed it. Did `spreadsheets.get` (no `fields`) omit
   `gridProperties`? Report a stale/oversized `columnCount`? Did
   `updateSheetProperties` silently not apply? **Worth checking June's actual
   column count directly in the Sheets UI.**
3. **If NOT columns:** what else makes a single 27-cell RAW row write fail with
   `500 INTERNAL` while each cell writes fine alone to `A1`? Candidates: a
   per-request quirk, a protected-range / named-range conflict on June's tab, a
   conditional-format rule referencing a non-existent column, or leftover state
   from a partial `applyMonthFormatting`.
4. **Could prior partial runs have corrupted June's tab?** On the first failed
   run, `ensureTab` created June, `writeTab` failed, so `applyMonthFormatting`
   never ran — but the bisect harness has since written partial rows + probes into
   June. Could residual merges / conditional formats / protected ranges cause this?
5. **Is `500 INTERNAL` on column overflow even plausible for this API?** Google
   usually returns `400 INVALID_ARGUMENT "... exceeds grid limits"`. A bare 500 is
   unusual — does that point away from columns toward something else?

## Key files / locations

- `convex/sheetsSync.ts` (Node `"use node"` runtime)
  - `withRetry`, `describeGoogleError` — retry + error extraction
  - `ensureTab` — create/locate the month tab
  - `ensureGridSize` — expand grid before write (v2, unverified)
  - `writeTab` — clear + update; **contains temporary bisect/probe/column-isolation
    diagnostic harness** that issues many extra API calls on the failure path
    (trim once root cause is fixed; risks Sheets write rate limits)
  - `bisectWrite` — row bisection helper
  - `buildMonthGrid` — builds the 27-col grid
  - `applyMonthFormatting` — runs AFTER `writeTab`; uses `batchUpdate` (auto-expands grid)
  - `doSyncMonth` — orchestrates ensureTab → ensureGridSize → writeTab → formatting
- `convex/sheetsSyncData.ts` (V8 runtime) — queries supplying the data (well-guarded)
- `convex/schema.ts` — `transactions`, `transactionItems`, `payments`

## Reproduce / test

Trigger the sync from the app (Transaction Log → Export carousel slide → Sheets
button) or call the `sheetsSync:syncAll` Convex action. Watch the Convex logs for
the `[ensureGridSize]` and `[writeTab June 2026]` lines.

Env vars (Convex dashboard): `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEET_ID`.
