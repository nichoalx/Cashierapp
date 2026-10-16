import { query, mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { adjustMemberStats, unpaidBalance } from "./memberStats";

/** The stock row a product/variant draws from, or null when it isn't stock-tracked. */
function findStockEntry(
  ctx: MutationCtx,
  productId: Id<"products">,
  variantId: Id<"productVariants"> | undefined,
) {
  return variantId
    ? ctx.db.query("stock").withIndex("by_variantId", q => q.eq("variantId", variantId)).first()
    : ctx.db.query("stock").withIndex("by_productId", q => q.eq("productId", productId)).filter(q => q.eq(q.field("variantId"), undefined)).first();
}

export const create = mutation({
  args: {
    items: v.array(v.object({
      productId: v.id("products"),
      variantId: v.optional(v.id("productVariants")),
      quantity: v.number(),
      unitPrice: v.number(),
      totalAmount: v.number(),
      displayName: v.optional(v.string()),
      displayColor: v.optional(v.string()),
    })),
    remarks: v.optional(v.string()),
    memberId: v.optional(v.id("members")),
    discount: v.optional(v.number()),
    amountPaid: v.optional(v.number()), // absent = fully paid; 0 = debt/unpaid
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // ── Stock gate ───────────────────────────────────────────────────────────
    // Reject the whole transaction (before any writes) if it would push any
    // product/variant below zero. Aggregate requested quantity per target first,
    // since the same product/variant can appear across multiple cart items
    // (e.g. a normal line + an eceran line both draw from the same stock).
    const requestedByKey = new Map<
      string,
      { productId: Id<"products">; variantId?: Id<"productVariants">; qty: number }
    >();
    for (const item of args.items) {
      const key = item.variantId ? `v:${item.variantId}` : `p:${item.productId}`;
      const prev = requestedByKey.get(key);
      if (prev) prev.qty += item.quantity;
      else requestedByKey.set(key, { productId: item.productId, variantId: item.variantId, qty: item.quantity });
    }
    const shortages: string[] = [];
    for (const req of requestedByKey.values()) {
      const stockEntry = req.variantId
        ? await ctx.db.query("stock").withIndex("by_variantId", q => q.eq("variantId", req.variantId!)).first()
        : await ctx.db.query("stock").withIndex("by_productId", q => q.eq("productId", req.productId)).filter(q => q.eq(q.field("variantId"), undefined)).first();
      // Untracked products (no stock row) are not gated — there is nothing to deplete.
      if (stockEntry && req.qty > stockEntry.quantity) {
        const product = await ctx.db.get(req.productId);
        const variant = req.variantId ? await ctx.db.get(req.variantId) : null;
        shortages.push(variant ? `${product?.name ?? "?"} ${variant.variantValue}` : (product?.name ?? "?"));
      }
    }
    if (shortages.length > 0) {
      throw new Error(`Stok tidak cukup: ${shortages.join(", ")}. Tambah stok dulu.`);
    }

    const now = Date.now();
    // The shop's calendar day (Asia/Jakarta), matching the stock snapshots. A UTC
    // date would roll over at 07:00 WIB and file early sales under yesterday.
    const date = new Date(now).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

    const todayTxs = await ctx.db
      .query("transactions")
      .withIndex("by_date", q => q.eq("date", date))
      .collect();
    const maxOrderNum = todayTxs.reduce((max, tx) => Math.max(max, tx.orderNumber), 0);
    const orderNumber = maxOrderNum + 1;

    const subtotal = args.items.reduce((s, i) => s + i.totalAmount, 0);
    const discount = Math.max(0, Math.min(args.discount ?? 0, subtotal));
    const totalAmount = subtotal - discount;

    // Only persist amountPaid when explicitly less than full (avoids polluting old rows)
    const amountPaid = args.amountPaid !== undefined && args.amountPaid < totalAmount
      ? args.amountPaid
      : undefined;

    const txId = await ctx.db.insert("transactions", {
      orderNumber,
      date,
      timestamp: now,
      totalAmount,
      discount: discount > 0 ? discount : undefined,
      amountPaid,
      remarks: args.remarks,
      memberId: args.memberId,
    });

    for (const item of args.items) {
      await ctx.db.insert("transactionItems", {
        transactionId: txId,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalAmount: item.totalAmount,
        displayName: item.displayName,
        displayColor: item.displayColor,
      });

      // Decrement stock for this product/variant
      const stockEntry = item.variantId
        ? await ctx.db
            .query("stock")
            .withIndex("by_variantId", q => q.eq("variantId", item.variantId!))
            .first()
        : await ctx.db
            .query("stock")
            .withIndex("by_productId", q => q.eq("productId", item.productId))
            .filter(q => q.eq(q.field("variantId"), undefined))
            .first();

      if (stockEntry) {
        await ctx.db.patch(stockEntry._id, {
          quantity: Math.max(0, stockEntry.quantity - item.quantity),
        });
      }
    }

    const tx = (await ctx.db.get(txId))!;
    await adjustMemberStats(ctx, args.memberId, { outstanding: unpaidBalance(tx, []), visits: 1 });

    return txId;
  },
});

export const listByDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const txs = await ctx.db
      .query("transactions")
      .withIndex("by_date", q => q.eq("date", args.date))
      .collect();

    txs.sort((a, b) => a.timestamp - b.timestamp);

    return Promise.all(txs.map(async (tx) => {
      const rawItems = await ctx.db
        .query("transactionItems")
        .withIndex("by_transactionId", q => q.eq("transactionId", tx._id))
        .collect();

      const items = await Promise.all(rawItems.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        const variant = item.variantId ? await ctx.db.get(item.variantId) : null;
        return {
          id: item._id,
          productId: item.productId,
          variantId: item.variantId,
          productName: product?.fullName ?? 'Unknown',
          productShortName: item.displayName ?? product?.name ?? '?',
          quantity: item.quantity,
          unit: product?.unit ?? 'pcs',
          unitPrice: item.unitPrice,
          total: item.totalAmount,
          color: item.displayColor ?? product?.color ?? '#9a9db5',
          plasticSize: variant?.variantValue,
        };
      }));

      let memberName: string | undefined;
      if (tx.memberId) {
        const member = await ctx.db.get(tx.memberId);
        memberName = member?.name;
      }

      // Compute remaining balance (initial payment + recorded payments)
      const paymentRows = await ctx.db
        .query("payments")
        .withIndex("by_transactionId", q => q.eq("transactionId", tx._id))
        .collect();
      const recordedPayments = paymentRows.reduce((s, p) => s + p.amount, 0);
      const initialPaid = tx.amountPaid ?? tx.totalAmount;
      const balance = Math.max(0, tx.totalAmount - initialPaid - recordedPayments);

      return {
        id: tx._id,
        orderNumber: tx.orderNumber,
        timestamp: tx.timestamp,
        total: tx.totalAmount,
        discount: tx.discount ?? 0,
        amountPaid: tx.amountPaid ?? tx.totalAmount,
        balance,
        remarks: tx.remarks,
        memberId: tx.memberId,
        memberName,
        items,
      };
    }));
  },
});

