"use node";

import { google } from "googleapis";
import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

// Node.js-runtime file: Google Sheets API calls. Only actions are permitted here.
// Internal queries/mutations live in `sheetsSyncData.ts` (V8 runtime).

// ─── Sheet writer plumbing ───────────────────────────────────────────────────

// Pull the full detail out of a googleapis GaxiosError. The bare `.message`
// ("Internal error encountered.") hides the HTTP code/status and any descriptive
// reason Google returned, so we surface those for diagnosis.
function describeGoogleError(e: unknown): string {
  const err = e as {
    message?: string;
    code?: string | number;
    response?: { status?: number; data?: { error?: { code?: number; status?: string; message?: string; details?: unknown } } };
    errors?: unknown;
  };
  const g = err?.response?.data?.error;
  const parts: string[] = [];
  if (err?.response?.status) parts.push(`http=${err.response.status}`);
  if (g?.code) parts.push(`code=${g.code}`);
  if (g?.status) parts.push(`status=${g.status}`);
  if (g?.message) parts.push(`message="${g.message}"`);
  else if (err?.message) parts.push(`message="${err.message}"`);
  if (g?.details) parts.push(`details=${JSON.stringify(g.details)}`);
  else if (err?.errors) parts.push(`errors=${JSON.stringify(err.errors)}`);
  return parts.length ? parts.join(" ") : String(e);
}

async function withRetry<T>(fn: () => Promise<T>, label = "sheets", maxAttempts = 4): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const detail = describeGoogleError(e);
      const status = (e as { response?: { status?: number } })?.response?.status;
      const retryable = status === 429 || status === 500 || status === 503
        || detail.includes("Internal error") || detail.includes("Rate Limit") || detail.includes("UNAVAILABLE");
      if (!retryable || attempt === maxAttempts - 1) {
        throw new Error(`[${label}] Google Sheets API failed after ${attempt + 1} attempt(s): ${detail}`);
      }
      await new Promise(r => setTimeout(r, 800 * 2 ** attempt));
    }
  }
  throw new Error("unreachable");
}

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function tabNameForMonth(yearMonth: string): string {
  const [yStr, mStr] = yearMonth.split("-");
  const m = parseInt(mStr, 10);
  return `${MONTH_LABELS[m - 1]} ${yStr}`;
}

function formatDateDMY(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}-${m}-${y}`;
}

function previousDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 1, day));
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}

function getSheetsClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON env var is not set on Convex.");
  if (!sheetId) throw new Error("GOOGLE_SHEET_ID env var is not set on Convex.");

  let creds: { client_email: string; private_key: string };
  try {
    creds = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.");
  }
  if (!creds.client_email || !creds.private_key) {
    throw new Error("Service account JSON missing client_email or private_key.");
  }

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  return { sheets, sheetId };
}

async function ensureTab(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  title: string,
): Promise<{ sheetId: number; existingRuleCount: number }> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets?.find(s => s.properties?.title === title);
  if (existing) {
    return {
      sheetId: existing.properties!.sheetId!,
      existingRuleCount: existing.conditionalFormats?.length ?? 0,
    };
  }
  const res = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });
  const props = res.data.replies![0].addSheet!.properties!;
  return {
    sheetId: props.sheetId!,
    existingRuleCount: 0,
  };
}

// `values.update` does not grow the grid, so writing past a tab's current
// row/column bounds fails with a bare 500 INTERNAL. Expand the tab first when
// the grid we're about to write is larger than the tab's current dimensions.
// Reads ground-truth dimensions itself rather than trusting a passed-in value.
async function ensureGridSize(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  sheetId: number,
  neededRows: number,
  neededCols: number,
): Promise<void> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,gridProperties(rowCount,columnCount)))",
  });
  const props = meta.data.sheets?.find(s => s.properties?.sheetId === sheetId)?.properties?.gridProperties;
  const curRows = props?.rowCount ?? 0;
  const curCols = props?.columnCount ?? 0;
  if (curRows >= neededRows && curCols >= neededCols) return;
  const targetRows = Math.max(curRows, neededRows + 200);
  const targetCols = Math.max(curCols, neededCols + 3);
  console.log(`[ensureGridSize] sheet ${sheetId}: expanding ${curRows}r×${curCols}c → ${targetRows}r×${targetCols}c (need ${neededRows}r×${neededCols}c)`);
  await withRetry(() => sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        updateSheetProperties: {
          properties: { sheetId, gridProperties: { rowCount: targetRows, columnCount: targetCols } },
          fields: "gridProperties.rowCount,gridProperties.columnCount",
        },
      }],
    },
  }), `resize sheet ${sheetId} → ${targetCols}c`);
}

async function writeTab(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  title: string,
  values: (string | number)[][],
  tabSheetId: number,
  valueInputOption: "RAW" | "USER_ENTERED" = "RAW",
): Promise<void> {
  await withRetry(() => sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${title}'`,
  }), `clear ${title}`);
  if (values.length === 0) return;

  // `values.clear` removes values but NOT merges. applyMonthFormatting (which runs
  // AFTER this) merges date-header / multi-row cells; those merges persist into the
  // next sync, and once the layout/data shifts a stale merge can land across a row
  // we then try to write — which Google rejects with a bare 500 INTERNAL. Unmerge
  // the whole tab before writing values; formatting re-applies its merges after.
  await withRetry(() => sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ unmergeCells: { range: { sheetId: tabSheetId } } }] },
  }), `unmerge ${title}`);

  // Coerce every cell to a clean primitive Google will accept (defensive against a
  // NaN/Infinity/null cell, lone surrogate, control char, or over-long string).
  const safe = values.map(row => row.map(cell => {
    if (typeof cell === "number") return Number.isFinite(cell) ? cell : "";
    if (typeof cell === "string") return sanitizeCellString(cell);
    return cell == null ? "" : sanitizeCellString(String(cell));
  }));

  await withRetry(() => sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${title}'!A1`,
    valueInputOption,
    requestBody: { values: safe },
  }), `update ${title} (${safe.length}r×${safe[0]?.length ?? 0}c)`);
}

