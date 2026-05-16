/**
 * `outbound_orders.preferred_carrier` — customer / merchant request (speed, pickup, carrier name).
 * Do not confuse with `outbound_orders.shipping_method` (IMS: manual, fedex_api, pickup, fedex_voided).
 */

export interface OutboundServiceOption {
  value: string;
  label: string;
}

/**
 * All values that may appear in `preferred_carrier`.
 * For `<Select>`: omit empty `value` here and use the component's `placeholder` for "no preference",
 * since `Select` injects its own leading empty option.
 */
export const PREFERRED_CARRIER_OPTIONS: OutboundServiceOption[] = [
  { value: "ground", label: "Ground" },
  { value: "2day", label: "2-Day" },
  { value: "overnight", label: "Overnight" },
  { value: "freight", label: "Freight / LTL" },
  { value: "pickup", label: "Customer pickup / Uber" },
  { value: "fedex", label: "FedEx" },
  { value: "ups", label: "UPS" },
  { value: "usps", label: "USPS" },
  { value: "dhl", label: "DHL" },
  { value: "other", label: "Other" },
];

/** Internal "new outbound" wizard — subset without portal-style carrier-only picks. */
export const NEW_ORDER_PREFERRED_CARRIER_OPTIONS: OutboundServiceOption[] = [
  { value: "ground", label: "Ground" },
  { value: "2day", label: "2-Day" },
  { value: "overnight", label: "Overnight" },
  { value: "freight", label: "Freight / LTL" },
  { value: "pickup", label: "Customer Pickup" },
  { value: "other", label: "Other" },
];

const LABEL_BY_VALUE = new Map(
  [
    ...PREFERRED_CARRIER_OPTIONS.map((o) => [o.value.toLowerCase(), o.label] as const),
    ["", "No preference"],
  ] as [string, string][]
);

["Freight", "freight"].forEach((k) => LABEL_BY_VALUE.set(String(k).toLowerCase(), "Freight / LTL"));

export function getPreferredCarrierLabel(value: string | null | undefined): string {
  if (!value?.trim()) return "No preference";
  const key = value.trim().toLowerCase();
  return LABEL_BY_VALUE.get(key) ?? value;
}

/** @deprecated alias */
export const getOutboundServiceOptionLabel = getPreferredCarrierLabel;

const IMS_LABELS: Record<string, string> = {
  manual: "Manual / other carrier",
  fedex_api: "FedEx (API label)",
  pickup: "Customer pickup (IMS)",
  fedex_voided: "FedEx voided",
};

export function getImsShippingMethodLabel(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  return IMS_LABELS[value.trim().toLowerCase()] ?? value;
}

const ALLOWED_PREFERRED = new Set(PREFERRED_CARRIER_OPTIONS.map((o) => o.value));

/** Match DB value to a `<select>` option value (lowercase known keys + common aliases). */
export function normalizePreferredCarrierForSelect(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  const t = raw.trim().toLowerCase();
  if (ALLOWED_PREFERRED.has(t)) return t;
  if (t === "customer pickup" || t.includes("uber")) return "pickup";
  if (t === "2-day" || t === "2 day") return "2day";
  const lower = raw.trim().toLowerCase();
  return ALLOWED_PREFERRED.has(lower) ? lower : raw.trim();
}
