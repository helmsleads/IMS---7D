import { describe, expect, it } from "vitest";
import { extractFedExMoneyAmount } from "@/lib/api/fedex";

describe("extractFedExMoneyAmount", () => {
  it("reads bare numbers from the Rate API", () => {
    expect(extractFedExMoneyAmount(25.6)).toBe(25.6);
  });

  it("reads { amount } objects", () => {
    expect(extractFedExMoneyAmount({ amount: 31.2, currency: "USD" })).toBe(31.2);
  });

  it("reads numeric strings", () => {
    expect(extractFedExMoneyAmount("15.24")).toBe(15.24);
  });

  it("returns undefined for empty values", () => {
    expect(extractFedExMoneyAmount(undefined)).toBeUndefined();
    expect(extractFedExMoneyAmount(null)).toBeUndefined();
    expect(extractFedExMoneyAmount("")).toBeUndefined();
    expect(extractFedExMoneyAmount({ currency: "USD" })).toBeUndefined();
  });
});
