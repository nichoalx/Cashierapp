/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

// Load all Convex functions for the in-memory backend (exclude test files).
const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

const IDENTITY = { subject: "test-user|session-1" };

function newBackend() {
  return convexTest(schema, modules);
}

/** Seed a product with an optional stock row; returns ids. */
async function seedProduct(
  t: ReturnType<typeof convexTest>,
  opts: { name: string; unit: string; stockQty?: number },
) {
  return await t.run(async (ctx) => {
    const productId = await ctx.db.insert("products", {
      name: opts.name,
      fullName: opts.name,
      color: "#000000",
      unit: opts.unit,
      isActive: true,
    });
    if (opts.stockQty !== undefined) {
      await ctx.db.insert("stock", { productId, quantity: opts.stockQty, minThreshold: 0 });
    }
    return productId;
  });
}

describe("transactions.create — stock gate", () => {
  test("rejects the transaction and writes nothing when stock is insufficient", async () => {
    const t = newBackend();
    const asUser = t.withIdentity(IDENTITY);
    const productId = await seedProduct(t, { name: "MRB", unit: "kg", stockQty: 100 });

    await expect(
      asUser.mutation(api.transactions.create, {
        items: [{ productId, quantity: 150, unitPrice: 10, totalAmount: 1500 }],
      }),
    ).rejects.toThrow(/Stok tidak cukup/);

    // No transaction written, stock untouched.
    const { txCount, stockQty } = await t.run(async (ctx) => ({
      txCount: (await ctx.db.query("transactions").collect()).length,
      stockQty: (await ctx.db.query("stock").first())!.quantity,
    }));
    expect(txCount).toBe(0);
    expect(stockQty).toBe(100);
  });

  test("commits and decrements stock when there is enough", async () => {
    const t = newBackend();
    const asUser = t.withIdentity(IDENTITY);
    const productId = await seedProduct(t, { name: "MRB", unit: "kg", stockQty: 100 });

    await asUser.mutation(api.transactions.create, {
      items: [{ productId, quantity: 80, unitPrice: 10, totalAmount: 800 }],
    });

    const { txCount, stockQty } = await t.run(async (ctx) => ({
      txCount: (await ctx.db.query("transactions").collect()).length,
      stockQty: (await ctx.db.query("stock").first())!.quantity,
    }));
    expect(txCount).toBe(1);
    expect(stockQty).toBe(20);
  });

  test("aggregates quantity across multiple lines of the same product", async () => {
    const t = newBackend();
    const asUser = t.withIdentity(IDENTITY);
    const productId = await seedProduct(t, { name: "MRB", unit: "kg", stockQty: 100 });

    // 60 + 60 = 120 > 100 even though each line alone is under stock.
    await expect(
      asUser.mutation(api.transactions.create, {
        items: [
          { productId, quantity: 60, unitPrice: 10, totalAmount: 600 },
          { productId, quantity: 60, unitPrice: 10, totalAmount: 600 },
        ],
      }),
    ).rejects.toThrow(/Stok tidak cukup/);

    const txCount = await t.run(async (ctx) => (await ctx.db.query("transactions").collect()).length);
    expect(txCount).toBe(0);
  });

  test("gates plastic variants by variantId", async () => {
    const t = newBackend();
    const asUser = t.withIdentity(IDENTITY);
    const { productId, variantId } = await t.run(async (ctx) => {
      const pid = await ctx.db.insert("products", {
        name: "P", fullName: "Plastik", color: "#38b2ac", unit: "pcs", isActive: true,
      });
      const vid = await ctx.db.insert("productVariants", {
        productId: pid, variantType: "size", variantValue: "5x8",
      });
      await ctx.db.insert("stock", { productId: pid, variantId: vid, quantity: 10, minThreshold: 0 });
      return { productId: pid, variantId: vid };
    });

    await expect(
      asUser.mutation(api.transactions.create, {
        items: [{ productId, variantId, quantity: 20, unitPrice: 500, totalAmount: 10000 }],
      }),
    ).rejects.toThrow(/Stok tidak cukup/);
  });

  test("does not gate products that have no stock row (untracked)", async () => {
    const t = newBackend();
    const asUser = t.withIdentity(IDENTITY);
    const productId = await seedProduct(t, { name: "Tempe", unit: "pcs" }); // no stock row

    await asUser.mutation(api.transactions.create, {
      items: [{ productId, quantity: 999, unitPrice: 1, totalAmount: 999 }],
    });

    const txCount = await t.run(async (ctx) => (await ctx.db.query("transactions").collect()).length);
    expect(txCount).toBe(1);
  });

  test("still requires authentication", async () => {
    const t = newBackend();
    const productId = await seedProduct(t, { name: "MRB", unit: "kg", stockQty: 100 });
    await expect(
      t.mutation(api.transactions.create, {
        items: [{ productId, quantity: 1, unitPrice: 10, totalAmount: 10 }],
      }),
    ).rejects.toThrow(/Unauthorized/);
  });
});

