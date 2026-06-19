import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-service";
import { getFedExCredentials, trackShipment } from "@/lib/api/fedex";
import { syncOutboundDeliveryFromTracking } from "@/lib/server/outbound-delivery-sync";

function isFedExCarrier(carrier: string | null): boolean {
  return Boolean(carrier && carrier.toLowerCase().includes("fedex"));
}

/**
 * GET /api/cron/shipping/shipstation-track
 *
 * Fallback polling for ShipStation labels when webhooks are unavailable.
 * Currently supports FedEx-carrier ShipStation shipments via the FedEx Track API.
 *
 * Protected by CRON_SECRET (Authorization: Bearer <CRON_SECRET>)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 25), 50);
  const staleHours = Math.min(Number(url.searchParams.get("staleHours") || 6), 48);
  const staleCutoff = new Date(Date.now() - staleHours * 60 * 60 * 1000).toISOString();

  const supabase = createServiceClient();
  const { data: orders, error } = await supabase
    .from("outbound_orders")
    .select(
      "id, tracking_number, carrier, tracking_status_updated_at, delivered_date, status"
    )
    .eq("shipping_method", "shipstation_api")
    .eq("status", "shipped")
    .not("tracking_number", "is", null)
    .is("delivered_date", null)
    .or(`tracking_status_updated_at.is.null,tracking_status_updated_at.lt.${staleCutoff}`)
    .order("tracking_status_updated_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const fedexCredentials = await getFedExCredentials();
  let scanned = 0;
  let updated = 0;
  let delivered = 0;
  const skipped: { orderId: string; reason: string }[] = [];
  const errors: { orderId: string; error: string }[] = [];

  for (const order of orders || []) {
    scanned += 1;

    if (!order.tracking_number) {
      skipped.push({ orderId: order.id, reason: "missing_tracking_number" });
      continue;
    }

    if (!isFedExCarrier(order.carrier)) {
      skipped.push({ orderId: order.id, reason: "non_fedex_carrier_use_webhook" });
      continue;
    }

    if (!fedexCredentials) {
      skipped.push({ orderId: order.id, reason: "fedex_not_configured" });
      continue;
    }

    try {
      const tracking = await trackShipment(
        order.tracking_number,
        fedexCredentials,
        undefined
      );

      const isDelivered = Boolean(tracking.actualDelivery);
      const result = await syncOutboundDeliveryFromTracking({
        trackingNumber: order.tracking_number,
        statusCode: isDelivered ? "DE" : "IT",
        statusDescription: tracking.statusDescription,
        deliveredAt: tracking.actualDelivery,
        source: "shipstation_cron_fedex",
        shippingMethod: "shipstation_api",
      });

      if (result.updated) {
        updated += 1;
        if (isDelivered) {
          delivered += 1;
        }
      }
    } catch (e) {
      errors.push({
        orderId: order.id,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    success: true,
    scanned,
    updated,
    delivered,
    skipped,
    errors,
  });
}