export const getDetail = query({
  args: { txId: v.id("transactions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const tx = await ctx.db.get(args.txId);
    if (!tx) return null;

    const rawItems = await ctx.db
      .query("transactionItems")
      .withIndex("by_transactionId", q => q.eq("transactionId", tx._id))
      .collect();

    const items = await Promise.all(rawItems.map(async (item) => {
      const product = await ctx.db.get(item.productId);
      const variant = item.variantId ? await ctx.db.get(item.variantId) : null;
      const priceRow = item.variantId
        ? await ctx.db.query("prices").withIndex("by_variantId", q => q.eq("variantId", item.variantId)).first()
        : await ctx.db.query("prices").withIndex("by_productId", q => q.eq("productId", item.productId)).filter(q => q.eq(q.field("variantId"), undefined)).first();
      return {
        id: item._id,
        productName: variant
          ? `${product?.fullName ?? '?'} ${variant.variantValue}`
          : (product?.fullName ?? '?'),
        productShortName: product?.name ?? '?',
        quantity: item.quantity,
        unit: product?.unit ?? 'pcs',
        unitPrice: item.unitPrice,
        currentPrice: priceRow?.price ?? item.unitPrice,
        total: item.totalAmount,
        color: product?.color ?? '#9a9db5',
      };
    }));

    const paymentRows = await ctx.db
      .query("payments")
      .withIndex("by_transactionId", q => q.eq("transactionId", tx._id))
      .collect();
    const payments = paymentRows
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(p => ({ id: p._id, date: p.date, amount: p.amount }));

    let memberName: string | undefined;
    if (tx.memberId) {
      const member = await ctx.db.get(tx.memberId);
      memberName = member?.name;
    }

    const initialPaid = tx.amountPaid ?? tx.totalAmount;
    const recordedPayments = payments.reduce((s, p) => s + p.amount, 0);
    const balance = Math.max(0, tx.totalAmount - initialPaid - recordedPayments);

    return {
      id: tx._id,
      orderNumber: tx.orderNumber,
      date: tx.date,
      timestamp: tx.timestamp,
      total: tx.totalAmount,
      discount: tx.discount ?? 0,
      amountPaid: initialPaid,
      balance,
      remarks: tx.remarks,
      memberId: tx.memberId,
      memberName,
      items,
      payments,
    };
  },
});

export const update = mutation({
  args: {
    txId: v.id("transactions"),
    updatedItems: v.array(v.object({
      id: v.id("transactionItems"),
      quantity: v.number(),
      totalAmount: v.number(),
      variantId: v.optional(v.id("productVariants")),
    })),
    removedItemIds: v.array(v.id("transactionItems")),
    remarks: v.optional(v.string()),
    memberId: v.optional(v.id("members")),
    discount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // ── Net stock change per product/variant ────────────────────────────────
    // Every edited line gives its old quantity back to the stock it drew from
    // and takes its new quantity from the stock it now draws from — so a plastic
    // size change (5×8 → 10×12) moves stock between sizes. Removed lines give
    // their quantity back. Netting per target first lets the gate and the
    // writes see the whole edit at once.
    const netByKey = new Map<
      string,
      { productId: Id<"products">; variantId?: Id<"productVariants">; qty: number }
    >();
    const addNet = (productId: Id<"products">, variantId: Id<"productVariants"> | undefined, qty: number) => {
      const key = variantId ? `v:${variantId}` : `p:${productId}`;
      const prev = netByKey.get(key);
      if (prev) prev.qty += qty;
      else netByKey.set(key, { productId, variantId, qty });
    };
    for (const item of args.updatedItems) {
      const old = await ctx.db.get(item.id);
      if (!old) continue;
      addNet(old.productId, old.variantId, -old.quantity);
      addNet(old.productId, item.variantId ?? old.variantId, item.quantity);
    }
    for (const itemId of args.removedItemIds) {
      const old = await ctx.db.get(itemId);
      if (old) addNet(old.productId, old.variantId, -old.quantity);
    }

    // ── Stock gate ───────────────────────────────────────────────────────────
    // Same rule as create: reject the edit before any writes if it would draw
    // more than is in stock. Untracked products (no stock row) are not gated.
    const stockByKey = new Map<string, Doc<"stock">>();
    const shortages: string[] = [];
    for (const [key, net] of netByKey) {
      if (net.qty === 0) continue;
      const stockEntry = await findStockEntry(ctx, net.productId, net.variantId);
      if (!stockEntry) continue;
      stockByKey.set(key, stockEntry);
      if (net.qty > stockEntry.quantity) {
        const product = await ctx.db.get(net.productId);
        const variant = net.variantId ? await ctx.db.get(net.variantId) : null;
        shortages.push(variant ? `${product?.name ?? "?"} ${variant.variantValue}` : (product?.name ?? "?"));
      }
    }
    if (shortages.length > 0) {
      throw new Error(`Stok tidak cukup: ${shortages.join(", ")}. Tambah stok dulu.`);
    }

    for (const [key, net] of netByKey) {
      const stockEntry = stockByKey.get(key);
      if (stockEntry) {
        await ctx.db.patch(stockEntry._id, { quantity: stockEntry.quantity - net.qty });
      }
    }

    for (const item of args.updatedItems) {
      await ctx.db.patch(item.id, {
        quantity: item.quantity,
        totalAmount: item.totalAmount,
        ...(item.variantId !== undefined ? { variantId: item.variantId } : {}),
      });
    }
    for (const itemId of args.removedItemIds) {
      await ctx.db.delete(itemId);
    }

    const remaining = await ctx.db
      .query("transactionItems")
      .withIndex("by_transactionId", q => q.eq("transactionId", args.txId))
      .collect();
    const subtotal = remaining.reduce((s, i) => s + i.totalAmount, 0);

    const existing = await ctx.db.get(args.txId);
    const requestedDiscount = args.discount ?? existing?.discount ?? 0;
    const discount = Math.max(0, Math.min(requestedDiscount, subtotal));

    const previousMemberId = existing?.memberId;
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_transactionId", q => q.eq("transactionId", args.txId))
      .collect();
    const oldBalance = existing ? unpaidBalance(existing, payments) : 0;

    await ctx.db.patch(args.txId, {
      totalAmount: subtotal - discount,
      discount: discount > 0 ? discount : undefined,
      remarks: args.remarks,
      memberId: args.memberId,
    });

    const newBalance = unpaidBalance((await ctx.db.get(args.txId))!, payments);
    if (previousMemberId === args.memberId) {
      await adjustMemberStats(ctx, args.memberId, { outstanding: newBalance - oldBalance, visits: 0 });
    } else {
      // Reassigned — move the order and its balance from one member to the other.
      await adjustMemberStats(ctx, previousMemberId, { outstanding: -oldBalance, visits: -1 });
      await adjustMemberStats(ctx, args.memberId, { outstanding: newBalance, visits: 1 });
    }
  },
});

export const remove = mutation({
  args: { txId: v.id("transactions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const tx = await ctx.db.get(args.txId);

    const items = await ctx.db
      .query("transactionItems")
      .withIndex("by_transactionId", q => q.eq("transactionId", args.txId))
      .collect();

    for (const item of items) {
      // Restore stock for each item
      const stockEntry = item.variantId
        ? await ctx.db
            .query("stock")
            .withIndex("by_variantId", q => q.eq("variantId", item.variantId!))
            .first()
        : await ctx.db
            .query("stock")
            .withIndex("by_productId", q => q.eq("productId", item.productId))
            .filter(q => q.eq(q.field("variantId"), undefined))
            .first();

      if (stockEntry) {
        await ctx.db.patch(stockEntry._id, {
          quantity: stockEntry.quantity + item.quantity,
        });
      }

      await ctx.db.delete(item._id);
    }

    // Payments belong to the transaction — delete them with it so they don't
    // linger as orphans (they'd show up in the Sheets payment table as order #0).
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_transactionId", q => q.eq("transactionId", args.txId))
      .collect();
    for (const p of payments) {
      await ctx.db.delete(p._id);
    }

    await ctx.db.delete(args.txId);

    if (tx) {
      await adjustMemberStats(ctx, tx.memberId, { outstanding: -unpaidBalance(tx, payments), visits: -1 });
    }
  },
});
