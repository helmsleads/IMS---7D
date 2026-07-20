import { describe, expect, it } from "vitest";
import {
  resolveUnitsPerCase,
  toBillableHandlingUnits,
  toBillableReceiveUnits,
} from "@/lib/api/billing-codes";

describe("resolveUnitsPerCase", () => {
  it("prefers item pack size over product master", () => {
    expect(resolveUnitsPerCase(6, 12)).toBe(6);
    expect(resolveUnitsPerCase(null, 12)).toBe(12);
    expect(resolveUnitsPerCase(undefined, undefined)).toBeNull();
  });
});

describe("toBillableHandlingUnits", () => {
  it("bills eaches as-is when units_per_case is missing or 1", () => {
    expect(toBillableHandlingUnits(48, null)).toBe(48);
    expect(toBillableHandlingUnits(48, 1)).toBe(48);
    expect(toBillableHandlingUnits(48, undefined)).toBe(48);
  });

  it("converts eaches to whole cases for pack-size products (HAPA 12-pack)", () => {
    expect(toBillableHandlingUnits(48, 12)).toBe(4);
    expect(toBillableHandlingUnits(12, 12)).toBe(1);
    expect(toBillableHandlingUnits(6, 12)).toBe(1); // partial case → 1
    expect(toBillableHandlingUnits(1, 12)).toBe(1);
    expect(toBillableHandlingUnits(13, 12)).toBe(2);
  });
});

describe("toBillableReceiveUnits", () => {
  it("uses case qty when receiving by case UOM", () => {
    expect(
      toBillableReceiveUnits({
        qtyInUom: 4,
        inventoryQty: 48,
        uom: "cases",
        unitsPerCase: 12,
      })
    ).toBe(4);
  });

  it("converts inventory eaches when UOM is not cases", () => {
    expect(
      toBillableReceiveUnits({
        qtyInUom: 48,
        inventoryQty: 48,
        uom: "units",
        unitsPerCase: 12,
      })
    ).toBe(4);
  });

  it("falls back to product units_per_case when line item pack size is missing", () => {
    expect(
      toBillableReceiveUnits({
        qtyInUom: 48,
        inventoryQty: 48,
        uom: "units",
        unitsPerCase: null,
        productUnitsPerCase: 12,
      })
    ).toBe(4);
  });
});
