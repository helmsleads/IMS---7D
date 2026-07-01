import type { OutboundOrder } from "@/lib/api/outbound";

export interface DtcShipEventPayload {
  external_order_id: string;
  seven_d_outbound_order_id: string;
  status: string;
  tracking_number?: string | null;
  carrier?: string | null;
  shipped_date?: string | null;
  order_number?: string | null;
}

function getDtcBackendConfig() {
  const baseUrl = process.env.DTC_BACKEND_URL?.replace(/\/$/, "");
  const apiKey = process.env.DTC_API_KEY;
  return { baseUrl, apiKey };
}

export function isDtcShipNotifyConfigured(): boolean {
  const { baseUrl, apiKey } = getDtcBackendConfig();
  return Boolean(baseUrl && apiKey);
}

export async function notifyDtcOrderShipped(
  order: Pick<
    OutboundOrder,
    | "id"
    | "external_order_id"
    | "external_platform"
    | "order_number"
    | "status"
    | "tracking_number"
    | "carrier"
    | "shipped_date"
  > & { external_order_id: string },
): Promise<void> {
  if (order.external_platform !== "dtc" || !order.external_order_id) {
    return;
  }

  const { baseUrl, apiKey } = getDtcBackendConfig();
  if (!baseUrl || !apiKey) {
    console.warn("DTC ship notify skipped: DTC_BACKEND_URL or DTC_API_KEY not configured");
    return;
  }

  const payload: DtcShipEventPayload = {
    external_order_id: order.external_order_id,
    seven_d_outbound_order_id: order.id,
    status: order.status,
    tracking_number: order.tracking_number,
    carrier: order.carrier,
    shipped_date: order.shipped_date,
    order_number: order.order_number,
  };

  const response = await fetch(`${baseUrl}/v1/webhooks/7d/ship`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `DTC ship notify failed (${response.status}): ${body || response.statusText}`,
    );
  }
}
