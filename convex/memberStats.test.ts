/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const IDENTITY = { subject: "test-user|session-1" };

afterEach(() => {
  vi.useRealTimers();
});

async function setup(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const productId = await ctx.db.insert("products", {
      name: "MRB", fullName: "MRB", color: "#000000", unit: "kg", isActive: true,
    });
    await ctx.db.insert("stock", { productId, quantity: 100_000, minThreshold: 0 });
    const a = await ctx.db.insert("members", { name: "A" });
    const b = await ctx.db.insert("members", { name: "B" });
    return { productId, a, b };
  });
}

const line = (productId: Id<"products">, quantity: number) =>
  ({ productId, quantity, unitPrice: 1000, totalAmount: quantity * 1000 });

async function statsOf(t: ReturnType<typeof convexTest>, memberId: Id<"members">) {
  const m = await t.run(async (ctx) => await ctx.db.get(memberId));
  return { outstanding: m?.outstanding, visitCount: m?.visitCount, lastVisitDate: m?.lastVisitDate };
}

async function runBackfill(t: ReturnType<typeof convexTest>) {
  vi.useFakeTimers();
  await t.mutation(internal.migrations.backfillMemberStats, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  vi.useRealTimers();
}

describe("member stats — deltas on write", () => {
  test("create / pay / edit / reassign / remove keep stats equal to a full recompute", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity(IDENTITY);
    const { productId, a, b } = await setup(t);

    // A: 10,000 on credit + a paid order. B: 20,000 with 5,000 paid up front.
    const tx1 = await asUser.mutation(api.transactions.create, { items: [line(productId, 10)], memberId: a, amountPaid: 0 });
    await asUser.mutation(api.transactions.create, { items: [line(productId, 5)], memberId: a });
    const tx3 = await asUser.mutation(api.transactions.create, { items: [line(productId, 20)], memberId: b, amountPaid: 5000 });
    expect((await statsOf(t, a)).outstanding).toBe(10_000);
    expect((await statsOf(t, a)).visitCount).toBe(2);
    expect((await statsOf(t, b)).outstanding).toBe(15_000);

    // Pay 4,000 then correct it to 3,000 → A owes 7,000.
    const pay = await asUser.mutation(api.payments.record, { transactionId: tx1, date: "2026-10-16", amount: 4000 });
    await asUser.mutation(api.payments.update, { paymentId: pay, amount: 3000, date: "2026-10-16" });
    expect((await statsOf(t, a)).outstanding).toBe(7_000);

    // Edit tx1 up to 12 kg (12,000) → A owes 12,000 − 3,000 = 9,000.
    const [item1] = await t.run(async (ctx) =>
      await ctx.db.query("transactionItems").withIndex("by_transactionId", q => q.eq("transactionId", tx1)).collect());
    await asUser.mutation(api.transactions.update, {
      txId: tx1, updatedItems: [{ id: item1._id, quantity: 12, totalAmount: 12_000 }], removedItemIds: [], memberId: a,
    });
    expect((await statsOf(t, a)).outstanding).toBe(9_000);

    // Reassign tx3 from B to A → A owes 24,000 over 3 orders; B owes nothing.
    const [item3] = await t.run(async (ctx) =>
      await ctx.db.query("transactionItems").withIndex("by_transactionId", q => q.eq("transactionId", tx3)).collect());
    await asUser.mutation(api.transactions.update, {
      txId: tx3, updatedItems: [{ id: item3._id, quantity: 20, totalAmount: 20_000 }], removedItemIds: [], memberId: a,
    });
    expect(await statsOf(t, a)).toMatchObject({ outstanding: 24_000, visitCount: 3 });
    expect(await statsOf(t, b)).toMatchObject({ outstanding: 0, visitCount: 0, lastVisitDate: undefined });

    // Remove tx1 (and its payment) → A owes 15,000 over 2 orders.
    await asUser.mutation(api.transactions.remove, { txId: tx1 });
    const afterDeltas = { a: await statsOf(t, a), b: await statsOf(t, b) };
    expect(afterDeltas.a).toMatchObject({ outstanding: 15_000, visitCount: 2 });

    // The nightly recompute from source must agree with the deltas exactly.
    await runBackfill(t);
    expect({ a: await statsOf(t, a), b: await statsOf(t, b) }).toEqual(afterDeltas);
  });

  test("removing a transaction deletes its payments", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity(IDENTITY);
    const { productId, a } = await setup(t);

    const txId = await asUser.mutation(api.transactions.create, { items: [line(productId, 10)], memberId: a, amountPaid: 0 });
    await asUser.mutation(api.payments.record, { transactionId: txId, date: "2026-10-16", amount: 1000 });
    await asUser.mutation(api.payments.record, { transactionId: txId, date: "2026-10-16", amount: 2000 });
    await asUser.mutation(api.transactions.remove, { txId });

    const left = await t.run(async (ctx) => (await ctx.db.query("payments").collect()).length);
    expect(left).toBe(0);
    expect(await statsOf(t, a)).toMatchObject({ outstanding: 0, visitCount: 0 });
  });
});

describe("migrations.backfillMemberStats", () => {
  test("pages through a member with more than one page of history and continues to the next member", async () => {
    const t = convexTest(schema, modules);
    const { big, small } = await t.run(async (ctx) => {
      const big = await ctx.db.insert("members", { name: "Big", outstanding: 1, visitCount: 1 });
      const small = await ctx.db.insert("members", { name: "Small" });
      for (let i = 0; i < 1200; i++) {
        const txId = await ctx.db.insert("transactions", {
          orderNumber: i + 1, date: i === 1199 ? "2026-10-15" : "2026-09-01",
          timestamp: 1_000 + i, totalAmount: 100, amountPaid: 0, memberId: big,
        });
        if (i % 3 === 0) {
          await ctx.db.insert("payments", { transactionId: txId, date: "2026-10-01", amount: 30, timestamp: 5_000 + i });
        }
      }
      await ctx.db.insert("transactions", {
        orderNumber: 1, date: "2026-10-02", timestamp: 9_000, totalAmount: 500, amountPaid: 200, memberId: small,
      });
      return { big, small };
    });

    await runBackfill(t);

    expect(await statsOf(t, big)).toEqual({ outstanding: 1200 * 100 - 400 * 30, visitCount: 1200, lastVisitDate: "2026-10-15" });
    expect(await statsOf(t, small)).toEqual({ outstanding: 300, visitCount: 1, lastVisitDate: "2026-10-02" });
  });
});
