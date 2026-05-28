# Cashierapp — Agent Handoff

**Date:** 2026-05-28  
**Stack:** React + TypeScript (Vite PWA) · Convex (backend/DB/realtime) · Google Sheets API  
**Repo:** `c:\Users\nicho\Desktop\Cashierapp`  
**Branch:** `main` — all changes below are uncommitted working-tree edits (4 files changed, ~365 insertions)

---

## App overview

Small-business cashier PWA used daily in production (Day 3 live). Indonesian-language UI. Neumorphic design system (`#eef0f5` base, `SHD_RAISED_*` / `SHD_RECESSED` box-shadow constants, no external UI library).

**Key screens:**
| Screen | Path | Notes |
|---|---|---|
| Transaction log | `src/app/pages/TransactionLogScreen.tsx` | Daily view, date navigator, edit/delete, CSV + Sheets export |
| Members list | `src/app/pages/MembersScreen.tsx` | Add/edit/delete members, soft-delete undo toast |
| Member detail | `src/app/pages/MemberDetailScreen.tsx` | Order history for one member — **heavily edited this session** |
| Order detail | `src/app/pages/OrderDetailScreen.tsx` | Payment recording, item list, payment history |
| Stock | `src/app/pages/StockScreen.tsx` | Current stock levels |
| Home | `src/app/pages/HomeScreen.tsx` | Calculator/POS entry point |

**Convex backend** (`convex/`):
- `schema.ts` — single source of truth for all table shapes (read this first)
- `members.ts` — list, getWithHistory, add, update, remove
- `transactions.ts` — listByDate, getDetail, update, remove
- `payments.ts` — record
- `sheetsSync.ts` (Node runtime) — Google Sheets API actions: syncMonth, syncMembers, syncPayments, syncAll
- `sheetsSyncData.ts` (V8 runtime) — internal queries/mutations that feed the Sheets actions
- `stock.ts`, `stockReconcile.ts` — stock management

**Key schema facts:**
- `transactions.amountPaid` — optional; `null` means fully paid at sale time, `0` means unpaid/debt
- `transactions.discount` — optional Rupiah amount subtracted from subtotal
- `transactionItems.displayName` / `displayColor` — override product name/color in UI (used for "eceran" variants)
- `members.color` — optional hex, user-chosen in EditMemberModal color picker
- `stock.minThreshold` + `stock.lastAlertSent` — schema is ready for low-stock alerts (not yet wired to any notification)
- `settings` table has `twilioPhoneNumber`, `waBusinessPhoneId`, `recipientPhone`, `twilioAuthToken` fields — **schema exists but no WhatsApp logic implemented yet**

---

## What was done this session

### 1. `src/app/pages/MemberDetailScreen.tsx` — major rewrite

**Order history grouping by date + search/sort:**
- All React hooks (`useState`, `useMemo`) moved before early returns to fix a "Rendered more hooks than during the previous render" crash.
- `sortedOrders` useMemo: filters by search query (order number, date, product short name, quantity, `{qty}{unit}` e.g. "20kg"), then sorts by newest/oldest/amount.
- `groupedOrders` useMemo: groups into `Map<date, orders[]>` when sort is newest/oldest; returns `null` for amount sort (flat list).
- Date headers rendered above each group (format: "28 Mei 2026").
- Grouped view shows time of day per row; flat view shows formatted date.
- Sort buttons: Terbaru / Terlama / Terbesar (inline, top-right of section).
- Search bar with clear button.

**Product chips:**
- `getWithHistory` in `convex/members.ts` now fetches `transactionItems` for each order and joins `products`/`productVariants` to return `items: [{ productShortName, quantity, unit, color, plasticSize }]`.
- Each order row now leads with colored chips: `{shortName} {qty}kg` for kg items (e.g. "Kedelai 20kg"), `{shortName} {size}` for plastic variants, just `{shortName}` for pcs.
- This directly solves the revision-order identification problem: a client who comes back with weight revisions is now immediately distinguishable in the list by the chip quantity.
- Layout mirrors `TransactionLogScreen`: chips row first, then order# · time · total on second line.