// Strip the things Google's Sheets API can choke on in a RAW string cell:
// lone surrogates → replacement char, C0/C1 control chars (keep tab/newline/CR),
// and cap length well under the 50k-char per-cell limit.
function sanitizeCellString(s: string): string {
  let out = s
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "�")
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "�")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  if (out.length > 40000) out = out.slice(0, 40000);
  return out;
}

async function readStockAmountsFromSheet(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  date: string,
): Promise<Map<string, number> | null> {
  const tab = tabNameForMonth(date.slice(0, 7));
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${tab}'!M:O`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const rows = res.data.values ?? [];
    const quantities = new Map<string, number>();
    let inDateBlock = false;

    for (const row of rows) {
      const label = row[0] == null ? "" : String(row[0]).trim();
      const amount = row[1];
      const isDateHeader = /^\d{4}-\d{2}-\d{2}$/.test(label) && row[1] === "AMOUNT";

      if (isDateHeader) {
        if (inDateBlock) break;
        inDateBlock = label === date;
        continue;
      }
      if (!inDateBlock) continue;
      if (!label) break;

      const quantity = typeof amount === "number"
        ? amount
        : Number(String(amount ?? "").replace(/,/g, ""));
      if (Number.isFinite(quantity)) {
        quantities.set(label, quantity);
      }
    }

    return quantities.size > 0 ? quantities : null;
  } catch {
    return null;
  }
}

// ─── Build monthly grid ──────────────────────────────────────────────────────

