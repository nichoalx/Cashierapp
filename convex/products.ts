import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const listWithPrices = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const products = await ctx.db
      .query("products")
      .filter(q => q.eq(q.field("isActive"), true))
      .collect();

    return await Promise.all(
      products.map(async (product) => {
        const priceRecord = await ctx.db
          .query("prices")
          .withIndex("by_productId", q => q.eq("productId", product._id))
          .filter(q => q.eq(q.field("variantId"), undefined))
          .first();

        const variants = await ctx.db
          .query("productVariants")
          .withIndex("by_productId", q => q.eq("productId", product._id))
          .collect();

        const variantsWithPrices = await Promise.all(
          variants.map(async (variant) => {
            const vPrice = await ctx.db
              .query("prices")
              .withIndex("by_variantId", q => q.eq("variantId", variant._id))
              .first();
            return { ...variant, price: vPrice?.price ?? 0 };
          })
        );

        return {
          ...product,
          price: priceRecord?.price ?? 0,
          variants: variantsWithPrices,
        };
      })
    );
  },
});

// Upsert base price for a product (no variant)
export const updatePrice = mutation({
  args: { productId: v.id("products"), price: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const now = Date.now();
    const existing = await ctx.db
      .query("prices")
      .withIndex("by_productId", q => q.eq("productId", args.productId))
      .filter(q => q.eq(q.field("variantId"), undefined))
      .first();

    if (existing) {
      await ctx.db.insert("priceHistory", {
        productId: args.productId,
        oldPrice: existing.price,
        newPrice: args.price,
        changedAt: now,
      });
      await ctx.db.patch(existing._id, { price: args.price, updatedAt: now });
    } else {
      await ctx.db.insert("prices", { productId: args.productId, price: args.price, updatedAt: now });
    }
  },
});

// Update a product's display color
export const updateColor = mutation({
  args: { productId: v.id("products"), color: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    await ctx.db.patch(args.productId, { color: args.color });
  },
});

// Add a new soybean product with initial price and empty stock
export const addSoybean = mutation({
  args: { name: v.string(), fullName: v.string(), color: v.string(), price: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const productId = await ctx.db.insert("products", {
      name: args.name,
      fullName: args.fullName,
      color: args.color,
      unit: "kg",
      isActive: true,
    });
    const now = Date.now();
    await ctx.db.insert("prices", { productId, price: args.price, updatedAt: now });
    await ctx.db.insert("stock", { productId, quantity: 0, minThreshold: 50 });
    return productId;
  },
});

// Soft-delete a product (keeps transaction history intact)
export const deactivate = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    await ctx.db.patch(args.productId, { isActive: false });
  },
});

// Update base price + all variant prices (plastic "all sizes same price" behavior)
export const updateAllVariantPrices = mutation({
  args: { productId: v.id("products"), price: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const now = Date.now();

    const basePrice = await ctx.db
      .query("prices")
      .withIndex("by_productId", q => q.eq("productId", args.productId))
      .filter(q => q.eq(q.field("variantId"), undefined))
      .first();
    if (basePrice) {
      await ctx.db.insert("priceHistory", {
        productId: args.productId,
        oldPrice: basePrice.price,
        newPrice: args.price,
        changedAt: now,
      });
      await ctx.db.patch(basePrice._id, { price: args.price, updatedAt: now });
    } else {
      await ctx.db.insert("prices", { productId: args.productId, price: args.price, updatedAt: now });
    }

    const variants = await ctx.db
      .query("productVariants")
      .withIndex("by_productId", q => q.eq("productId", args.productId))
      .collect();

    for (const variant of variants) {
      const varPrice = await ctx.db
        .query("prices")
        .withIndex("by_variantId", q => q.eq("variantId", variant._id))
        .first();
      if (varPrice) {
        await ctx.db.insert("priceHistory", {
          productId: args.productId,
          variantId: variant._id,
          oldPrice: varPrice.price,
          newPrice: args.price,
          changedAt: now,
        });
        await ctx.db.patch(varPrice._id, { price: args.price, updatedAt: now });
      } else {
        await ctx.db.insert("prices", { productId: args.productId, variantId: variant._id, price: args.price, updatedAt: now });
      }
    }
  },
});

// Add a plastic size variant with its own price and stock entry
export const addVariant = mutation({
  args: { productId: v.id("products"), variantValue: v.string(), price: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const variantId = await ctx.db.insert("productVariants", {
      productId: args.productId,
      variantType: "size",
      variantValue: args.variantValue,
    });
    const now = Date.now();
    await ctx.db.insert("prices", { productId: args.productId, variantId, price: args.price, updatedAt: now });
    await ctx.db.insert("stock", { productId: args.productId, variantId, quantity: 0, minThreshold: 200 });
    return variantId;
  },
});

// Remove a plastic size variant (keeps stock record for history)
export const removeVariant = mutation({
  args: { variantId: v.id("productVariants") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const priceRecord = await ctx.db
      .query("prices")
      .withIndex("by_variantId", q => q.eq("variantId", args.variantId))
      .first();
    if (priceRecord) await ctx.db.delete(priceRecord._id);

    await ctx.db.delete(args.variantId);
  },
});
