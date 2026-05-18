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
