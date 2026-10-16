/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const IDENTITY = { subject: "test-user|session-1" };

type StockSnapshot = Doc<"stockSnapshots">;

// ── Legacy oracle: getMonthData exactly as it was before the paged rewrite ──
function legacyLatestSnapshotsByKey(snapshots: StockSnapshot[]) {
  const latest = new Map<string, StockSnapshot>();
  for (const snapshot of snapshots) {
    const key = `${snapshot.date}::${snapshot.productId}::${snapshot.variantId ?? ""}`;
    const existing = latest.get(key);
    const snapshotTime = snapshot._creationTime ?? snapshot.timestamp;
    const existingTime = existing?._creationTime ?? existing?.timestamp ?? 0;
    if (!existing || snapshotTime > existingTime) {
      latest.set(key, snapshot);
    }
  }
  return [...latest.values()];
}

function legacyPreviousDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 1, day));
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}

async function legacyGetMonthData(ctx: QueryCtx, args: { yearMonth: string }) {
  const monthPrefix = args.yearMonth;

  const allTxs = await ctx.db.query("transactions").collect();
  const txs = allTxs
    .filter(tx => tx.date.startsWith(monthPrefix))
    .sort((a, b) => a.timestamp - b.timestamp);

  const txDetails = await Promise.all(txs.map(async (tx) => {
    const items = await ctx.db
      .query("transactionItems")
      .withIndex("by_transactionId", q => q.eq("transactionId", tx._id))
      .collect();
    const itemDetails = await Promise.all(items.map(async (item) => {
      const product = await ctx.db.get(item.productId);
      const variant = item.variantId ? await ctx.db.get(item.variantId) : null;
      return {
        productName: variant
          ? `${product?.fullName ?? "?"} ${variant.variantValue}`
          : (product?.fullName ?? "?"),
        quantity: item.quantity,
        unit: product?.unit ?? "pcs",
        unitPrice: item.unitPrice,
        totalAmount: item.totalAmount,
      };
    }));
    const member = tx.memberId ? await ctx.db.get(tx.memberId) : null;
    return {
      date: tx.date,
      orderNumber: tx.orderNumber,
      timestamp: tx.timestamp,
      totalAmount: tx.totalAmount,
      amountPaid: tx.amountPaid ?? tx.totalAmount,
      discount: tx.discount ?? 0,
      remarks: tx.remarks ?? "",
      memberName: member?.name ?? "",
      items: itemDetails,
    };
  }));

  const allSnapshots = legacyLatestSnapshotsByKey(await ctx.db.query("stockSnapshots").collect());
  const snapshots = allSnapshots.filter(s => s.date.startsWith(monthPrefix));

  // Most recent snapshot before this month — used as delta baseline for the first date
  const monthStart = `${monthPrefix}-01`;
  const previousCalendarDate = legacyPreviousDate(monthStart);
  const hasPreviousCalendarSnapshot = allSnapshots.some(s => s.date === previousCalendarDate);
  const latestPrevDate = allSnapshots
    .map(s => s.date)
    .filter(d => hasPreviousCalendarSnapshot ? d === previousCalendarDate : d < monthStart)
    .sort()
    .pop() ?? null;
  const prevMonthSnapshots = latestPrevDate
    ? allSnapshots.filter(s => s.date === latestPrevDate)
    : [];

  const allProducts = await ctx.db
    .query("products")
    .filter(q => q.eq(q.field("isActive"), true))
    .collect();
  const products = allProducts.filter(p => p.name !== "E");

  const productInfo: Array<{
    productId: Id<"products">;
    variantId?: Id<"productVariants">;
    label: string;
    unit: string;
    sortKey: string;
  }> = [];

  for (const p of products) {
    const variants = await ctx.db
      .query("productVariants")
      .withIndex("by_productId", q => q.eq("productId", p._id))
      .collect();
    if (variants.length === 0) {
      productInfo.push({
        productId: p._id,
        label: p.name,
        unit: p.unit,
        sortKey: `${p.unit === "kg" ? "0" : "2"}-${p.name}`,
      });
    } else {
      for (const variant of variants) {
        productInfo.push({
          productId: p._id,
          variantId: variant._id,
          label: `${p.name} ${variant.variantValue}`,
          unit: p.unit,
          sortKey: `1-${p.name}-${variant.variantValue}`,
        });
      }
    }
  }
  productInfo.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const allPayments = await ctx.db.query("payments").collect();
  const currentMonthPayments = allPayments
    .filter(p => p.date.startsWith(monthPrefix))
    .sort((a, b) => a.timestamp - b.timestamp);

  // Compute running balance for every payment globally (so cross-month payments are accurate)
  const sortedAllPayments = [...allPayments].sort((a, b) => a.timestamp - b.timestamp);
  const uniquePaymentTxIds = [...new Set(sortedAllPayments.map(p => p.transactionId))];
  const paymentTxCache = new Map<string, { totalAmount: number; amountPaid: number }>();
  for (const txId of uniquePaymentTxIds) {
    const tx = await ctx.db.get(txId);
    if (tx) paymentTxCache.set(txId, { totalAmount: tx.totalAmount, amountPaid: tx.amountPaid ?? tx.totalAmount });
  }
  const runningByPaymentTx = new Map<string, number>();
  const paymentBalanceMap = new Map<string, number>();
  for (const p of sortedAllPayments) {
    const txData = paymentTxCache.get(p.transactionId);
    if (!txData) continue;
    const prev = runningByPaymentTx.get(p.transactionId) ?? 0;
    const newRunning = prev + p.amount;
    runningByPaymentTx.set(p.transactionId, newRunning);
    paymentBalanceMap.set(p._id, Math.max(0, Math.round(txData.totalAmount - txData.amountPaid - newRunning)));
  }

  // Month-end snapshot for carry-forward balance — only payments up to end of displayed month
  const monthEndDate = `${monthPrefix}-31`;
  const monthEndRunning = new Map<string, number>();
  for (const p of sortedAllPayments) {
    if (p.date > monthEndDate) continue;
    monthEndRunning.set(p.transactionId, (monthEndRunning.get(p.transactionId) ?? 0) + p.amount);
  }

  // Current month payment events
  const currentMonthPaymentDetails = await Promise.all(currentMonthPayments.map(async (p) => {
    const tx = await ctx.db.get(p.transactionId);
    const member = tx?.memberId ? await ctx.db.get(tx.memberId) : null;
    return {
      transactionId: p.transactionId,
      orderNumber: tx?.orderNumber ?? 0,
      txDate: tx?.date ?? "",
      memberName: member?.name ?? "",
      txTotal: tx?.totalAmount ?? 0,
      amountPaid: tx?.amountPaid ?? 0,
      paymentDate: p.date,
      amount: p.amount,
      balance: paymentBalanceMap.get(p._id) ?? 0,
      isOpeningBalance: false,
    };
  }));

  // Carry-forward: credit transactions from any month with outstanding balance and no payment this month
  const txIdsWithCurrentMonthPayment = new Set(currentMonthPayments.map(p => p.transactionId.toString()));
  const carryForwardDetails: typeof currentMonthPaymentDetails = [];
  for (const tx of allTxs) {
    if (tx.date > monthEndDate) continue;
    if (txIdsWithCurrentMonthPayment.has(tx._id)) continue;
    const initialPaid = tx.amountPaid ?? tx.totalAmount;
    if (initialPaid >= tx.totalAmount) continue;
    const totalExtraPayments = monthEndRunning.get(tx._id) ?? 0;
    const remaining = Math.max(0, Math.round(tx.totalAmount - initialPaid - totalExtraPayments));
    if (remaining <= 0) continue;
    const member = tx.memberId ? await ctx.db.get(tx.memberId) : null;
    carryForwardDetails.push({
      transactionId: tx._id,
      orderNumber: tx.orderNumber,
      txDate: tx.date,
      memberName: member?.name ?? "",
      txTotal: tx.totalAmount,
      amountPaid: tx.amountPaid ?? 0,
      paymentDate: "",
      amount: 0,
      balance: remaining,
      isOpeningBalance: false,
    });
  }

  const baseDetails = [...currentMonthPaymentDetails, ...carryForwardDetails];
  baseDetails.sort((a, b) => {
    const d = a.txDate.localeCompare(b.txDate);
    return d !== 0 ? d : a.orderNumber - b.orderNumber;
  });

  // Opening balance ("Saldo Awal"): for credits that originated in an earlier month
  // and received a payment THIS month, show the balance carried into this month so the
  // tab reconciles on its own. Computed identically to the global balance math above,
  // so it equals the prior month's closing Sisa.
  const monthStartDate = `${monthPrefix}-01`;
  const MONTH_LABELS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const pm = Number(monthPrefix.split("-")[1]);
  const prevMonthLabel = MONTH_LABELS[(pm - 2 + 12) % 12]; // month before the one being synced
  const openingLabel = `Sisa dari ${prevMonthLabel}`;
  const paidBeforeMonth = new Map<string, number>();
  for (const p of sortedAllPayments) {
    if (p.date < monthStartDate) {
      paidBeforeMonth.set(p.transactionId, (paidBeforeMonth.get(p.transactionId) ?? 0) + p.amount);
    }
  }
  const openingByGroupKey = new Map<string, (typeof baseDetails)[number]>();
  for (const d of currentMonthPaymentDetails) {
    if (!d.txDate || d.txDate >= monthStartDate) continue; // originated this month — no carry-in
    const key = `${d.orderNumber}::${d.txDate}::${d.memberName}`;
    if (openingByGroupKey.has(key)) continue;
    const txData = paymentTxCache.get(d.transactionId);
    if (!txData) continue;
    const paidBefore = paidBeforeMonth.get(d.transactionId) ?? 0;
    const opening = Math.max(0, Math.round(txData.totalAmount - txData.amountPaid - paidBefore));
    if (opening <= 0) continue;
    openingByGroupKey.set(key, {
      transactionId: d.transactionId,
      orderNumber: d.orderNumber,
      txDate: d.txDate,
      memberName: d.memberName,
      txTotal: d.txTotal,
      amountPaid: d.amountPaid,
      paymentDate: openingLabel,
      amount: 0,
      balance: opening,
      isOpeningBalance: true,
    });
  }

  // Weave each opening row in front of its order's first payment row
  const paymentDetails: typeof baseDetails = [];
  const emittedOpening = new Set<string>();
  for (const row of baseDetails) {
    const key = `${row.orderNumber}::${row.txDate}::${row.memberName}`;
    if (!emittedOpening.has(key)) {
      const opening = openingByGroupKey.get(key);
      if (opening) paymentDetails.push(opening);
      emittedOpening.add(key);
    }
    paymentDetails.push(row);
  }

  const allPriceHistory = await ctx.db
    .query("priceHistory")
    .withIndex("by_changedAt")
    .collect();
  const allCurrentPrices = await ctx.db.query("prices").collect();
  const priceProducts = productInfo
    .filter(pi => !pi.variantId)
    .map(pi => ({ productId: pi.productId, label: pi.label }));

  return { txDetails, snapshots, prevMonthSnapshots, productInfo, paymentDetails, priceHistory: allPriceHistory, currentPrices: allCurrentPrices, priceProducts };
}