async function buildMonthGrid(args: {
  txDetails: Array<{
    date: string;
    orderNumber: number;
    timestamp: number;
    totalAmount: number;
    amountPaid: number;
    discount: number;
    remarks: string;
    memberName: string;
    items: Array<{ productName: string; quantity: number; unit: string; unitPrice: number; totalAmount: number }>;
  }>;
  snapshots: Array<{ date: string; productId: Id<"products">; variantId?: Id<"productVariants">; quantity: number }>;
  prevMonthSnapshots: Array<{ date: string; productId: Id<"products">; variantId?: Id<"productVariants">; quantity: number }>;
  productInfo: Array<{ productId: Id<"products">; variantId?: Id<"productVariants">; label: string; unit: string }>;
  paymentDetails: Array<{ orderNumber: number; txDate: string; memberName: string; txTotal: number; amountPaid: number; paymentDate: string; amount: number; balance: number; isOpeningBalance?: boolean }>;
  priceHistory: Array<{ productId: Id<"products">; variantId?: Id<"productVariants">; oldPrice: number; newPrice: number; changedAt: number }>;
  currentPrices: Array<{ productId: Id<"products">; variantId?: Id<"productVariants">; price: number }>;
  priceProducts: Array<{ productId: Id<"products">; label: string }>;
  previousSheetStock?: { date: string; quantitiesByLabel: Map<string, number> } | null;
}): Promise<{ grid: (string | number)[][]; stockHeaderRows: number[]; dateHeaderRows: number[]; txGroupRanges: Array<{ startRow: number; endRow: number; isCredit: boolean }>; totalRowIndices: number[]; stockRowCount: number; paymentRowCount: number; paymentGroupRanges: Array<{ startRow: number; endRow: number }>; openingRowIndices: number[]; txRowMap: Map<string, number>; paymentMeta: Array<{ orderNum: number; txDate: string }>; priceHistoryHeaderRows: number[]; priceHistoryRowCount: number }> {
  const txHeader: string[] = [
    "Order", "Time", "Product", "Qty", "Unit",
    "Unit Price", "Item Total", "Discount", "Tx Total", "Member", "Remarks",
  ];
  const txRows: (string | number)[][] = [];
  const dateHeaderTxIndices: number[] = [];
  const txGroupRanges: Array<{ startRow: number; endRow: number; isCredit: boolean }> = [];
  const txRowMap = new Map<string, number>(); // txDate::orderNumber → grid row (1-indexed, for Sheets API)
  const totalRowIndices: number[] = [];

  const txByDate = new Map<string, typeof args.txDetails>();
  for (const tx of args.txDetails) {
    let group = txByDate.get(tx.date);
    if (!group) { group = []; txByDate.set(tx.date, group); }
    group.push(tx);
  }
  for (const date of [...txByDate.keys()].sort()) {
    dateHeaderTxIndices.push(txRows.length);
    txRows.push([formatDateDMY(date), "", "", "", "", "", "", "", "", "", ""]);
    for (const tx of txByDate.get(date)!) {
      const txStartIdx = txRows.length; // txRows index of first item in this transaction
      const time = new Date(tx.timestamp).toLocaleTimeString("id-ID", {
        hour: "2-digit", minute: "2-digit", hour12: false,
        timeZone: "Asia/Jakarta",
      });
      for (let i = 0; i < tx.items.length; i++) {
        const item = tx.items[i];
        txRows.push([
          i === 0 ? tx.orderNumber : "",
          i === 0 ? time : "",
          item.productName,
          item.quantity,
          item.unit,
          Math.round(item.unitPrice),
          Math.round(item.totalAmount),
          i === 0 && tx.discount > 0 ? Math.round(tx.discount) : "",
          i === 0 ? Math.round(tx.totalAmount) : "",
          i === 0 ? tx.memberName : "",
          i === 0 ? tx.remarks : "",
        ]);
      }
      // +1 converts txRows index → grid row (grid row 0 is the header)
      // endRow is exclusive (Sheets API convention)
      txGroupRanges.push({ startRow: txStartIdx + 1, endRow: txRows.length + 1, isCredit: tx.amountPaid < tx.totalAmount });
      txRowMap.set(`${tx.date}::${tx.orderNumber}`, txStartIdx + 1);
    }
    // Daily total row — placed after all transactions for the date
    const dayTotal = txByDate.get(date)!.reduce((sum, tx) => sum + tx.totalAmount, 0);
    const totalRowTxIdx = txRows.length;
    txRows.push(["", "", "", "", "", "", "", "TOTAL", Math.round(dayTotal), "", ""]);
    totalRowIndices.push(totalRowTxIdx + 1); // +1 to convert txRows index → grid index
  }

  const dateSet = new Set<string>();
  for (const s of args.snapshots) dateSet.add(s.date);
  const dates = [...dateSet].sort();

  const snapKey = (pid: string, vid?: string) => `${pid}::${vid ?? ""}`;
  const byDate: Map<string, Map<string, number>> = new Map();
  for (const s of args.snapshots) {
    const key = snapKey(s.productId, s.variantId);
    let inner = byDate.get(s.date);
    if (!inner) { inner = new Map(); byDate.set(s.date, inner); }
    inner.set(key, s.quantity);
  }

  // Previous month snapshot baseline for cross-month delta on the first date
  const prevByKey = new Map<string, number>();
  for (const s of args.prevMonthSnapshots) {
    prevByKey.set(snapKey(s.productId, s.variantId), s.quantity);
  }
  const hasPrevBaseline = prevByKey.size > 0;

  const stockColumn: Array<{ a: string; b: string | number; c: string | number; isHeader?: boolean }> = [];
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const prevDate = i > 0 ? dates[i - 1] : null;
    const previousSheetStock = i === 0 && args.previousSheetStock?.date === previousDate(date)
      ? args.previousSheetStock
      : null;
    const showDelta = prevDate !== null || previousSheetStock !== null || (i === 0 && hasPrevBaseline);
    stockColumn.push({ a: date, b: "AMOUNT", c: showDelta ? "Δ" : "", isHeader: true });
    for (const p of args.productInfo) {
      const key = snapKey(p.productId, p.variantId);
      const qty = byDate.get(date)?.get(key) ?? 0;
      const prevQty = prevDate
        ? (byDate.get(prevDate)?.get(key) ?? 0)
        : (previousSheetStock?.quantitiesByLabel.get(p.label)
          ?? (i === 0 && hasPrevBaseline ? (prevByKey.get(key) ?? 0) : 0));
      const delta = showDelta ? qty - prevQty : 0;
      stockColumn.push({
        a: p.label,
        b: qty,
        c: showDelta ? delta : "",
      });
    }
    stockColumn.push({ a: "", b: "", c: "" });
  }

  // Payment column — grouped by order (sorted by txDate, orderNumber; within order by payment date)
  const sortedPayments = [...args.paymentDetails].sort((a, b) => {
    const d = a.txDate.localeCompare(b.txDate);
    return d !== 0 ? d : a.orderNumber - b.orderNumber;
  });
  // For opening-balance rows, paymentDate holds the label ("Sisa dari May") and Amount stays blank.
  const paymentColumn: (string | number)[][] = sortedPayments.map(p => [
    p.orderNumber, p.txDate, p.memberName, Math.round(p.txTotal), Math.round(p.amountPaid),
    p.paymentDate, p.isOpeningBalance ? "" : Math.round(p.amount), Math.round(p.balance),
  ]);
  const openingRowIndices: number[] = [];
  sortedPayments.forEach((p, i) => { if (p.isOpeningBalance) openingRowIndices.push(i + 1); });
  const paymentGroupRanges: Array<{ startRow: number; endRow: number }> = [];
  const paymentMeta: Array<{ orderNum: number; txDate: string }> = [];
  {
    let pi = 0;
    while (pi < sortedPayments.length) {
      const orderNum = sortedPayments[pi].orderNumber;
      const groupTxDate = sortedPayments[pi].txDate;
      const groupMember = sortedPayments[pi].memberName;
      const groupStart = pi;
      while (pi < sortedPayments.length && sortedPayments[pi].orderNumber === orderNum && sortedPayments[pi].txDate === groupTxDate && sortedPayments[pi].memberName === groupMember) pi++;
      paymentGroupRanges.push({ startRow: groupStart + 1, endRow: pi + 1 });
    }
    for (const p of sortedPayments) {
      paymentMeta.push({ orderNum: p.orderNumber, txDate: p.txDate });
    }
  }

  // Price history column (Y–Z, indices 24–25)
  const nonVariantHistory = args.priceHistory.filter(h => !h.variantId);
  // dd/mm/yyyy in the shop's timezone — the action runtime clock is UTC, so a
  // change saved before 07:00 WIB would otherwise be labelled with the day before.
  const fmtDMY = (ts: number) => new Date(ts).toLocaleDateString("en-GB", { timeZone: "Asia/Jakarta" });
  const priceAt = (productId: Id<"products">, t: number): number => {
    const entries = nonVariantHistory
      .filter(h => h.productId === productId)
      .sort((a, b) => a.changedAt - b.changedAt);
    const before = entries.filter(e => e.changedAt <= t);
    if (before.length > 0) return before[before.length - 1].newPrice;
    if (entries.length > 0) return entries[0].oldPrice;
    return args.currentPrices.find(p => p.productId === productId && !p.variantId)?.price ?? 0;
  };
  // The price editor saves each product separately, so one update leaves several
  // history rows seconds apart. Treat rows within PRICE_SESSION_GAP of each other
  // as one change, priced as of its last row — otherwise every row became its
  // own seconds-long period with only some of the new prices applied.
  const PRICE_SESSION_GAP = 10 * 60_000;
  const changeTimes = [...new Set(nonVariantHistory.map(h => h.changedAt))].sort((a, b) => a - b);
  const sessions: Array<{ start: number; end: number }> = [];
  for (const t of changeTimes) {
    const last = sessions[sessions.length - 1];
    if (last && t - last.end <= PRICE_SESSION_GAP) last.end = t;
    else sessions.push({ start: t, end: t });
  }
  // Remove sessions where no product price actually changed (e.g. accidental same-value edits)
  const priceSetKey = (ts: number) => args.priceProducts.map(p => `${p.productId}:${priceAt(p.productId, ts)}`).join('|');
  const breakpoints: Array<{ start: number; end: number }> = [];
  for (const s of sessions) {
    if (breakpoints.length === 0 || priceSetKey(s.end) !== priceSetKey(breakpoints[breakpoints.length - 1].end)) {
      breakpoints.push(s);
    }
  }
  const priceHistoryColumn: (string | number)[][] = [];
  const priceHistoryHeaderRows: number[] = [];
  const nowTs = Date.now();
  for (let i = 0; i < breakpoints.length; i++) {
    const start = breakpoints[i].start;
    const end = breakpoints[i + 1]?.start ?? nowTs;
    priceHistoryHeaderRows.push(priceHistoryColumn.length + 1); // +1 for grid header row
    priceHistoryColumn.push([`${fmtDMY(start)} - ${fmtDMY(end)}`, ""]);
    for (const p of args.priceProducts) {
      priceHistoryColumn.push([p.label, priceAt(p.productId, breakpoints[i].end)]);
    }
    priceHistoryColumn.push(["", ""]); // separator
  }

  const LEFT_COLS = 11;
  const GAP = 1;
  const PAYMENT_GAP = 1;
  const PAYMENT_COLS = 8;
  const PRICE_HISTORY_GAP = 1;
  const totalRows = Math.max(1 + txRows.length, stockColumn.length, sortedPayments.length, priceHistoryColumn.length, 1);
  const grid: (string | number)[][] = [];
  const stockHeaderRows: number[] = [];

  grid.push([
    ...txHeader, ...Array(GAP).fill(""),
    "Stocks", "AMOUNT", "Δ",
    ...Array(PAYMENT_GAP).fill(""),
    "Order #", "Tx Date", "Member", "Tx Total", "Dibayar Awal", "Payment Date", "Amount", "Sisa",
    ...Array(PRICE_HISTORY_GAP).fill(""),
    "Harga", "",
  ]);

  for (let r = 1; r < totalRows + 1; r++) {
    const left = txRows[r - 1] ?? Array(LEFT_COLS).fill("");
    const stock = stockColumn[r - 1];
    const right: (string | number)[] = stock ? [stock.a, stock.b, stock.c] : ["", "", ""];
    const payment = paymentColumn[r - 1] ?? Array(PAYMENT_COLS).fill("");
    const ph = priceHistoryColumn[r - 1];
    const priceHistoryRow: (string | number)[] = ph ? [ph[0], ph[1]] : ["", ""];
    if (stock?.isHeader) stockHeaderRows.push(r);
    grid.push([...left, ...Array(GAP).fill(""), ...right, ...Array(PAYMENT_GAP).fill(""), ...payment, ...Array(PRICE_HISTORY_GAP).fill(""), ...priceHistoryRow]);
  }

  const dateHeaderRows = dateHeaderTxIndices.map(i => i + 1); // +1 for the column header row
  return { grid, stockHeaderRows, dateHeaderRows, txGroupRanges, totalRowIndices, stockRowCount: stockColumn.length, paymentRowCount: sortedPayments.length, paymentGroupRanges, openingRowIndices, txRowMap, paymentMeta, priceHistoryHeaderRows, priceHistoryRowCount: priceHistoryColumn.length };
}

