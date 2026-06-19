import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-service";
import { getAppUrl } from "@/lib/server/app-url";
import { syncOutboundDeliveryFromTracking } from "@/lib/server/outbound-delivery-sync";
import {
  fetchShipStationTrackingFromResourceUrl,
  isShipStationDeliveredStatus,
  parseShipStationTrackingWebhook,
} from "@/lib/server/shipstation-tracking";

function verifyWebhookToken(request: NextRequest): boolean {
  const secret = process.env.SHIPSTATION_WEBHOOK_SECRET?.trim();
  if (!secret) return true;

  const token =
    request.nextUrl.searchParams.get("token") ||
    request.headers.get("x-shipstation-webhook-token");

  return token === secret;
}

function buildEventId(payload: {
  trackingNumber: string;
  statusCode?: string;
  statusDescription?: string;
  deliveredAt?: string;
}): string {
  return [
    "shipstation",
    payload.trackingNumber,
    payload.statusCode || "unknown",
    payload.statusDescription || "",
    payload.deliveredAt || "",
  ]
    .join(":")
    .toLowerCase();
}

/**
 * POST /api/webhooks/shipstation
 *
 * Receives ShipStation TRACK_EVENT_V2 / API_TRACK webhooks and marks matching
 * outbound orders delivered when status_code is DE (or SP).
 *
 * Configure in ShipStation → Settings → Integrations → Webhooks:
 * - Event: (V2) On New Track Event (TRACK_EVENT_V2)
 * - URL: {APP_URL}/api/webhooks/shipstation?token={SHIPSTATION_WEBHOOK_SECRET}
 */
export async function POST(request: NextRequest) {
  if (!verifyWebhookToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let parsed = parseShipStationTrackingWebhook(body);

  if (parsed && !parsed.trackingNumber && parsed.resourceUrl) {
    try {
      parsed = await fetchShipStationTrackingFromResourceUrl(parsed.resourceUrl);
    } catch (err) {
      console.error("[shipstation-webhook] resource_url fetch failed:", err);
      return NextResponse.json({ error: "Failed to load tracking resource" }, { status: 502 });
    }
  }

  if (!parsed?.trackingNumber) {
    return NextResponse.json({ received: true, skipped: "no_tracking_number" });
  }

  const supabase = createServiceClient();
  const eventId = buildEventId(parsed);

  const { data: existing } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("platform", "shipstation")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  await supabase.from("webhook_events").insert({
    platform: "shipstation",
    event_type: parsed.statusCode || "track_event",
    event_id: eventId,
    payload: body as Record<string, unknown>,
    status: "processing",
    received_at: new Date().toISOString(),
  });

  try {
    const result = await syncOutboundDeliveryFromTracking({
      trackingNumber: parsed.trackingNumber,
      statusCode: parsed.statusCode,
      statusDescription: parsed.statusDescription,
      deliveredAt: isShipStationDeliveredStatus(parsed.statusCode)
        ? parsed.deliveredAt
        : undefined,
      source: "shipstation_webhook",
      shippingMethod: "shipstation_api",
    });

    await supabase
      .from("webhook_events")
      .update({
        status: result.updated ? "processed" : "ignored",
        processed_at: new Date().toISOString(),
      })
      .eq("platform", "shipstation")
      .eq("event_id", eventId);

    return NextResponse.json({
      received: true,
      delivered: isShipStationDeliveredStatus(parsed.statusCode) && result.updated,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    await supabase
      .from("webhook_events")
      .update({
        status: "failed",
        error_message: message,
        processed_at: new Date().toISOString(),
      })
      .eq("platform", "shipstation")
      .eq("event_id", eventId);

    console.error("[shipstation-webhook] processing error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/webhooks/shipstation — setup helper / health check
 */
export async function GET(request: NextRequest) {
  const appUrl = getAppUrl(request);
  const secretConfigured = Boolean(process.env.SHIPSTATION_WEBHOOK_SECRET?.trim());
  const webhookUrl = secretConfigured
    ? `${appUrl}/api/webhooks/shipstation?token=${process.env.SHIPSTATION_WEBHOOK_SECRET}`
    : `${appUrl}/api/webhooks/shipstation`;

  return NextResponse.json({
    ok: true,
    webhookUrl,
    setup: [
      "ShipStation → Settings → Integrations → Webhooks",
      'Create webhook: (V2) On New Track Event — TRACK_EVENT_V2',
      `Target URL: ${webhookUrl}`,
      "Set SHIPSTATION_WEBHOOK_SECRET in 7d env and append ?token=... to the webhook URL",
    ],
  });
}