// ── Seeded ledger ─────────────────────────────────────────────────────────────

/** Deterministic PRNG (mulberry32) so the seeded ledger is identical on every run. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const HOUR = 3_600_000;
/** 00:00 WIB of a "YYYY-MM-DD" date, as Unix ms. */
const wibDayStart = (date: string) => Date.parse(`${date}T00:00:00Z`) - 7 * HOUR;

function datesBetween(from: string, to: string) {
  const out: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * ~2,150 transactions (so the ledger spans two LEDGER_PAGE pages and March
 * spans two MONTH_TX_PAGE pages), ~2,100+ payments across months, walk-ins,
 * credit, discounts, a deleted member, a deleted variant, an inactive product,
 * eceran lines, an orphan payment, duplicate snapshots and a missing
 * month-end snapshot.
 */
async function seedLedger(ctx: MutationCtx) {
  const rand = rng(42);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

  const product = (name: string, fullName: string, unit: string, isActive = true) =>
    ctx.db.insert("products", { name, fullName, color: "#000000", unit, isActive });
  const mrb = await product("MRB", "Mr. Bean", "kg");
  const sbs = await product("SBS", "SBS", "kg");
  const eceran = await product("E", "Eceran", "kg");
  const old = await product("OLD", "Old Bean", "kg", false);
  const plastic = await product("P", "Plastik", "pcs");
  const v1 = await ctx.db.insert("productVariants", { productId: plastic, variantType: "size", variantValue: "5x8" });
  const v2 = await ctx.db.insert("productVariants", { productId: plastic, variantType: "size", variantValue: "10x12" });
  const vGone = await ctx.db.insert("productVariants", { productId: plastic, variantType: "size", variantValue: "12x20" });

  const t0 = Date.parse("2025-10-01T00:00:00Z");
  for (const [productId, price] of [[mrb, 10000], [sbs, 10500], [eceran, 11000], [old, 9000], [plastic, 1000]] as const) {
    await ctx.db.insert("prices", { productId, price, updatedAt: t0 });
  }
  for (const [variantId, price] of [[v1, 500], [v2, 1500]] as const) {
    await ctx.db.insert("prices", { productId: plastic, variantId, price, updatedAt: t0 });
  }
  await ctx.db.insert("priceHistory", { productId: mrb, oldPrice: 9500, newPrice: 10000, changedAt: Date.parse("2026-01-10T03:00:00Z") });
  await ctx.db.insert("priceHistory", { productId: plastic, oldPrice: 900, newPrice: 1000, changedAt: Date.parse("2026-02-02T03:00:00Z") });
  await ctx.db.insert("priceHistory", { productId: sbs, oldPrice: 10000, newPrice: 10500, changedAt: Date.parse("2026-03-05T03:00:00Z") });
  await ctx.db.insert("priceHistory", { productId: mrb, oldPrice: 10000, newPrice: 10000, changedAt: Date.parse("2026-03-20T03:00:00Z") });
  await ctx.db.insert("priceHistory", { productId: plastic, variantId: v1, oldPrice: 400, newPrice: 500, changedAt: Date.parse("2026-03-21T03:00:00Z") });

  const stockKeys: Array<{ productId: Id<"products">; variantId?: Id<"productVariants"> }> = [
    { productId: mrb }, { productId: sbs }, { productId: eceran },
    { productId: plastic, variantId: v1 }, { productId: plastic, variantId: v2 }, { productId: plastic, variantId: vGone },
  ];
  for (const k of stockKeys) {
    await ctx.db.insert("stock", { ...k, quantity: 1000, minThreshold: 0 });
  }

  const members: Id<"members">[] = [];
  for (const name of ["Hendri", "Saimah", "Cas", "Yanti", "Untung"]) {
    members.push(await ctx.db.insert("members", { name }));
  }
  const goneMember = await ctx.db.insert("members", { name: "Gone" });
  members.push(goneMember);

  const lines: Array<{ productId: Id<"products">; variantId?: Id<"productVariants">; displayName?: string; price: number }> = [
    { productId: mrb, price: 10000 }, { productId: sbs, price: 10500 },
    { productId: mrb, displayName: "E", price: 11000 }, { productId: old, price: 9000 },
    { productId: plastic, variantId: v1, price: 500 }, { productId: plastic, variantId: v2, price: 1500 },
    { productId: plastic, variantId: vGone, price: 2500 },
  ];

  let tick = 0;
  const orderByDate = new Map<string, number>();
  const credit: Array<{ id: Id<"transactions">; date: string; total: number }> = [];
  const paidInFull: Array<{ id: Id<"transactions">; date: string }> = [];
  const addTx = async (date: string) => {
    const orderNumber = (orderByDate.get(date) ?? 0) + 1;
    orderByDate.set(date, orderNumber);
    const chosen = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => pick(lines));
    const qtys = chosen.map(() => 1 + Math.floor(rand() * 40));
    const subtotal = chosen.reduce((s, l, i) => s + l.price * qtys[i], 0);
    const discount = rand() < 0.1 ? Math.round(subtotal * 0.05) : 0;
    const totalAmount = subtotal - discount;
    const isCredit = rand() < 0.4;
    const amountPaid = isCredit ? (rand() < 0.5 ? 0 : Math.floor(totalAmount * rand() * 0.8)) : undefined;
    const txId = await ctx.db.insert("transactions", {
      orderNumber,
      date,
      timestamp: wibDayStart(date) + 8 * HOUR + tick++ * 1000,
      totalAmount,
      discount: discount > 0 ? discount : undefined,
      amountPaid,
      remarks: rand() < 0.15 ? `catatan ${orderNumber}` : undefined,
      memberId: rand() < 0.2 ? undefined : pick(members),
    });
    for (let i = 0; i < chosen.length; i++) {
      const l = chosen[i];
      await ctx.db.insert("transactionItems", {
        transactionId: txId,
        productId: l.productId,
        variantId: l.variantId,
        quantity: qtys[i],
        unitPrice: l.price,
        totalAmount: l.price * qtys[i],
        displayName: l.displayName,
      });
    }
    if (isCredit) credit.push({ id: txId, date, total: totalAmount - (amountPaid ?? 0) });
    else paidInFull.push({ id: txId, date });
    return txId;
  };

  const perDay: Array<[string, string, number]> = [
    ["2025-11-01", "2025-12-31", 25],
    ["2026-02-01", "2026-02-28", 4],
    ["2026-03-01", "2026-03-31", 12],
    ["2026-04-01", "2026-04-30", 5],
  ];
  for (const [from, to, n] of perDay) {
    for (const date of datesBetween(from, to)) {
      for (let i = 0; i < n; i++) await addTx(date);
    }
  }

  // Payments: 1–4 per credit order, dated on or after the order, some months later.
  const pay = (transactionId: Id<"transactions">, date: string, amount: number) =>
    ctx.db.insert("payments", { transactionId, date, amount, timestamp: wibDayStart(date) + 10 * HOUR + tick++ });
  for (const c of credit) {
    const n = 1 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
      const date = addDays(c.date, Math.floor(rand() * 70));
      await pay(c.id, date > "2026-05-15" ? "2026-05-15" : date, Math.max(1000, Math.round((c.total * rand()) / 3)));
    }
  }
  // A few payments against orders that were already paid in full.
  for (const p of paidInFull.slice(0, 5)) await pay(p.id, p.date, 500);

  // Orphan payment: its order was deleted (the old transactions.remove left these behind).
  const orphanTx = await addTx("2026-03-15");
  await pay(orphanTx, "2026-03-20", 7000);
  for (const item of await ctx.db.query("transactionItems").withIndex("by_transactionId", q => q.eq("transactionId", orphanTx)).collect()) {
    await ctx.db.delete(item._id);
  }
  await ctx.db.delete(orphanTx);

  await ctx.db.delete(goneMember);
  await ctx.db.delete(vGone);

  // Snapshots: one early baseline, daily Feb–Apr except 2026-03-31, plus duplicates.
  const snapshotDates = ["2026-01-15", ...datesBetween("2026-02-01", "2026-04-30").filter(d => d !== "2026-03-31")];
  for (const date of snapshotDates) {
    for (const k of stockKeys) {
      await ctx.db.insert("stockSnapshots", { date, ...k, quantity: Math.floor(rand() * 5000), timestamp: wibDayStart(date) + 20 * HOUR });
    }
  }
  for (let i = 0; i < 12; i++) {
    const date = pick(snapshotDates);
    await ctx.db.insert("stockSnapshots", { date, ...pick(stockKeys), quantity: 99_000 + i, timestamp: wibDayStart(date) + 21 * HOUR });
  }
}