// ─── Formatting ──────────────────────────────────────────────────────────────

// Color helper — Google Sheets API wants RGB as floats in [0,1].
const rgb = (r: number, g: number, b: number) => ({ red: r / 255, green: g / 255, blue: b / 255 });

const COLORS = {
  headerBg:       rgb(26, 29, 46),     // #1a1d2e (matches calculator dark)
  headerFg:       rgb(221, 226, 240),  // #dde2f0
  stockHeaderBg:  rgb(232, 236, 246),  // #e8ecf6
  stockHeaderFg:  rgb(45, 49, 66),     // #2d3142
  dateBandBg:     rgb(200, 210, 232),  // #c8d2e8
  dateBandFg:     rgb(30, 35, 60),     // #1e233c
  positive:       rgb(52, 168, 83),    // #34a853
  negative:       rgb(212, 24, 61),    // #d4183d
  divider:        rgb(140, 148, 168),  // #8c94a8 - medium border
  txAltBg:          rgb(240, 244, 255),  // #f0f4ff - alternate transaction row tint
  txBaseBg:         rgb(255, 255, 255),  // #ffffff
  totalRowBg:       rgb(45, 49, 66),     // #2d3142 - deep blue-gray (app primary)
  totalLabelFg:     rgb(140, 146, 182),  // #8c92b6 - muted lavender
  totalValueFg:     rgb(232, 236, 246),  // #e8ecf6 - near-white
  paymentHeaderBg:  rgb(49, 91, 130),    // #315b82 - slate blue, distinct from dark tx header
  paymentHeaderFg:  rgb(221, 236, 248),  // #ddecf8 - cool light text
  creditAmber:      rgb(212, 160, 23),   // #d4a017 - amber text for kredit/hutang Tx Total
  payGroupAltBg:    rgb(240, 247, 255),  // #f0f7ff - subtle blue for alternating payment groups
  openingBg:        rgb(237, 239, 245),  // #edeff5 - faint grey band for carried-in balance rows
  openingFg:        rgb(110, 118, 140),  // #6e768c - muted grey text, reads as context not a payment
};

type SheetsRequest = Record<string, unknown>;

