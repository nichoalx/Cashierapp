// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Core product definitions
  products: defineTable({
    name: v.string(), // "MRB", "SBS", "BH", "E", "Plastic", "Tempe", "Dages"
    unit: v.string(), // "kg" or "pcs"
  })
    .index("by_name", ["name"]),

  // Product variants (e.g., Plastic sizes)
  productVariants: defineTable({
    productId: v.id("products"),
    variantType: v.string(), // "size" for plastic
    variantValue: v.string(), // "5x8", "10x12", "12x20"
    price: v.number(), // current price for this variant
  })
    .index("by_productId", ["productId"]),

  // Current and historical prices
  prices: defineTable({
    productId: v.id("products"),
    variantId: v.optional(v.id("productVariants")),
    price: v.number(),
    effectiveDate: v.number(), // When this price became active
  })
    .index("by_productId", ["productId"])
    .index("by_date", ["effectiveDate"]),

  // Price change audit trail
  priceHistory: defineTable({
    productId: v.id("products"),
    variantId: v.optional(v.id("productVariants")),
    oldPrice: v.number(),
    newPrice: v.number(),
    changedAt: v.number(),
    // Note: changedBy omitted (only you change prices)
  })
    .index("by_productId", ["productId"])
    .index("by_changedAt", ["changedAt"]),

  // Transactions (order headers)
  transactions: defineTable({
    timestamp: v.number(),
    totalAmount: v.number(),
    remarks: v.optional(v.string()), // Notes about transaction
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_remarks", ["remarks"]), // For search

  // Transaction line items (normalized)
  transactionItems: defineTable({
    transactionId: v.id("transactions"),
    productId: v.id("products"),
    variantId: v.optional(v.id("productVariants")),
    quantity: v.number(),
    unitPrice: v.number(), // Price at time of sale (snapshot)
  })
    .index("by_transactionId", ["transactionId"]),

  // Stock levels (with variants for Plastic sizes, etc)
  stock: defineTable({
    productId: v.id("products"),
    variantId: v.optional(v.id("productVariants")),
    quantity: v.number(),
    minThreshold: v.number(),
    lastAlertSent: v.optional(v.number()),
  })
    .index("by_productId", ["productId"]),

  // Settings (Twilio, etc)
  settings: defineTable({
    twilioPhoneNumber: v.string(),
    waBusinessPhoneId: v.string(),
    recipientPhone: v.string(),
    twilioAuthToken: v.string(),
  }),
});