const slimSnapshots = (rows: Array<{ date: string; productId: string; variantId?: string; quantity: number }>) =>
  rows
    .map(s => ({ date: s.date, productId: s.productId, variantId: s.variantId, quantity: s.quantity }))
    .sort((a, b) => `${a.date}|${a.productId}|${a.variantId ?? ""}`.localeCompare(`${b.date}|${b.productId}|${b.variantId ?? ""}`));

describe("sheetsSyncData.loadMonthData", () => {
  test("returns exactly what the old single-query getMonthData returned", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => { await seedLedger(ctx); });

    const counts = await t.run(async (ctx) => ({
      txs: (await ctx.db.query("transactions").collect()).length,
      payments: (await ctx.db.query("payments").collect()).length,
      march: (await ctx.db.query("transactions").withIndex("by_date", q => q.gte("date", "2026-03-01").lte("date", "2026-03-31")).collect()).length,
    }));
    // Make sure the seed actually crosses every page boundary.
    expect(counts.txs).toBeGreaterThan(2000);
    expect(counts.payments).toBeGreaterThan(2000);
    expect(counts.march).toBeGreaterThan(300);

    for (const yearMonth of ["2025-12", "2026-02", "2026-03", "2026-04", "2026-05"]) {
      const legacy = await t.run(async (ctx) => await legacyGetMonthData(ctx, { yearMonth }));
      const paged = await t.action(internal.sheetsSyncData.loadMonthData, { yearMonth });

      expect(paged.txDetails, yearMonth).toEqual(legacy.txDetails);
      expect(paged.paymentDetails, yearMonth).toEqual(legacy.paymentDetails);
      expect(slimSnapshots(paged.snapshots), yearMonth).toEqual(slimSnapshots(legacy.snapshots));
      expect(slimSnapshots(paged.prevMonthSnapshots), yearMonth).toEqual(slimSnapshots(legacy.prevMonthSnapshots));
      expect(paged.productInfo, yearMonth).toEqual(legacy.productInfo);
      expect(paged.priceHistory, yearMonth).toEqual(legacy.priceHistory);
      expect(paged.currentPrices, yearMonth).toEqual(legacy.currentPrices);
      expect(paged.priceProducts, yearMonth).toEqual(legacy.priceProducts);
    }

    // The comparison above is only meaningful if the tricky rows are present.
    const march = await t.action(internal.sheetsSyncData.loadMonthData, { yearMonth: "2026-03" });
    expect(march.txDetails.length).toBeGreaterThan(300);
    expect(march.paymentDetails.some(d => d.isOpeningBalance)).toBe(true);      // "Sisa dari February"
    expect(march.paymentDetails.some(d => d.paymentDate === "")).toBe(true);     // carry-forward
    expect(march.paymentDetails.some(d => d.orderNumber === 0)).toBe(true);      // orphan payment
    expect(march.txDetails.some(tx => tx.items.some(i => i.productName === "Plastik"))).toBe(true); // deleted size
  }, 120_000);
});