**Minor fixes in the same file:**
- Avatar color now uses `member.color` (DB-stored user choice) with `getAvatarColor(member._id)` as fallback. Previously always re-derived from ID hash, causing mismatch with MembersScreen.
- `AVATAR_COLORS` expanded from 8 to 12 entries to match `MembersScreen.tsx`.
- Order number color changed back to dark `#4a4e69` (was accidentally set to blue `#4a90d9`).
- Added `SHD_RECESSED` and `MONTHS_ID` constants; added `formatDateHeader(isoDate)` and `formatTime(ts)` helpers.

### 2. `convex/sheetsSyncData.ts` — payment balance computation

**`getMonthData`** — paymentDetails now includes `balance: number`:
- Pre-fetches ALL payments (not just month-filtered) sorted by timestamp.
- Pre-fetches all referenced transactions into a cache to avoid N+1 in loop.
- Computes running cumulative sum per `transactionId` in timestamp order.
- `balance = max(0, tx.totalAmount - tx.amountPaid - cumulativePayments)`.
- Cross-month accuracy: a January transaction with a February payment correctly shows the balance after all January payments when viewed in February's sheet.

**`getPaymentsForSync`** — same running-balance computation:
- Batches unique transaction lookups, then member lookups.
- `.map()` (synchronous) over sorted payments with mutable `runningByTx` Map — correct ordering because sort is done before the map.

### 3. `convex/sheetsSync.ts` — Sheets bug fix + payment section improvement

**Bug fix — stale total-row formatting:**
- Previous behavior: when daily transaction count shrank between syncs (e.g. a transaction deleted mid-day), the old total-row dark background (`#2d3142`) and white/italic text persisted on the rows that used to be total rows but are now empty.
- Root cause: `writeTab` clears cell values but not formatting; `applyMonthFormatting` only styled rows in the current grid, never clearing rows beyond `totalRows`.
- Fix: added a blast-clear `repeatCell` request at the start of `applyMonthFormatting` that resets `backgroundColor` (white) and `textFormat` (`bold:false, italic:false`) for rows 1 to `max(totalRows + 100, 200)` across all tx columns (A–K). This fires before any per-row styling so stale rows beyond the current grid are always wiped.

