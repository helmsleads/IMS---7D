import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-service";
import { getFedExCredentials, trackShipment } from "@/lib/api/fedex";
import { formatPlaceLabel, geocodePlaceLabel } from "@/lib/server/geocode-place";

async function getAuthUser(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function resolvePortalClientId(userId: string, email?: string | null) {
  const service = createServiceClient();

  const { data: clientUsers } = await service
    .from("client_users")
    .select("client_id, is_primary")
    .eq("user_id", userId)
    .order("is_primary", { ascending: false })
    .limit(1);

  if (clientUsers?.[0]?.client_id) {
    return clientUsers[0].client_id as string;
  }

  if (email) {
    const { data: profile } = await service
      .from("user_profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (profile?.id) {
      const { data: byProfile } = await service
        .from("client_users")
        .select("client_id")
        .eq("user_id", profile.id)
        .limit(1)
        .maybeSingle();
      if (byProfile?.client_id) return byProfile.client_id as string;
    }
  }

  const { data: legacy } = await service
    .from("clients")
    .select("id")
    .eq("auth_id", userId)
    .limit(1)
    .maybeSingle();

  return (legacy?.id as string | undefined) ?? null;
}

function isFedExCarrier(carrier: string | null | undefined) {
  const c = String(carrier || "").toLowerCase();
  return c.includes("fedex") || c === "fx" || c === "fdx";
}

/**
 * GET /api/portal/orders/[orderId]/tracking
 * Live carrier status + map place for portal clients (own orders only).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await context.params;
    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const clientId = await resolvePortalClientId(user.id, user.email);
    if (!clientId) {
      return NextResponse.json({ error: "Not associated with a client" }, { status: 403 });
    }

    const service = createServiceClient();
    const { data: order, error: orderError } = await service
      .from("outbound_orders")
      .select(
        `
        id,
        client_id,
        status,
        carrier,
        preferred_carrier,
        tracking_number,
        tracking_status,
        tracking_status_updated_at,
        shipped_date,
        delivered_date,
        ship_to_city,
        ship_to_state,
        ship_to_zip,
        ship_to_country
      `,
      )
      .eq("id", orderId)
      .eq("client_id", clientId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!order.tracking_number) {
      return NextResponse.json({
        trackingNumber: null,
        statusDescription: order.tracking_status || "No tracking number yet",
        events: [],
        map: null,
        source: "none",
      });
    }

    const carrier = order.carrier || order.preferred_carrier;
    const destinationLabel = formatPlaceLabel({
      city: order.ship_to_city,
      state: order.ship_to_state,
      zip: order.ship_to_zip,
      country: order.ship_to_country,
    });

    let statusDescription = order.tracking_status || "In transit";
    let statusCode = "UNKNOWN";
    let events: Array<{
      statusCode: string;
      statusDescription: string;
      timestamp?: string;
      city?: string;
      state?: string;
      country?: string;
    }> = [];
    let estimatedDelivery: string | undefined;
    let actualDelivery: string | undefined = order.delivered_date || undefined;
    let source: "fedex" | "stored" | "destination" = "stored";

    if (isFedExCarrier(carrier)) {
      const credentials = await getFedExCredentials();
      if (credentials) {
        try {
          const shipDateBegin = order.shipped_date
            ? String(order.shipped_date).split("T")[0]
            : undefined;
          const result = await trackShipment(order.tracking_number, credentials, {
            shipDateBegin,
            shipDateEnd: shipDateBegin,
          });
          statusCode = result.statusCode;
          statusDescription = result.statusDescription;
          events = result.events || [];
          estimatedDelivery = result.estimatedDelivery;
          actualDelivery = result.actualDelivery || actualDelivery;
          source = "fedex";

          await service
            .from("outbound_orders")
            .update({
              tracking_status: result.statusDescription,
              tracking_status_updated_at: new Date().toISOString(),
              ...(result.actualDelivery ? { delivered_date: result.actualDelivery } : {}),
            })
            .eq("id", order.id);
        } catch (err) {
          console.warn("Portal FedEx track failed:", err);
          // Fall back to stored status + destination map
        }
      }
    }

    const latestWithPlace = events.find((e) => e.city || e.state);
    const liveLabel = latestWithPlace
      ? formatPlaceLabel({
          city: latestWithPlace.city,
          state: latestWithPlace.state,
          country: latestWithPlace.country,
        })
      : null;

    const mapQuery = liveLabel || destinationLabel;
    let map: {
      query: string;
      lat: number | null;
      lng: number | null;
      label: string;
      kind: "current" | "destination";
    } | null = null;

    if (mapQuery) {
      const geo = await geocodePlaceLabel(mapQuery);
      map = {
        query: mapQuery,
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        label: geo?.label || mapQuery,
        kind: liveLabel ? "current" : "destination",
      };
      if (!liveLabel) source = source === "fedex" ? "fedex" : "destination";
    }

    return NextResponse.json({
      trackingNumber: order.tracking_number,
      carrier,
      statusCode,
      statusDescription,
      estimatedDelivery,
      actualDelivery,
      updatedAt: new Date().toISOString(),
      events: events.slice(0, 12),
      map,
      source,
      googleMapsKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || null,
    });
  } catch (err) {
    console.error("Portal tracking error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load tracking" },
      { status: 500 },
    );
  }
}