// ── Stock snapshots ───────────────────────────────────────────────────────────

describe("stock snapshots", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  async function seedTwoProducts(t: ReturnType<typeof convexTest>) {
    return await t.run(async (ctx) => {
      const a = await ctx.db.insert("products", { name: "MRB", fullName: "Mr. Bean", color: "#000", unit: "kg", isActive: true });
      const b = await ctx.db.insert("products", { name: "SBS", fullName: "SBS", color: "#000", unit: "kg", isActive: true });
      await ctx.db.insert("stock", { productId: a, quantity: 10, minThreshold: 0 });
      await ctx.db.insert("stock", { productId: b, quantity: 20, minThreshold: 0 });
      return { a, b };
    });
  }

  test("takeSnapshotIfMissing fills only products without a row today, keeping manual fixes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T16:55:00Z")); // 23:55 WIB
    const t = convexTest(schema, modules);
    const { a, b } = await seedTwoProducts(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("stockSnapshots", { date: "2026-10-16", productId: a, quantity: 99, timestamp: 1 });
    });

    const result = await t.mutation(internal.sheetsSyncData.takeSnapshotIfMissing, {});

    expect(result).toEqual({ created: 1, date: "2026-10-16" });
    const rows = await t.run(async (ctx) =>
      await ctx.db.query("stockSnapshots").withIndex("by_date", q => q.eq("date", "2026-10-16")).collect());
    expect(rows.map(r => [r.productId, r.quantity]).sort()).toEqual([[a, 99], [b, 20]].sort());
  });

  test("the month's stock column shows live stock for today until the closing snapshot exists", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T05:00:00Z")); // 12:00 WIB
    const t = convexTest(schema, modules);
    const { a, b } = await seedTwoProducts(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("stockSnapshots", { date: "2026-10-15", productId: a, quantity: 5, timestamp: 1 });
      await ctx.db.insert("stockSnapshots", { date: "2026-10-15", productId: b, quantity: 6, timestamp: 1 });
      await ctx.db.insert("stockSnapshots", { date: "2026-10-16", productId: a, quantity: 99, timestamp: 2 });
    });

    const { snapshots } = await t.query(internal.sheetsSyncData.getMonthStatic, { yearMonth: "2026-10" });

    const today = snapshots.filter(s => s.date === "2026-10-16").map(s => [s.productId, s.quantity]).sort();
    expect(today).toEqual([[a, 99], [b, 20]].sort()); // stored row wins; missing product uses live stock
  });

  test("reconstructSnapshotForDate adds back later sales and takes off later additions and corrections", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity(IDENTITY);
    const { productId } = await t.run(async (ctx) => {
      const productId = await ctx.db.insert("products", { name: "MRB", fullName: "Mr. Bean", color: "#000", unit: "kg", isActive: true });
      await ctx.db.insert("stock", { productId, quantity: 100, minThreshold: 0 });
      const sale = async (date: string, quantity: number, orderNumber: number) => {
        const transactionId = await ctx.db.insert("transactions", {
          orderNumber, date, timestamp: wibDayStart(date) + 9 * HOUR, totalAmount: quantity * 1000,
        });
        await ctx.db.insert("transactionItems", { transactionId, productId, quantity, unitPrice: 1000, totalAmount: quantity * 1000 });
      };
      await sale("2026-10-09", 7, 1);  // on the target day — already reflected in its closing stock
      await sale("2026-10-10", 20, 1); // after — add back
      // Addition late on the target day stays; the next morning's is taken off.
      await ctx.db.insert("stockAdditions", { productId, quantity: 9, timestamp: Date.parse("2026-10-09T20:00:00+07:00") });
      await ctx.db.insert("stockAdditions", { productId, quantity: 50, timestamp: Date.parse("2026-10-10T03:00:00+07:00") });
      await ctx.db.insert("stockCorrections", { productId, delta: -5, timestamp: Date.parse("2026-10-12T10:00:00+07:00") });
      return { productId };
    });

    await asUser.action(api.sheetsSyncData.reconstructSnapshotForDate, { date: "2026-10-09" });

    const rows = await t.run(async (ctx) =>
      await ctx.db.query("stockSnapshots").withIndex("by_date", q => q.eq("date", "2026-10-09")).collect());
    expect(rows.map(r => [r.productId, r.quantity])).toEqual([[productId, 100 + 20 - 50 + 5]]);
  });
});