**Payment section — added "Sisa" (balance) column:**
- Monthly tab: payment section expanded from Q–V (6 cols) to Q–W (7 cols). Header updated. `PAYMENT_COLS` constant: 6 → 7.
- Standalone "Payments" tab: header updated, grid row gets 7th element `Math.round(p.balance)`.
- Currency format: `"Rp "#,##0;;` (blank-zero pattern so fully-paid rows show blank instead of Rp 0).
- Conditional formatting: green (#34a853, bold) when Sisa = 0 (Lunas); amber (#d4a017, bold) when Sisa > 0.
- `applyPaymentsFormatting` signature updated: now takes `existingRuleCount` and deletes stale rules before adding new ones (prevents rule accumulation on repeat syncs).
- Column widths array updated (added col W = 100px).
- Payment table border range updated: `endColumnIndex` 22 → 23.

---

## What's NOT done yet — pending features

### A. WhatsApp stock reminders (user wants: low-stock alert + daily morning summary)

**Schema is already ready** — `settings` table has all the fields (`waBusinessPhoneId`, `recipientPhone`, `twilioPhoneNumber`, `twilioAuthToken`). Stock table has `minThreshold` and `lastAlertSent`.

**What's needed:**
1. Choose an API provider — Meta Cloud API (free but needs FB Business verification, takes days) or Twilio WhatsApp sandbox (easy setup, ~$0.005/message). User hasn't decided yet.
2. A Convex scheduled action (`"use node"` runtime) using `api.system.scheduler` or a cron:
   - **Low-stock alert**: trigger inside `stock.ts` mutations after decrement — if `quantity < minThreshold` and `lastAlertSent` is older than N hours, send and update `lastAlertSent`.
   - **Daily summary**: cron at ~06:00 WIB (UTC+7 = 23:00 UTC prev day) calling a Sheets-style Node action that reads all stock rows and POSTs to WhatsApp API.
3. A UI in `UserScreen.tsx` or a new Settings screen to configure `recipientPhone` and toggle alerts.

**Implementation note:** WhatsApp message body should be in Indonesian, use stock `minThreshold` as the alert level, and respect `lastAlertSent` to avoid spamming.

### B. Profile picture (device photo upload)

User wants camera/gallery upload, not URL-based.

**What's needed:**
1. Enable Convex file storage: `npx convex storage` to verify it's provisioned on the project.
2. Schema: add `profileImageId: v.optional(v.id("_storage"))` to the `members` table (migration needed — `convex/migrations.ts` already has migration patterns to follow).
3. Backend:
   - New mutation `members.generateUploadUrl` → calls `ctx.storage.generateUploadUrl()`, returns URL.
   - New mutation `members.setProfileImage(memberId, storageId)` → patches the member.
   - New query `members.getProfileImageUrl(storageId)` → calls `ctx.storage.getUrl(storageId)`.
4. Frontend in `MembersScreen.tsx` `EditMemberModal`:
   - Add `<input type="file" accept="image/*" capture="environment">` (or `capture="user"` for selfie).
   - On change: call `generateUploadUrl`, `fetch(url, { method: 'PUT', body: file })`, then `setProfileImage`.
   - Show image in the avatar `<div>` instead of initials when `profileImageId` is set.
   - Also update avatar display in `MemberDetailScreen.tsx` member card.
5. Consider image size limits — Convex storage supports up to 1GB per file but mobile photos are large; add client-side canvas resize before upload (target ~400×400px).

---

## Design system cheatsheet

```
Background:     #eef0f5
Text primary:   #2d3142
Text secondary: #4a4e69
Text muted:     #9a9db5
Text dimmed:    #c0c4d0
Accent blue:    #4a90d9
Accent green:   #52b96a
Accent red:     #d4183d
Accent amber:   #d4a017

SHD_RAISED_STD    = '4px 4px 9px #c8cad1, -4px -4px 9px #ffffff'
SHD_RAISED_LIST   = '3px 3px 7px #c8cad1, -3px -3px 7px rgba(255,255,255,0.92)'
SHD_RAISED_STRONG = '5px 5px 12px #c8cad1, -5px -5px 12px #ffffff'
SHD_RECESSED      = 'inset 3px 3px 7px #c8cad1, inset -3px -3px 7px #ffffff'
SHD_ACTION_RAISED = '4px 4px 10px rgba(0,0,0,0.16), -3px -3px 8px rgba(255,255,255,0.5)'
SHD_ACTION_PRESS  = 'inset 3px 3px 8px rgba(0,0,0,0.22), inset -2px -2px 5px rgba(255,255,255,0.15)'
```

CSS custom properties set at app level:
- `--app-page-gutter` — horizontal padding for all screens
- `--app-content-bottom` — bottom padding to clear the nav bar
- `--app-visual-height` / `--app-visual-offset-top` — used by modals to fill the visual viewport (important for iOS PWA keyboard behaviour)

**Flex scroll pattern (IMPORTANT):** Scroll containers use `flex: 1; min-height: 0; overflow-y: auto`. Children **must** have `flexShrink: 0` or items squish and scroll never activates. This is a known footgun in this codebase.

---

## Environment / secrets

Convex env vars (set in Convex dashboard, not `.env`):
- `GOOGLE_SERVICE_ACCOUNT_JSON` — full JSON of GCP service account
- `GOOGLE_SHEET_ID` — target spreadsheet ID

Not yet set (needed for WhatsApp):
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` (if using Twilio)
- `META_WHATSAPP_TOKEN` / `META_PHONE_NUMBER_ID` (if using Meta Cloud API)

---

## Build / dev commands

```bash
npm run dev          # Vite dev server + Convex dev in parallel
npx vite build       # Production build (used to verify no TS errors — no tsc binary installed)
npx convex dev       # Convex backend only
```
