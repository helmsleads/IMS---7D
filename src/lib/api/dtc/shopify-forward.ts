/**
 * When DTC owns alcohol compliance, Shopify orders are forwarded to DTC
 * instead of creating a 7D outbound order immediately.
 */

export function shouldForwardShopifyOrderToDtc(
  integration: Record<string, unknown>,
): boolean {
  const settings = (integration.settings ?? {}) as Record<string, unknown>;
  // Only the explicit DTC verify-first flag routes webhooks to DTC.
  // auto_import_orders=false must mean "skip import", not "send to DTC" —
  // otherwise portal clients with auto-import off never see orders in 7D.
  return settings.dtc_verify_before_fulfill === true;
}

export async function forwardShopifyOrderToDtc(payload: Record<string, unknown>, integration: {
  id: string;
  client_id: string;
  shop_domain?: string | null;
}): Promise<{ ok: boolean; status?: number; body?: string }> {
  const baseUrl = process.env.DTC_BACKEND_URL?.replace(/\/$/, "");
  const apiKey = process.env.DTC_API_KEY;
  if (!baseUrl || !apiKey) {
    console.warn(
      "DTC Shopify forward skipped: DTC_BACKEND_URL or DTC_API_KEY not configured",
    );
    return { ok: false, body: "dtc_not_configured" };
  }

  const response = await fetch(`${baseUrl}/v1/webhooks/7d/shopify-order`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      seven_d_client_id: integration.client_id,
      seven_d_integration_id: integration.id,
      shop_domain: integration.shop_domain ?? null,
      shopify_order: payload,
    }),
  });

  const body = await response.text().catch(() => "");
  if (!response.ok) {
    console.error(
      `DTC Shopify forward failed (${response.status}): ${body || response.statusText}`,
    );
    return { ok: false, status: response.status, body };
  }
  return { ok: true, status: response.status, body };
}