async function applyMonthFormatting(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  sheetId: number,
  totalRows: number,
  stockHeaderRows: number[],
  dateHeaderRows: number[],
  existingRuleCount: number,
  txGroupRanges: Array<{ startRow: number; endRow: number; isCredit: boolean }>,
  totalRowIndices: number[],
  stockRowCount: number,
  paymentRowCount: number,
  paymentGroupRanges: Array<{ startRow: number; endRow: number }>,
  openingRowIndices: number[],
  priceHistoryHeaderRows: number[],
  priceHistoryRowCount: number,
): Promise<void> {
  const requests: SheetsRequest[] = [];

  // Unmerge all data cells first so previous-sync merges don't accumulate
  const BLAST_ROWS = Math.max(totalRows + 100, 200);
  requests.push({
    unmergeCells: {
      range: { sheetId, startRowIndex: 1, endRowIndex: BLAST_ROWS, startColumnIndex: 0, endColumnIndex: 11 },
    },
  });
  requests.push({
    unmergeCells: {
      range: { sheetId, startRowIndex: 1, endRowIndex: BLAST_ROWS, startColumnIndex: 16, endColumnIndex: 24 },
    },
  });

  // Blast-clear: wipe background + bold/italic for the full tx column range + a buffer beyond
  // totalRows so that total-row dark styling from a previous (longer) sync doesn't linger.
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: BLAST_ROWS, startColumnIndex: 0, endColumnIndex: 11 },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 1, green: 1, blue: 1 },
          textFormat: { bold: false, italic: false },
        },
      },
      fields: "userEnteredFormat(backgroundColor,textFormat)",
    },
  });
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: BLAST_ROWS, startColumnIndex: 16, endColumnIndex: 24 },
      cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 1, blue: 1 } } },
      fields: "userEnteredFormat.backgroundColor",
    },
  });
  requests.push({
    unmergeCells: {
      range: { sheetId, startRowIndex: 1, endRowIndex: BLAST_ROWS, startColumnIndex: 24, endColumnIndex: 27 },
    },
  });
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: BLAST_ROWS, startColumnIndex: 24, endColumnIndex: 27 },
      cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 1, blue: 1 }, textFormat: { bold: false } } },
      fields: "userEnteredFormat(backgroundColor,textFormat)",
    },
  });

  // Reset the entire header row to white so stale dark styling from previous syncs doesn't bleed
  // into columns that no longer have an explicit header style (e.g. cols beyond the payment table)
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
      cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 1, blue: 1 } } },
      fields: "userEnteredFormat.backgroundColor",
    },
  });

  // Wipe existing conditional rules first (they accumulate across syncs)
  for (let i = existingRuleCount - 1; i >= 0; i--) {
    requests.push({ deleteConditionalFormatRule: { sheetId, index: i } });
  }

  // Freeze header row
  requests.push({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
      fields: "gridProperties.frozenRowCount",
    },
  });

  // Header row: transaction columns A–K only (dark)
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 11 },
      cell: {
        userEnteredFormat: {
          backgroundColor: COLORS.headerBg,
          textFormat: { foregroundColor: COLORS.headerFg, bold: true, fontSize: 10 },
          horizontalAlignment: "CENTER",
          verticalAlignment: "MIDDLE",
        },
      },
      fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
    },
  });

  // Stock section column header row (Stocks / AMOUNT / Δ — cols M-O)
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 12, endColumnIndex: 15 },
      cell: {
        userEnteredFormat: {
          backgroundColor: COLORS.stockHeaderBg,
          textFormat: { foregroundColor: COLORS.stockHeaderFg, bold: true, fontSize: 10 },
          horizontalAlignment: "CENTER",
          verticalAlignment: "MIDDLE",
        },
      },
      fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
    },
  });

  // Base: center + middle align all data cells (A–K, cols 0–11)
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 0, endColumnIndex: 11 },
      cell: {
        userEnteredFormat: {
          horizontalAlignment: "CENTER",
          verticalAlignment: "MIDDLE",
        },
      },
      fields: "userEnteredFormat(horizontalAlignment,verticalAlignment)",
    },
  });

  // Currency columns F, G (Unit Price, Item Total) — cols 5–7
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 5, endColumnIndex: 7 },
      cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: '"Rp "#,##0' } } },
      fields: "userEnteredFormat.numberFormat",
    },
  });
  // Discount column H (col 7) — blank when zero so non-discounted rows stay clean
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 7, endColumnIndex: 8 },
      cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: '"Rp "#,##0;;' } } },
      fields: "userEnteredFormat.numberFormat",
    },
  });
  // Currency column I (Tx Total, col 8)
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 8, endColumnIndex: 9 },
      cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: '"Rp "#,##0' } } },
      fields: "userEnteredFormat.numberFormat",
    },
  });

  // Qty col D (col 3) — clean integer display
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 3, endColumnIndex: 4 },
      cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: "#,##0" } } },
      fields: "userEnteredFormat.numberFormat",
    },
  });

  // Stock AMOUNT col N (col 13) — thousands separator
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 13, endColumnIndex: 14 },
      cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: "#,##0" } } },
      fields: "userEnteredFormat.numberFormat",
    },
  });

  // Stock Δ col O (col 14) — signed
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 14, endColumnIndex: 15 },
      cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: "+#,##0;-#,##0;0" } } },
      fields: "userEnteredFormat.numberFormat",
    },
  });

  // Alternating transaction row shading — even index white, odd index light blue
  for (let i = 0; i < txGroupRanges.length; i++) {
    const { startRow, endRow } = txGroupRanges[i];
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: 0, endColumnIndex: 11 },
        cell: { userEnteredFormat: { backgroundColor: i % 2 === 0 ? COLORS.txBaseBg : COLORS.txAltBg } },
        fields: "userEnteredFormat.backgroundColor",
      },
    });
  }

  // Kredit/hutang orders: amber text on Tx Total column (col I = 8) only
  for (const { startRow, endRow, isCredit } of txGroupRanges) {
    if (!isCredit) continue;
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: 8, endColumnIndex: 9 },
        cell: { userEnteredFormat: { textFormat: { foregroundColor: COLORS.creditAmber, bold: true } } },
        fields: "userEnteredFormat.textFormat",
      },
    });
  }

  // Date group header rows — merged across all tx columns A–K
  for (const rowIdx of dateHeaderRows) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: rowIdx, endRowIndex: rowIdx + 1, startColumnIndex: 0, endColumnIndex: 11 },
        cell: {
          userEnteredFormat: {
            backgroundColor: COLORS.dateBandBg,
            textFormat: { foregroundColor: COLORS.dateBandFg, bold: true, fontSize: 10 },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
      },
    });
  }

  // Daily total rows — dark accent band closing each day
  for (const rowIdx of totalRowIndices) {
    // Full row background A–K
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: rowIdx, endRowIndex: rowIdx + 1, startColumnIndex: 0, endColumnIndex: 11 },
        cell: { userEnteredFormat: { backgroundColor: COLORS.totalRowBg } },
        fields: "userEnteredFormat.backgroundColor",
      },
    });
    // Col H (index 7): "TOTAL" label — right-aligned, italic, muted lavender
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: rowIdx, endRowIndex: rowIdx + 1, startColumnIndex: 7, endColumnIndex: 8 },
        cell: {
          userEnteredFormat: {
            textFormat: { foregroundColor: COLORS.totalLabelFg, italic: true, fontSize: 9 },
            horizontalAlignment: "RIGHT",
            verticalAlignment: "MIDDLE",
          },
        },
        fields: "userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)",
      },
    });
    // Col I (index 8): total amount — bold, near-white
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: rowIdx, endRowIndex: rowIdx + 1, startColumnIndex: 8, endColumnIndex: 9 },
        cell: {
          userEnteredFormat: {
            textFormat: { foregroundColor: COLORS.totalValueFg, bold: true, fontSize: 10 },
            horizontalAlignment: "RIGHT",
            verticalAlignment: "MIDDLE",
          },
        },
        fields: "userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)",
      },
    });
  }

  // Stock block header rows (date + AMOUNT + Δ labels) — bold + highlight
  for (const rowIdx of stockHeaderRows) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: rowIdx, endRowIndex: rowIdx + 1, startColumnIndex: 12, endColumnIndex: 15 },
        cell: {
          userEnteredFormat: {
            backgroundColor: COLORS.stockHeaderBg,
            textFormat: { foregroundColor: COLORS.stockHeaderFg, bold: true, fontSize: 10 },
            horizontalAlignment: "CENTER",
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
      },
    });
  }

  // Payment table — header (row 0, cols Q–X = 16–24), distinct slate-blue colour
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 16, endColumnIndex: 24 },
      cell: {
        userEnteredFormat: {
          backgroundColor: COLORS.paymentHeaderBg,
          textFormat: { foregroundColor: COLORS.paymentHeaderFg, bold: true, fontSize: 10 },
          horizontalAlignment: "CENTER",
          verticalAlignment: "MIDDLE",
        },
      },
      fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
    },
  });

  // Payment data rows — center + middle (cols Q–X = 16–24)
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 16, endColumnIndex: 24 },
      cell: { userEnteredFormat: { horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" } },
      fields: "userEnteredFormat(horizontalAlignment,verticalAlignment)",
    },
  });

  // Tx Total (T=19), Dibayar Awal (U=20), Amount (W=22), Sisa (X=23) — currency format
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 19, endColumnIndex: 20 },
      cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: '"Rp "#,##0' } } },
      fields: "userEnteredFormat.numberFormat",
    },
  });
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 20, endColumnIndex: 21 },
      cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: '"Rp "#,##0' } } },
      fields: "userEnteredFormat.numberFormat",
    },
  });
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 22, endColumnIndex: 23 },
      cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: '"Rp "#,##0' } } },
      fields: "userEnteredFormat.numberFormat",
    },
  });
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 23, endColumnIndex: 24 },
      cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: '"Rp "#,##0;;' } } },
      fields: "userEnteredFormat.numberFormat",
    },
  });

  // Sisa column conditional formatting: green = lunas (0), amber = outstanding (> 0)
  requests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 23, endColumnIndex: 24 }],
        booleanRule: {
          condition: { type: "NUMBER_EQ", values: [{ userEnteredValue: "0" }] },
          format: { textFormat: { foregroundColor: COLORS.positive, bold: true } },
        },
      },
      index: 0,
    },
  });
  requests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 23, endColumnIndex: 24 }],
        booleanRule: {
          condition: { type: "NUMBER_GREATER", values: [{ userEnteredValue: "0" }] },
          format: { textFormat: { foregroundColor: { red: 212 / 255, green: 160 / 255, blue: 23 / 255 }, bold: true } },
        },
      },
      index: 0,
    },
  });

  // Conditional formatting for Δ column — green positive, red negative
  requests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 14, endColumnIndex: 15 }],
        booleanRule: {
          condition: { type: "NUMBER_LESS", values: [{ userEnteredValue: "0" }] },
          format: { textFormat: { foregroundColor: COLORS.negative, bold: true } },
        },
      },
      index: 0,
    },
  });
  requests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 14, endColumnIndex: 15 }],
        booleanRule: {
          condition: { type: "NUMBER_GREATER", values: [{ userEnteredValue: "0" }] },
          format: { textFormat: { foregroundColor: COLORS.positive, bold: true } },
        },
      },
      index: 0,
    },
  });

  // Price history section header (row 0, cols Z–AA = 25–26)
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 25, endColumnIndex: 27 },
      cell: {
        userEnteredFormat: {
          backgroundColor: COLORS.stockHeaderBg,
          textFormat: { foregroundColor: COLORS.stockHeaderFg, bold: true, fontSize: 10 },
          horizontalAlignment: "CENTER",
          verticalAlignment: "MIDDLE",
        },
      },
      fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
    },
  });
  requests.push({
    mergeCells: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 25, endColumnIndex: 27 },
      mergeType: "MERGE_ALL",
    },
  });

  // Price history period header rows — date range band
  for (const rowIdx of priceHistoryHeaderRows) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: rowIdx, endRowIndex: rowIdx + 1, startColumnIndex: 25, endColumnIndex: 27 },
        cell: {
          userEnteredFormat: {
            backgroundColor: COLORS.dateBandBg,
            textFormat: { foregroundColor: COLORS.dateBandFg, bold: true, fontSize: 9 },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
      },
    });
    requests.push({
      mergeCells: {
        range: { sheetId, startRowIndex: rowIdx, endRowIndex: rowIdx + 1, startColumnIndex: 25, endColumnIndex: 27 },
        mergeType: "MERGE_ALL",
      },
    });
  }

  // Price history data: center + middle for col Z (label), currency for col AA (price)
  if (priceHistoryRowCount > 0) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: priceHistoryRowCount + 1, startColumnIndex: 25, endColumnIndex: 27 },
        cell: { userEnteredFormat: { horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" } },
        fields: "userEnteredFormat(horizontalAlignment,verticalAlignment)",
      },
    });
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: priceHistoryRowCount + 1, startColumnIndex: 26, endColumnIndex: 27 },
        cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: '"Rp "#,##0' } } },
        fields: "userEnteredFormat.numberFormat",
      },
    });
    const phBorder = { style: "SOLID", color: COLORS.divider };
    requests.push({
      updateBorders: {
        range: { sheetId, startRowIndex: 0, endRowIndex: priceHistoryRowCount + 1, startColumnIndex: 25, endColumnIndex: 27 },
        top: phBorder, bottom: phBorder, left: phBorder, right: phBorder,
        innerHorizontal: phBorder, innerVertical: phBorder,
      },
    });
  }

  // Column widths
  const widths = [
    55,   // A Order
    60,   // B Time
    150,  // C Product
    60,   // D Qty
    50,   // E Unit
    95,   // F Unit Price
    100,  // G Item Total
    90,   // H Discount
    105,  // I Tx Total
    130,  // J Member
    180,  // K Remarks
    24,   // L (gap)
    110,  // M Stock label / date
    85,   // N AMOUNT
    75,   // O Δ
    24,   // P (gap)
    55,   // Q Order #
    90,   // R Tx Date
    130,  // S Member
    105,  // T Tx Total
    90,   // U Dibayar Awal
    90,   // V Payment Date
    105,  // W Amount
    100,  // X Sisa
    24,   // Y (gap)
    90,   // Z Price label
    105,  // AA Price value
  ];
  widths.forEach((w, i) => {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: w },
        fields: "pixelSize",
      },
    });
  });

  // Header row taller
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 30 },
      fields: "pixelSize",
    },
  });

  // Merge date header rows across all transaction columns A–K
  for (const rowIdx of dateHeaderRows) {
    requests.push({
      mergeCells: {
        range: {
          sheetId,
          startRowIndex: rowIdx, endRowIndex: rowIdx + 1,
          startColumnIndex: 0, endColumnIndex: 11,
        },
        mergeType: "MERGE_ALL",
      },
    });
  }

  // Merge multi-item transaction rows: Order, Time, Discount, Tx Total, Member, Remarks
  // span the full height of the transaction group so each value appears only once
  const MERGE_COLS = [0, 1, 7, 8, 9, 10]; // A B H I J K
  for (const { startRow, endRow } of txGroupRanges) {
    if (endRow - startRow <= 1) continue; // single-item tx — nothing to merge
    for (const colIdx of MERGE_COLS) {
      requests.push({
        mergeCells: {
          range: {
            sheetId,
            startRowIndex: startRow, endRowIndex: endRow,
            startColumnIndex: colIdx, endColumnIndex: colIdx + 1,
          },
          mergeType: "MERGE_ALL",
        },
      });
    }
  }

  // Payment group shading — alternating per order group so each order's payments are visually linked
  for (let gi = 0; gi < paymentGroupRanges.length; gi++) {
    const { startRow, endRow } = paymentGroupRanges[gi];
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: 16, endColumnIndex: 24 },
        cell: { userEnteredFormat: { backgroundColor: gi % 2 === 0 ? COLORS.txBaseBg : COLORS.payGroupAltBg } },
        fields: "userEnteredFormat.backgroundColor",
      },
    });
  }

  // Merge Order #, Tx Date, Member, Tx Total, Dibayar Awal (cols Q–U = 16–20) within each multi-payment group
  for (const { startRow, endRow } of paymentGroupRanges) {
    if (endRow - startRow <= 1) continue;
    for (const colIdx of [16, 17, 18, 19, 20]) {
      requests.push({
        mergeCells: {
          range: { sheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: colIdx, endColumnIndex: colIdx + 1 },
          mergeType: "MERGE_ALL",
        },
      });
    }
  }

  // Opening-balance ("Sisa dari …") rows — style the non-merged cells (Payment Date, Amount, Sisa = cols 21–23)
  // as muted italic context so they read as carried-in notes, not payment events. The merged metadata
  // cols (16–20) keep their group shading. Sisa text colour is still set by the conditional rule below.
  for (const rowIdx of openingRowIndices) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: rowIdx, endRowIndex: rowIdx + 1, startColumnIndex: 21, endColumnIndex: 24 },
        cell: {
          userEnteredFormat: {
            backgroundColor: COLORS.openingBg,
            textFormat: { foregroundColor: COLORS.openingFg, italic: true },
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat)",
      },
    });
  }

  // Borders — transaction table stops before the total row (footer); stock table covers its data exactly
  const borderEnd = totalRowIndices.length > 0
    ? totalRowIndices[totalRowIndices.length - 1]
    : totalRows;
  const borderLine = { style: "SOLID", color: COLORS.divider };

  // Transaction table A–K
  requests.push({
    updateBorders: {
      range: { sheetId, startRowIndex: 0, endRowIndex: borderEnd, startColumnIndex: 0, endColumnIndex: 11 },
      top: borderLine, bottom: borderLine, left: borderLine, right: borderLine,
      innerHorizontal: borderLine, innerVertical: borderLine,
    },
  });

  // Stock table M–O (header row + all stock data rows, no extra empty rows below)
  if (stockRowCount > 0) {
    requests.push({
      updateBorders: {
        range: { sheetId, startRowIndex: 0, endRowIndex: stockRowCount + 1, startColumnIndex: 12, endColumnIndex: 15 },
        top: borderLine, bottom: borderLine, left: borderLine, right: borderLine,
        innerHorizontal: borderLine, innerVertical: borderLine,
      },
    });
  }

  // Payment table Q–X (header row + all payment rows)
  if (paymentRowCount > 0) {
    requests.push({
      updateBorders: {
        range: { sheetId, startRowIndex: 0, endRowIndex: paymentRowCount + 1, startColumnIndex: 16, endColumnIndex: 24 },
        top: borderLine, bottom: borderLine, left: borderLine, right: borderLine,
        innerHorizontal: borderLine, innerVertical: borderLine,
      },
    });
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
}

