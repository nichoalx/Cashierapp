import { internalAction, internalMutation } from "./_generated/server";
import { createAccount } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const seedProducts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("products").first();
    if (existing) return { status: "already_exists" };

    const now = Date.now();

    const PRODUCTS = [
      { name: "MRB", fullName: "Mr. Bean",   color: "#f5903d", unit: "kg",  price: 10000 },
      { name: "SBS", fullName: "SBS",         color: "#4a90d9", unit: "kg",  price: 10500  },
      { name: "BH",  fullName: "Bola Hijau",  color: "#52b96a", unit: "kg",  price: 11000 },
      { name: "E",   fullName: "Eceran",      color: "#9b6dff", unit: "kg",  price: 11000  },
      { name: "T",   fullName: "Tempe",       color: "#d4a017", unit: "pcs", price: 2000  },
      { name: "D",   fullName: "Dages",       color: "#e05a6a", unit: "pcs", price: 1500  },
    ] as const;

    for (const p of PRODUCTS) {
      const productId = await ctx.db.insert("products", {
        name: p.name, fullName: p.fullName, color: p.color,
        unit: p.unit, isActive: true,
      });
      await ctx.db.insert("prices", { productId, price: p.price, updatedAt: now });
      await ctx.db.insert("stock", { productId, quantity: 0, minThreshold: p.unit === "kg" ? 50 : 100 });
    }

    // Plastik product + 3 default sizes
    const plasticId = await ctx.db.insert("products", {
      name: "P", fullName: "Plastik", color: "#38b2ac", unit: "pcs", isActive: true,
    });
    await ctx.db.insert("prices", { productId: plasticId, price: 1000, updatedAt: now });

    for (const { size, price } of [
      { size: "5×8",   price: 500  },
      { size: "10×12", price: 1500 },
      { size: "12×20", price: 2500 },
    ]) {
      const variantId = await ctx.db.insert("productVariants", {
        productId: plasticId, variantType: "size", variantValue: size,
      });
      await ctx.db.insert("prices", { productId: plasticId, variantId, price, updatedAt: now });
      await ctx.db.insert("stock", { productId: plasticId, variantId, quantity: 0, minThreshold: 200 });
    }

    return { status: "created" };
  },
});

export const setSoybeanThresholds = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allStock = await ctx.db.query("stock").collect();
    let updated = 0;
    for (const row of allStock) {
      const product = await ctx.db.get(row.productId);
      if (product?.unit === 'kg' && product.name !== 'E') {
        await ctx.db.patch(row._id, { minThreshold: 3000 });
        updated++;
      }
    }
    return { updated };
  },
});

export const cleanOrphanedStock = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allStock = await ctx.db.query("stock").collect();
    let deleted = 0;
    for (const row of allStock) {
      if (!row.variantId) continue;
      const variant = await ctx.db.get(row.variantId);
      if (!variant) {
        await ctx.db.delete(row._id);
        deleted++;
      }
    }
    return { deleted };
  },
});

export const reseedPlasticVariants = internalMutation({
  args: {},
  handler: async (ctx) => {
    const plastic = await ctx.db
      .query("products")
      .withIndex("by_name", q => q.eq("name", "P"))
      .first();
    if (!plastic) return { status: "no_plastic_product" };

    const existingVariants = await ctx.db
      .query("productVariants")
      .withIndex("by_productId", q => q.eq("productId", plastic._id))
      .collect();
    if (existingVariants.length > 0) return { status: "already_exists", count: existingVariants.length };

    const now = Date.now();
    const SIZES = [
      { size: "5×8",   price: 500  },
      { size: "10×12", price: 1500 },
      { size: "12×20", price: 2500 },
    ];

    // Remove the bare Plastik stock row (no variantId) that restoreStock created
    const bareStockRow = await ctx.db
      .query("stock")
      .withIndex("by_productId", q => q.eq("productId", plastic._id))
      .filter(q => q.eq(q.field("variantId"), undefined))
      .first();
    if (bareStockRow) await ctx.db.delete(bareStockRow._id);

    for (const { size, price } of SIZES) {
      const variantId = await ctx.db.insert("productVariants", {
        productId: plastic._id,
        variantType: "size",
        variantValue: size,
      });
      // Upsert price for this variant
      const existingPrice = await ctx.db
        .query("prices")
        .withIndex("by_variantId", q => q.eq("variantId", variantId))
        .first();
      if (!existingPrice) {
        await ctx.db.insert("prices", { productId: plastic._id, variantId, price, updatedAt: now });
      }
      await ctx.db.insert("stock", {
        productId: plastic._id,
        variantId,
        quantity: 0,
        minThreshold: 200,
      });
    }

    return { status: "created", variants: SIZES.length };
  },
});

export const restoreStock = internalMutation({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    const variants = await ctx.db.query("productVariants").collect();

    // Get most recent snapshot per (productId, variantId) key
    const snapshots = await ctx.db.query("stockSnapshots").collect();
    const latestSnapshot = new Map<string, number>();
    for (const s of snapshots) {
      const key = `${s.productId}:${s.variantId ?? ""}`;
      const existing = latestSnapshot.get(key);
      if (existing === undefined || s.timestamp > (snapshots.find(x => `${x.productId}:${x.variantId ?? ""}` === key && x.quantity === existing)?.timestamp ?? 0)) {
        latestSnapshot.set(key, s.quantity);
      }
    }

    // Rebuild latest snapshot map properly (max timestamp per key)
    const latestByKey = new Map<string, { quantity: number; timestamp: number }>();
    for (const s of snapshots) {
      const key = `${s.productId}:${s.variantId ?? ""}`;
      const prev = latestByKey.get(key);
      if (!prev || s.timestamp > prev.timestamp) {
        latestByKey.set(key, { quantity: s.quantity, timestamp: s.timestamp });
      }
    }

    let created = 0;

    // Non-variant products
    for (const p of products) {
      const productVariants = variants.filter(v => v.productId === p._id);
      if (productVariants.length > 0) continue; // handled below

      const existing = await ctx.db
        .query("stock")
        .withIndex("by_productId", q => q.eq("productId", p._id))
        .filter(q => q.eq(q.field("variantId"), undefined))
        .first();
      if (existing) continue;

      const key = `${p._id}:`;
      const snap = latestByKey.get(key);
      await ctx.db.insert("stock", {
        productId: p._id,
        quantity: snap?.quantity ?? 0,
        minThreshold: p.unit === "kg" ? 50 : 100,
      });
      created++;
    }

    // Variant products (plastic sizes)
    for (const variant of variants) {
      const existing = await ctx.db
        .query("stock")
        .withIndex("by_variantId", q => q.eq("variantId", variant._id))
        .first();
      if (existing) continue;

      const key = `${variant.productId}:${variant._id}`;
      const snap = latestByKey.get(key);
      await ctx.db.insert("stock", {
        productId: variant.productId,
        variantId: variant._id,
        quantity: snap?.quantity ?? 0,
        minThreshold: 200,
      });
      created++;
    }

    return { status: "ok", created, restoredFromSnapshots: latestByKey.size > 0 };
  },
});

export const createAdminUser = internalAction({
  args: { password: v.string() },
  handler: async (ctx, { password }) => {
    try {
      await createAccount(ctx, {
        provider: "password",
        account: { id: "agromudaanugerahrddk@gmail.com", secret: password },
        profile: { email: "agromudaanugerahrddk@gmail.com", name: "Agromuda" },
      });
      return { status: "created" };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("exists")) {
        return { status: "already_exists" };
      }
      throw err;
    }
  },
});
