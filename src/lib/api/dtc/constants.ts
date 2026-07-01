export const DTC_ORDER_NUMBER_PREFIX = "DTC-";

export const DTC_OUTBOUND_PLATFORM = "dtc";

/** Statuses where DTC-synced outbound orders can be removed from the warehouse UI. */
export const DTC_DELETABLE_STATUSES = new Set([
  "pending",
  "confirmed",
  "processing",
  "packed",
  "shipped",
]);

export function isDtcOutboundOrder(order: {
  external_platform?: string | null;
}): boolean {
  return order.external_platform === DTC_OUTBOUND_PLATFORM;
}

export function formatDtcOrderNumber(externalOrderNumber: string, externalOrderId: string): string {
  const base = externalOrderNumber || externalOrderId.slice(0, 8).toUpperCase();
  if (base.startsWith(DTC_ORDER_NUMBER_PREFIX)) {
    return base;
  }
  return `${DTC_ORDER_NUMBER_PREFIX}${base}`;
}
