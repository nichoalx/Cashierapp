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
): Promise<void> {
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${title}'`,
  });
  if (values.length === 0) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${title}'!A1`,
    valueInputOption: "RAW",
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
    discount: number;
    remarks: string;
    memberName: string;
    items: Array<{ productName: string; quantity: number; unit: string; unitPrice: number; totalAmount: number }>;
  }>;
  snapshots: Array<{ date: string; productId: Id<"products">; variantId?: Id<"productVariants">; quantity: number }>;
  productInfo: Array<{ productId: Id<"products">; variantId?: Id<"productVariants">; label: string; unit: string }>;
}): Promise<{ grid: (string | number)[][]; stockHeaderRows: number[] }> {
  const txHeader: string[] = [
    "Date", "Order", "Time", "Product", "Qty", "Unit",
    "Unit Price", "Item Total", "Discount", "Tx Total", "Member", "Remarks",
  ];
  const txRows: (string | number)[][] = [];
  for (const tx of args.txDetails) {
    const time = new Date(tx.timestamp).toLocaleTimeString("id-ID", {
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
    for (let i = 0; i < tx.items.length; i++) {
      const item = tx.items[i];
      txRows.push([
        i === 0 ? tx.date : "",
        i === 0 ? tx.orderNumber : "",
        i === 0 ? time : "",
        item.productName,
        item.quantity,
        item.unit,
        Math.round(item.unitPrice),
        Math.round(item.totalAmount),
        i === 0 ? Math.round(tx.discount) : "",
        i === 0 ? Math.round(tx.totalAmount) : "",
        i === 0 ? tx.memberName : "",
        i === 0 ? tx.remarks : "",
      ]);
    }
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

  const LEFT_COLS = 12;
  const GAP = 1;
  const totalRows = Math.max(1 + txRows.length, stockColumn.length, 1);
  const grid: (string | number)[][] = [];
  const stockHeaderRows: number[] = [];

  grid.push([...txHeader, ...Array(GAP).fill(""), "", "", ""]);

  for (let r = 1; r < totalRows + 1; r++) {
    const left = txRows[r - 1] ?? Array(LEFT_COLS).fill("");
    const stock = stockColumn[r - 1];
    const right: (string | number)[] = stock
      ? [stock.a, stock.b, stock.c]
      : ["", "", ""];
    if (stock?.isHeader) stockHeaderRows.push(r);
    grid.push([...left, ...Array(GAP).fill(""), ...right]);
  }

  return { grid, stockHeaderRows };
}

// ─── Formatting ──────────────────────────────────────────────────────────────

// Color helper — Google Sheets API wants RGB as floats in [0,1].
const rgb = (r: number, g: number, b: number) => ({ red: r / 255, green: g / 255, blue: b / 255 });

const COLORS = {
  headerBg:       rgb(26, 29, 46),     // #1a1d2e (matches calculator dark)
  headerFg:       rgb(221, 226, 240),  // #dde2f0
  stockHeaderBg:  rgb(232, 236, 246),  // #e8ecf6
  stockHeaderFg:  rgb(45, 49, 66),     // #2d3142
  positive:       rgb(52, 168, 83),    // #34a853
  negative:       rgb(212, 24, 61),    // #d4183d
  divider:        rgb(200, 202, 209),  // #c8cad1
};

type SheetsRequest = Record<string, unknown>;

async function applyMonthFormatting(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  sheetId: number,
  totalRows: number,
  stockHeaderRows: number[],
  existingRuleCount: number,
): Promise<void> {
  const requests: SheetsRequest[] = [];

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

  // Header row (dark background, light text, bold, centered)
  requests.push({
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
  });

  // Currency columns G–J (Unit Price, Item Total, Discount, Tx Total)
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 6, endColumnIndex: 10 },
      cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: '"Rp "#,##0' } } },
      fields: "userEnteredFormat.numberFormat",
    },
  });

  // Qty col E — decimals only if needed
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 4, endColumnIndex: 5 },
      cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: "0.##" } } },
      fields: "userEnteredFormat.numberFormat",
    },
  });

  // Stock AMOUNT col O — thousands separator
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 14, endColumnIndex: 15 },
      cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: "#,##0" } } },
      fields: "userEnteredFormat.numberFormat",
    },
  });

  // Stock Δ col P — signed
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 15, endColumnIndex: 16 },
      cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: "+#,##0;-#,##0;0" } } },
      fields: "userEnteredFormat.numberFormat",
    },
  });

  // Stock block header rows (date + AMOUNT + Δ labels) — bold + highlight
  for (const rowIdx of stockHeaderRows) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: rowIdx, endRowIndex: rowIdx + 1, startColumnIndex: 13, endColumnIndex: 16 },
        cell: {
          userEnteredFormat: {
            backgroundColor: COLORS.stockHeaderBg,
            textFormat: { foregroundColor: COLORS.stockHeaderFg, bold: true, fontSize: 10 },
            horizontalAlignment: "LEFT",
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
      },
    });
  }

  // Conditional formatting for Δ column — green positive, red negative
  requests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 15, endColumnIndex: 16 }],
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
        ranges: [{ sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 15, endColumnIndex: 16 }],
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
    90,   // A Date
    55,   // B Order
    60,   // C Time
    150,  // D Product
    60,   // E Qty
    50,   // F Unit
    95,   // G Unit Price
    100,  // H Item Total
    90,   // I Discount
    105,  // J Tx Total
    130,  // K Member
    180,  // L Remarks
    24,   // M (gap)
    110,  // N Stock label / date
    85,   // O AMOUNT
    75,   // P Δ
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
  const { grid, stockHeaderRows } = await buildMonthGrid(data);
  const tab = tabNameForMonth(yearMonth);
  const { sheets, sheetId } = getSheetsClient();
  const { sheetId: tabSheetId, existingRuleCount } = await ensureTab(sheets, sheetId, tab);
  await writeTab(sheets, sheetId, tab, grid);
  await applyMonthFormatting(sheets, sheetId, tabSheetId, grid.length, stockHeaderRows, existingRuleCount);
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
