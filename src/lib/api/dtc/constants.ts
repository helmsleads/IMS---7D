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

const MAX_ORDER_NUMBER_LENGTH = 50;

/** Warehouse order_number is VARCHAR(50); keep DTC numbers compact and unique per external order id. */
export function formatDtcOrderNumber(
  _externalOrderNumber: string,
  externalOrderId: string,
): string {
  const idPart = externalOrderId.replace(/-/g, "").toUpperCase() || "ORDER";
  const orderNumber = `${DTC_ORDER_NUMBER_PREFIX}${idPart}`;
  return orderNumber.length <= MAX_ORDER_NUMBER_LENGTH
    ? orderNumber
    : orderNumber.slice(0, MAX_ORDER_NUMBER_LENGTH);
}
