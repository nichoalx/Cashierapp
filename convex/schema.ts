import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  // ─── Products ────────────────────────────────────────────────────────────────

  products: defineTable({
    name: v.string(),      // Short display code: "MRB", "SBS", "BH", "E", "Tempe", "Dages"
    fullName: v.string(),  // Full name: "Mutu Rendah Besar"
    color: v.string(),     // Hex: "#f5903d"
    unit: v.string(),      // "kg" | "pcs"
    isActive: v.boolean(), // Soft delete — never hard-delete products (breaks history)
  }).index("by_name", ["name"]),

  // Variants only exist for products that have them (e.g., plastic bag sizes).
  // No price here — price lives exclusively in the prices table.
  productVariants: defineTable({
    productId: v.id("products"),
    variantType: v.string(),  // "size"
    variantValue: v.string(), // "5x8", "10x12", "12x20"
  }).index("by_productId", ["productId"]),

  // ─── Pricing ─────────────────────────────────────────────────────────────────

  // One row per product (or variant). Upserted on every price change.
  // This is always the current price — single source of truth.
  prices: defineTable({
    productId: v.id("products"),
    variantId: v.optional(v.id("productVariants")),
    price: v.number(),
    updatedAt: v.number(),
  })
    .index("by_productId", ["productId"])
    .index("by_variantId", ["variantId"]),

  // Full audit log. Written alongside every prices upsert.
  priceHistory: defineTable({
    productId: v.id("products"),
    variantId: v.optional(v.id("productVariants")),
    oldPrice: v.number(),
    newPrice: v.number(),
    changedAt: v.number(),
  })
    .index("by_productId", ["productId"])
    .index("by_changedAt", ["changedAt"]),

  // ─── Members ─────────────────────────────────────────────────────────────────

  members: defineTable({
    name: v.string(),
    phone: v.optional(v.string()),
  }).index("by_name", ["name"]),

  // ─── Transactions ─────────────────────────────────────────────────────────────

  transactions: defineTable({
    orderNumber: v.number(), // Daily sequence: 1, 2, 3… resets each day
    date: v.string(),        // "YYYY-MM-DD" — drives daily grouping and orderNumber reset
    timestamp: v.number(),   // Unix ms — precise time for sorting within a day
    totalAmount: v.number(), // Denormalized SUM(items.totalAmount) — kept for fast daily totals
    remarks: v.optional(v.string()),
    memberId: v.optional(v.id("members")),
  })
    .index("by_date", ["date"])
    .index("by_date_orderNumber", ["date", "orderNumber"])
    .index("by_timestamp", ["timestamp"])
    .index("by_memberId", ["memberId"]),

  transactionItems: defineTable({
    transactionId: v.id("transactions"),
    productId: v.id("products"),
    variantId: v.optional(v.id("productVariants")),
    quantity: v.number(),
    unitPrice: v.number(),   // Price snapshot at time of sale — never recomputed
    totalAmount: v.number(), // quantity * unitPrice, denormalized for convenience
  }).index("by_transactionId", ["transactionId"]),

  // ─── Stock ───────────────────────────────────────────────────────────────────

  // One row per product (or variant). Decremented automatically on transaction complete.
  stock: defineTable({
    productId: v.id("products"),
    variantId: v.optional(v.id("productVariants")),
    quantity: v.number(),
    minThreshold: v.number(),
    lastAlertSent: v.optional(v.number()),
  })
    .index("by_productId", ["productId"])
    .index("by_variantId", ["variantId"]),

  // ─── Stock Additions History ─────────────────────────────────────────────────

  stockAdditions: defineTable({
    productId: v.id("products"),
    variantId: v.optional(v.id("productVariants")),
    quantity: v.number(),
    timestamp: v.number(),
  }).index("by_timestamp", ["timestamp"]),

  // ─── Settings ────────────────────────────────────────────────────────────────

  // Singleton — always exactly one row. Patch it, never insert a second.
  settings: defineTable({
    twilioPhoneNumber: v.string(),
    waBusinessPhoneId: v.string(),
    recipientPhone: v.string(),
    twilioAuthToken: v.string(),
  }),
});
