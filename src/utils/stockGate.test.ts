// @vitest-environment node
import { describe, it, expect } from "vitest";
import { computeShortages, type StockInfo } from "./stockGate";

const stock = new Map<string, StockInfo>([
  ["p:mrb", { quantity: 100, name: "MRB", unit: "kg" }],
  ["v:size1", { quantity: 10, name: "P", unit: "pcs" }],
]);

describe("computeShortages", () => {
  it("returns empty when stock is sufficient", () => {
    expect(computeShortages([{ productId: "mrb", quantity: 80 }], stock)).toEqual([]);
  });

  it("treats exactly-equal demand as sufficient (float epsilon)", () => {
    expect(computeShortages([{ productId: "mrb", quantity: 100 }], stock)).toEqual([]);
  });

  it("flags a single shortfall with have/need/unit", () => {
    expect(computeShortages([{ productId: "mrb", quantity: 150 }], stock)).toEqual([
      { name: "MRB", have: 100, need: 150, unit: "kg" },
    ]);
  });

  it("aggregates multiple lines of the same product before comparing", () => {
    const r = computeShortages(
      [
        { productId: "mrb", quantity: 60 },
        { productId: "mrb", quantity: 60 },
      ],
      stock,
    );
    expect(r).toHaveLength(1);
    expect(r[0].need).toBe(120);
  });

  it("ignores products with no stock row (untracked)", () => {
    expect(computeShortages([{ productId: "unknown", quantity: 999 }], stock)).toEqual([]);
  });

  it("matches variants by variantId and appends the size to the name", () => {
    expect(
      computeShortages(
        [{ productId: "p", variantId: "size1", quantity: 20, plasticSize: "5x8" }],
        stock,
      ),
    ).toEqual([{ name: "P 5x8", have: 10, need: 20, unit: "pcs" }]);
  });
});
