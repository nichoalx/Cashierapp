// Pure stock-gate logic, shared by the UI and unit tests.
// Kept free of React/Convex so it can be tested in isolation.

export type StockInfo = { quantity: number; name: string; unit: string };
export type Shortage = { name: string; have: number; need: number; unit: string };
export type CartLike = {
  productId: string;
  variantId?: string;
  quantity: number;
  plasticSize?: string;
};

/** Map key for a stock target: variant-specific if it has a variant, else the product. */
export function stockKey(productId: string, variantId?: string): string {
  return variantId ? `v:${variantId}` : `p:${productId}`;
}

/**
 * Compare aggregated cart quantities against available stock.
 * Returns one Shortage per product/variant whose combined demand exceeds supply.
 * Products with no stock row are treated as untracked and never gated
 * (mirrors the server, which only decrements rows that exist).
 */
export function computeShortages(
  cartItems: CartLike[],
  stockByKey: Map<string, StockInfo>,
): Shortage[] {
  // Aggregate first — the same target can appear across multiple cart lines
  // (e.g. a normal line + an eceran line both draw from one product's stock).
  const requested = new Map<string, { qty: number; plasticSize?: string }>();
  for (const it of cartItems) {
    const key = stockKey(it.productId, it.variantId);
    const prev = requested.get(key);
    if (prev) prev.qty += it.quantity;
    else requested.set(key, { qty: it.quantity, plasticSize: it.plasticSize });
  }

  const short: Shortage[] = [];
  for (const [key, r] of requested) {
    const st = stockByKey.get(key);
    if (!st) continue; // untracked product — nothing to deplete
    if (r.qty > st.quantity + 1e-9) {
      short.push({
        name: st.name + (r.plasticSize ? ` ${r.plasticSize}` : ''),
        have: st.quantity,
        need: r.qty,
        unit: st.unit,
      });
    }
  }
  return short;
}