describe("transactions.create — order date", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("uses the Jakarta calendar day, not UTC", async () => {
    vi.useFakeTimers();
    // 23:30 UTC on the 16th is 06:30 WIB on the 17th.
    vi.setSystemTime(new Date("2026-10-16T23:30:00Z"));
    const t = newBackend();
    const asUser = t.withIdentity(IDENTITY);
    const productId = await seedProduct(t, { name: "MRB", unit: "kg", stockQty: 100 });

    const txId = await asUser.mutation(api.transactions.create, {
      items: [{ productId, quantity: 1, unitPrice: 10, totalAmount: 10 }],
    });

    const tx = await t.run(async (ctx) => await ctx.db.get(txId));
    expect(tx?.date).toBe("2026-10-17");
  });
});

describe("transactions.update — stock", () => {
  /** Plastic product with two sizes, 50 pcs of each in stock. */
  async function seedPlastic(t: ReturnType<typeof convexTest>) {
    return await t.run(async (ctx) => {
      const productId = await ctx.db.insert("products", {
        name: "P", fullName: "Plastik", color: "#38b2ac", unit: "pcs", isActive: true,
      });
      const small = await ctx.db.insert("productVariants", { productId, variantType: "size", variantValue: "5x8" });
      const large = await ctx.db.insert("productVariants", { productId, variantType: "size", variantValue: "10x12" });
      await ctx.db.insert("stock", { productId, variantId: small, quantity: 50, minThreshold: 0 });
      await ctx.db.insert("stock", { productId, variantId: large, quantity: 50, minThreshold: 0 });
      return { productId, small, large };
    });
  }

  async function stockOf(t: ReturnType<typeof convexTest>, variantId: string) {
    return await t.run(async (ctx) =>
      (await ctx.db.query("stock").collect()).find(s => s.variantId === variantId)!.quantity);
  }

  async function onlyItem(t: ReturnType<typeof convexTest>) {
    return await t.run(async (ctx) => (await ctx.db.query("transactionItems").first())!);
  }

  test("changing a plastic size moves the stock from the old size to the new one", async () => {
    const t = newBackend();
    const asUser = t.withIdentity(IDENTITY);
    const { productId, small, large } = await seedPlastic(t);
    const txId = await asUser.mutation(api.transactions.create, {
      items: [{ productId, variantId: small, quantity: 10, unitPrice: 500, totalAmount: 5000 }],
    });
    expect(await stockOf(t, small)).toBe(40);

    const item = await onlyItem(t);
    await asUser.mutation(api.transactions.update, {
      txId, updatedItems: [{ id: item._id, quantity: 10, totalAmount: 5000, variantId: large }], removedItemIds: [],
    });

    expect(await stockOf(t, small)).toBe(50);
    expect(await stockOf(t, large)).toBe(40);
  });

  test("rejects an edit that draws more than is in stock, writing nothing", async () => {
    const t = newBackend();
    const asUser = t.withIdentity(IDENTITY);
    const { productId, small } = await seedPlastic(t);
    const txId = await asUser.mutation(api.transactions.create, {
      items: [{ productId, variantId: small, quantity: 10, unitPrice: 500, totalAmount: 5000 }],
    });
    const item = await onlyItem(t);

    // 10 already drawn + 40 left in stock: asking for 100 needs 90 more.
    await expect(
      asUser.mutation(api.transactions.update, {
        txId, updatedItems: [{ id: item._id, quantity: 100, totalAmount: 50_000 }], removedItemIds: [],
      }),
    ).rejects.toThrow(/Stok tidak cukup/);
    expect(await stockOf(t, small)).toBe(40);
    expect((await onlyItem(t)).quantity).toBe(10);

    // Within stock it goes through: 10 → 30 draws 20 more.
    await asUser.mutation(api.transactions.update, {
      txId, updatedItems: [{ id: item._id, quantity: 30, totalAmount: 15_000 }], removedItemIds: [],
    });
    expect(await stockOf(t, small)).toBe(20);
  });
});
