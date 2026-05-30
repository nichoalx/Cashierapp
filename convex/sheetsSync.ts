"use node";

import { google } from "googleapis";
import { v } from "convex/values";
import { action } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

// Node.js-runtime file: Google Sheets API calls. Only actions are permitted here.
// Internal queries/mutations live in `sheetsSyncData.ts` (V8 runtime).

// ─── Sheet writer plumbing ───────────────────────────────────────────────────

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
  return {
    sheetId: res.data.replies![0].addSheet!.properties!.sheetId!,
    existingRuleCount: 0,
  };
}

async function writeTab(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  title: string,
  values: (string | number)[][],
  valueInputOption: "RAW" | "USER_ENTERED" = "RAW",
): Promise<void> {
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${title}'`,
  });
  if (values.length === 0) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${title}'!A1`,
    valueInputOption,
    requestBody: { values },
  });
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
  productInfo: Array<{ productId: Id<"products">; variantId?: Id<"productVariants">; label: string; unit: string }>;
  paymentDetails: Array<{ orderNumber: number; txDate: string; memberName: string; txTotal: number; paymentDate: string; amount: number; balance: number }>;
}): Promise<{ grid: (string | number)[][]; stockHeaderRows: number[]; dateHeaderRows: number[]; txGroupRanges: Array<{ startRow: number; endRow: number; isCredit: boolean }>; totalRowIndices: number[]; stockRowCount: number; paymentRowCount: number; paymentGroupRanges: Array<{ startRow: number; endRow: number }>; txRowMap: Map<number, number>; paymentMeta: Array<{ orderNum: number; txDate: string }> }> {
  const txHeader: string[] = [
    "Order", "Time", "Product", "Qty", "Unit",
    "Unit Price", "Item Total", "Discount", "Tx Total", "Member", "Remarks",
  ];
  const txRows: (string | number)[][] = [];
  const dateHeaderTxIndices: number[] = [];
  const txGroupRanges: Array<{ startRow: number; endRow: number; isCredit: boolean }> = [];
  const txRowMap = new Map<number, number>(); // orderNumber → grid row (1-indexed, for Sheets API)
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
      txRowMap.set(tx.orderNumber, txStartIdx + 1);
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

  const stockColumn: Array<{ a: string; b: string | number; c: string | number; isHeader?: boolean }> = [];
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const prevDate = i > 0 ? dates[i - 1] : null;
    const showDelta = prevDate !== null;
    stockColumn.push({ a: date, b: "AMOUNT", c: showDelta ? "Δ" : "", isHeader: true });
    for (const p of args.productInfo) {
      const key = snapKey(p.productId, p.variantId);
      const qty = byDate.get(date)?.get(key) ?? 0;
      const prevQty = prevDate ? (byDate.get(prevDate)?.get(key) ?? 0) : 0;
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
  const paymentColumn: (string | number)[][] = sortedPayments.map(p => [
    p.orderNumber, p.txDate, p.memberName, Math.round(p.txTotal), p.paymentDate, Math.round(p.amount), Math.round(p.balance),
  ]);
  const paymentGroupRanges: Array<{ startRow: number; endRow: number }> = [];
  const paymentMeta: Array<{ orderNum: number; txDate: string }> = [];
  {
    let pi = 0;
    while (pi < sortedPayments.length) {
      const orderNum = sortedPayments[pi].orderNumber;
      const groupStart = pi;
      while (pi < sortedPayments.length && sortedPayments[pi].orderNumber === orderNum) pi++;
      paymentGroupRanges.push({ startRow: groupStart + 1, endRow: pi + 1 });
    }
    for (const p of sortedPayments) {
      paymentMeta.push({ orderNum: p.orderNumber, txDate: p.txDate });
    }
  }

  const LEFT_COLS = 11;
  const GAP = 1;
  const PAYMENT_GAP = 1;
  const PAYMENT_COLS = 7;
  const totalRows = Math.max(1 + txRows.length, stockColumn.length, sortedPayments.length, 1);
  const grid: (string | number)[][] = [];
  const stockHeaderRows: number[] = [];

  grid.push([
    ...txHeader, ...Array(GAP).fill(""),
    "Stocks", "AMOUNT", "Δ",
    ...Array(PAYMENT_GAP).fill(""),
    "Order #", "Tx Date", "Member", "Tx Total", "Payment Date", "Amount", "Sisa",
  ]);

  for (let r = 1; r < totalRows + 1; r++) {
    const left = txRows[r - 1] ?? Array(LEFT_COLS).fill("");
    const stock = stockColumn[r - 1];
    const right: (string | number)[] = stock ? [stock.a, stock.b, stock.c] : ["", "", ""];
    const payment = paymentColumn[r - 1] ?? Array(PAYMENT_COLS).fill("");
    if (stock?.isHeader) stockHeaderRows.push(r);
    grid.push([...left, ...Array(GAP).fill(""), ...right, ...Array(PAYMENT_GAP).fill(""), ...payment]);
  }

  const dateHeaderRows = dateHeaderTxIndices.map(i => i + 1); // +1 for the column header row
  return { grid, stockHeaderRows, dateHeaderRows, txGroupRanges, totalRowIndices, stockRowCount: stockColumn.length, paymentRowCount: sortedPayments.length, paymentGroupRanges, txRowMap, paymentMeta };
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
      range: { sheetId, startRowIndex: 1, endRowIndex: BLAST_ROWS, startColumnIndex: 16, endColumnIndex: 23 },
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
      range: { sheetId, startRowIndex: 1, endRowIndex: BLAST_ROWS, startColumnIndex: 16, endColumnIndex: 23 },
      cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 1, blue: 1 } } },
      fields: "userEnteredFormat.backgroundColor",
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

  // Payment table — header (row 0, cols Q–W = 16–23), distinct slate-blue colour
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 16, endColumnIndex: 23 },
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

  // Payment data rows — center + middle (cols Q–W = 16–23)
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 16, endColumnIndex: 23 },
      cell: { userEnteredFormat: { horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" } },
      fields: "userEnteredFormat(horizontalAlignment,verticalAlignment)",
    },
  });

  // Tx Total (col T = 19), Amount (col V = 21), Sisa (col W = 22) — currency format
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 19, endColumnIndex: 20 },
      cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: '"Rp "#,##0' } } },
      fields: "userEnteredFormat.numberFormat",
    },
  });
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 21, endColumnIndex: 22 },
      cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: '"Rp "#,##0' } } },
      fields: "userEnteredFormat.numberFormat",
    },
  });
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 22, endColumnIndex: 23 },
      cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: '"Rp "#,##0;;' } } },
      fields: "userEnteredFormat.numberFormat",
    },
  });

  // Sisa column conditional formatting: green = lunas (0), amber = outstanding (> 0)
  requests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 22, endColumnIndex: 23 }],
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
        ranges: [{ sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 22, endColumnIndex: 23 }],
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
    90,   // U Payment Date
    105,  // V Amount
    100,  // W Sisa
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
        range: { sheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: 16, endColumnIndex: 23 },
        cell: { userEnteredFormat: { backgroundColor: gi % 2 === 0 ? COLORS.txBaseBg : COLORS.payGroupAltBg } },
        fields: "userEnteredFormat.backgroundColor",
      },
    });
  }

  // Merge Order #, Tx Date, Member, Tx Total (cols Q–T = 16–19) within each multi-payment group
  for (const { startRow, endRow } of paymentGroupRanges) {
    if (endRow - startRow <= 1) continue;
    for (const colIdx of [16, 17, 18, 19]) {
      requests.push({
        mergeCells: {
          range: { sheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: colIdx, endColumnIndex: colIdx + 1 },
          mergeType: "MERGE_ALL",
        },
      });
    }
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

  // Payment table Q–W (header row + all payment rows)
  if (paymentRowCount > 0) {
    requests.push({
      updateBorders: {
        range: { sheetId, startRowIndex: 0, endRowIndex: paymentRowCount + 1, startColumnIndex: 16, endColumnIndex: 23 },
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
  await ctx.runMutation(internal.sheetsSyncData.takeSnapshotIfMissing, {});
  const data = await ctx.runQuery(internal.sheetsSyncData.getMonthData, { yearMonth });
  const { grid, stockHeaderRows, dateHeaderRows, txGroupRanges, totalRowIndices, stockRowCount, paymentRowCount, paymentGroupRanges, txRowMap, paymentMeta } = await buildMonthGrid(data);
  const tab = tabNameForMonth(yearMonth);
  const { sheets, sheetId } = getSheetsClient();
  const { sheetId: tabSheetId, existingRuleCount } = await ensureTab(sheets, sheetId, tab);
  await writeTab(sheets, sheetId, tab, grid);
  await applyMonthFormatting(sheets, sheetId, tabSheetId, grid.length, stockHeaderRows, dateHeaderRows, existingRuleCount, txGroupRanges, totalRowIndices, stockRowCount, paymentRowCount, paymentGroupRanges);

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
      const row = txRowMap.get(orderNum);
      if (row != null) {
        return [`=HYPERLINK("#gid=${tabSheetId}&range=A${row}",${orderNum})`];
      }
      const crossTabName = tabNameForMonth(txDate.slice(0, 7));
      const crossGid = tabGidMap.get(crossTabName);
      if (crossGid != null) {
        return [`=HYPERLINK(CONCATENATE("#gid=",${crossGid},"&range=A",MATCH(${orderNum},'${crossTabName}'!A:A,0)),${orderNum})`];
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
  await writeTab(sheets, sheetId, "Members", grid);
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

export const syncAll = action({
  args: {},
  handler: async (ctx): Promise<{ ok: true; tab: string; monthRows: number; memberRows: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const month = await doSyncMonth(ctx, yearMonth);
    const members = await doSyncMembers(ctx);
    return { ok: true, tab: month.tab, monthRows: month.rows, memberRows: members.rows };
  },
});