async function applyMembersFormatting(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  sheetId: number,
): Promise<void> {
  const requests: SheetsRequest[] = [
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: COLORS.headerBg,
            textFormat: { foregroundColor: COLORS.headerFg, bold: true, fontSize: 10 },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 200 },
        fields: "pixelSize",
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: 1, endIndex: 2 },
        properties: { pixelSize: 140 },
        fields: "pixelSize",
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: 2, endIndex: 3 },
        properties: { pixelSize: 110 },
        fields: "pixelSize",
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 30 },
        fields: "pixelSize",
      },
    },
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
}

// ─── Workers (reusable across public actions) ────────────────────────────────

async function doSyncMonth(ctx: ActionCtx, yearMonth: string) {
  const data = await ctx.runAction(internal.sheetsSyncData.loadMonthData, { yearMonth });
  const tab = tabNameForMonth(yearMonth);
  const { sheets, sheetId } = getSheetsClient();
  const previousCalendarDate = previousDate(`${yearMonth}-01`);
  const previousSheetQuantities = await readStockAmountsFromSheet(sheets, sheetId, previousCalendarDate);
  const previousSheetStock = previousSheetQuantities
    ? { date: previousCalendarDate, quantitiesByLabel: previousSheetQuantities }
    : null;
  const { grid, stockHeaderRows, dateHeaderRows, txGroupRanges, totalRowIndices, stockRowCount, paymentRowCount, paymentGroupRanges, openingRowIndices, txRowMap, paymentMeta, priceHistoryHeaderRows, priceHistoryRowCount } = await buildMonthGrid({
    ...data,
    previousSheetStock,
  });
  const { sheetId: tabSheetId, existingRuleCount } = await ensureTab(sheets, sheetId, tab);
  await ensureGridSize(sheets, sheetId, tabSheetId, grid.length, grid[0]?.length ?? 0);
  await writeTab(sheets, sheetId, tab, grid, tabSheetId);
  await applyMonthFormatting(sheets, sheetId, tabSheetId, grid.length, stockHeaderRows, dateHeaderRows, existingRuleCount, txGroupRanges, totalRowIndices, stockRowCount, paymentRowCount, paymentGroupRanges, openingRowIndices, priceHistoryHeaderRows, priceHistoryRowCount);

  // Inject HYPERLINK formulas into the payment Order # column (col Q)
  // Same-tab transactions use a direct row ref; cross-month ones use MATCH
  if (paymentMeta.length > 0) {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const tabGidMap = new Map<string, number>();
    for (const s of meta.data.sheets ?? []) {
      const title = s.properties?.title;
      const gid = s.properties?.sheetId;
      if (title && gid != null) tabGidMap.set(title, gid);
    }
    const formulas = paymentMeta.map(({ orderNum, txDate }) => {
      const row = txRowMap.get(`${txDate}::${orderNum}`);
      if (row != null) {
        return [`=HYPERLINK("#gid=${tabSheetId}&range=A${row + 1}",${orderNum})`];
      }
      const crossTabName = tabNameForMonth(txDate.slice(0, 7));
      const crossGid = tabGidMap.get(crossTabName);
      if (crossGid != null) {
        const dateLabel = formatDateDMY(txDate);
        return [`=HYPERLINK(CONCATENATE("#gid=",${crossGid},"&range=A",MATCH("${dateLabel}",'${crossTabName}'!A:A,0)+MATCH(${orderNum},INDIRECT("'${crossTabName}'!A"&MATCH("${dateLabel}",'${crossTabName}'!A:A,0)&":A"),0)-1),${orderNum})`];
      }
      return [orderNum];
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `'${tab}'!Q2:Q${1 + formulas.length}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: formulas },
    });
  }

  return { tab, rows: grid.length };
}

async function doSyncMembers(ctx: ActionCtx) {
  const members = await ctx.runQuery(internal.sheetsSyncData.getMembersForSync, {});
  const grid: (string | number)[][] = [
    ["Name", "Phone", "Joined"],
    ...members.map(m => [m.name, m.phone, m.joined] as (string | number)[]),
  ];
  const { sheets, sheetId } = getSheetsClient();
  const { sheetId: tabSheetId } = await ensureTab(sheets, sheetId, "Members");
  await writeTab(sheets, sheetId, "Members", grid, tabSheetId);
  await applyMembersFormatting(sheets, sheetId, tabSheetId);
  return { rows: grid.length };
}

// ─── Public actions ──────────────────────────────────────────────────────────

export const syncMonth = action({
  args: { yearMonth: v.string() },
  handler: async (ctx, args): Promise<{ ok: true; tab: string; rows: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    if (!/^\d{4}-\d{2}$/.test(args.yearMonth)) {
      throw new Error(`yearMonth must be "YYYY-MM"; got ${args.yearMonth}`);
    }
    const result = await doSyncMonth(ctx, args.yearMonth);
    return { ok: true, ...result };
  },
});

export const syncMembers = action({
  args: {},
  handler: async (ctx): Promise<{ ok: true; rows: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const result = await doSyncMembers(ctx);
    return { ok: true, ...result };
  },
});

/** "YYYY-MM" of today in the shop's timezone — the Convex runtime clock is UTC. */
function currentJakartaMonth() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }).slice(0, 7);
}

export const syncAll = action({
  args: {},
  handler: async (ctx): Promise<{ ok: true; tab: string; monthRows: number; memberRows: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const month = await doSyncMonth(ctx, currentJakartaMonth());
    const members = await doSyncMembers(ctx);
    return { ok: true, tab: month.tab, monthRows: month.rows, memberRows: members.rows };
  },
});

// ─── Internal actions ────────────────────────────────────────────────────────

/**
 * syncAll without a signed-in user: run nightly by crons.ts, and usable to
 * re-sync a past month's tab from the CLI:
 *   npx convex run sheetsSync:syncInternal '{"yearMonth":"2026-09"}'
 * Defaults to the current Jakarta month.
 */
export const syncInternal = internalAction({
  args: { yearMonth: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ tab: string; monthRows: number; memberRows: number }> => {
    const yearMonth = args.yearMonth ?? currentJakartaMonth();
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      throw new Error(`yearMonth must be "YYYY-MM"; got ${yearMonth}`);
    }
    const month = await doSyncMonth(ctx, yearMonth);
    const members = await doSyncMembers(ctx);
    return { tab: month.tab, monthRows: month.rows, memberRows: members.rows };
  },
});
