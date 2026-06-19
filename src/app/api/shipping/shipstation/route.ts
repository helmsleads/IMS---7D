import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-service";
import {
  createShipStationLabel,
  isShipStationConfigured,
  type ShipStationAddress,
} from "@/lib/api/shipstation";
import { getQBCredentials, syncShippingExpense } from "@/lib/api/quickbooks";

function getDefaultShipDate(raw?: string): string {
  if (raw && typeof raw === "string" && raw.trim()) return raw.trim();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
}

/**
 * GET /api/shipping/shipstation — Config check
 */
export async function GET(request: NextRequest) {
  try {
    const userSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      }
    );

    const {
      data: { user },
    } = await userSupabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      configured: isShipStationConfigured(),
    });
  } catch (err) {
    console.error("ShipStation config check error:", err);
    return NextResponse.json({
      configured: isShipStationConfigured(),
      error: err instanceof Error ? err.message : "Failed to check ShipStation config",
    });
  }
}

function normalizeCountry(country: string | null | undefined): string {
  const c = (country || "US").trim().toUpperCase();
  if (c === "USA" || c === "UNITED STATES") return "US";
  return c.length === 2 ? c : "US";
}

/**
 * POST /api/shipping/shipstation — Create ShipStation order + label
 *
 * Body: { orderId, packageWeight, shipDate?, carrierPreference? }
 * carrierPreference is optional — omit for ShipStation auto carrier selection.
 */
export async function POST(request: NextRequest) {
  try {
    const userSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      }
    );

    const {
      data: { user },
    } = await userSupabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isShipStationConfigured()) {
      return NextResponse.json(
        {
          error:
            "ShipStation is not configured. Add SHIPSTATION_API_KEY and SHIPSTATION_API_SECRET.",
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { orderId, packageWeight, shipDate, carrierPreference } = body;

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ error: "Invalid or missing orderId" }, { status: 400 });
    }

    const weightNumber =
      typeof packageWeight === "number" ? packageWeight : Number(packageWeight);
    if (!Number.isFinite(weightNumber) || weightNumber <= 0) {
      return NextResponse.json({ error: "Invalid packageWeight" }, { status: 400 });
    }

    const serviceSupabase = createServiceClient();

    const { data: order, error: orderError } = await serviceSupabase
      .from("outbound_orders")
      .select(
        `
        id,
        order_number,
        ship_to_name,
        ship_to_company,
        ship_to_address,
        ship_to_address2,
        ship_to_city,
        ship_to_state,
        ship_to_zip,
        ship_to_country,
        ship_to_phone,
        ship_to_email,
        preferred_carrier,
        tracking_number,
        label_url,
        shipping_method,
        shipstation_order_id,
        client:clients ( company_name, email )
      `
      )
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const missingFields: string[] = [];
    if (!order.ship_to_address) missingFields.push("ship_to_address");
    if (!order.ship_to_city) missingFields.push("ship_to_city");
    if (!order.ship_to_state) missingFields.push("ship_to_state");
    if (!order.ship_to_zip) missingFields.push("ship_to_zip");

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: "Order is missing ship-to address fields", missingFields },
        { status: 400 }
      );
    }

    // Idempotency: return existing label if already created via ShipStation
    if (
      order.shipping_method === "shipstation_api" &&
      order.tracking_number &&
      order.label_url
    ) {
      return NextResponse.json({
        trackingNumber: order.tracking_number,
        labelUrl: order.label_url,
        shipmentId: order.shipstation_order_id,
        shipStationOrderId: order.shipstation_order_id,
        carrier: order.preferred_carrier || "ShipStation",
        actualCost: null,
        listCost: null,
      });
    }

    const { data: orderItems, error: itemsError } = await serviceSupabase
      .from("outbound_items")
      .select(
        `
        qty_requested,
        product:products ( id, name, sku )
      `
      )
      .eq("order_id", orderId);

    if (itemsError) {
      return NextResponse.json({ error: "Failed to load order items" }, { status: 500 });
    }

    const items = (orderItems || []).map((row, index) => {
      const product = Array.isArray(row.product) ? row.product[0] : row.product;
      return {
        sku: product?.sku || `SKU-${index + 1}`,
        name: product?.name || "Product",
        quantity: row.qty_requested || 1,
        unitPrice: 0,
        lineItemKey: product?.id ? String(product.id) : undefined,
      };
    });

    if (items.length === 0) {
      return NextResponse.json({ error: "Order has no line items" }, { status: 400 });
    }

    const client = Array.isArray(order.client) ? order.client[0] : order.client;
    const shipTo: ShipStationAddress = {
      name: order.ship_to_name || client?.company_name || "Recipient",
      company: order.ship_to_company || client?.company_name || undefined,
      street1: order.ship_to_address!,
      street2: order.ship_to_address2 || undefined,
      city: order.ship_to_city!,
      state: order.ship_to_state!,
      postalCode: order.ship_to_zip!,
      country: normalizeCountry(order.ship_to_country),
      phone: order.ship_to_phone || undefined,
      residential: true,
    };

    const explicitCarrier =
      typeof carrierPreference === "string" && carrierPreference.trim()
        ? carrierPreference.trim()
        : null;

    const result = await createShipStationLabel({
      orderId: order.id,
      orderNumber: order.order_number,
      orderKey: order.id,
      shipDate: getDefaultShipDate(shipDate),
      packageWeightLbs: weightNumber,
      carrierPreference: explicitCarrier,
      shipTo,
      items,
      customerEmail: order.ship_to_email || client?.email || null,
    });

    // Store label PDF in Supabase Storage
    let labelUrl: string | null = null;
    if (result.labelPdfBase64) {
      const labelBuffer = Buffer.from(result.labelPdfBase64, "base64");
      const labelPath = `${orderId}/${result.trackingNumber}.pdf`;

      const { error: uploadError } = await serviceSupabase.storage
        .from("shipping-labels")
        .upload(labelPath, labelBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) {
        console.error("Failed to upload ShipStation label:", uploadError);
      } else {
        labelUrl = labelPath;
      }
    }

    const orderUpdate: Record<string, unknown> = {
      shipstation_order_id: String(result.shipStationOrderId),
      label_url: labelUrl,
      shipping_method: "shipstation_api",
      carrier: result.carrier,
      tracking_number: result.trackingNumber,
    };
    if (result.actualCost != null) {
      orderUpdate.shipping_cost = result.actualCost;
      orderUpdate.client_shipping_cost = result.actualCost;
    }

    await serviceSupabase.from("outbound_orders").update(orderUpdate).eq("id", orderId);

    if (result.actualCost != null && result.actualCost > 0) {
      getQBCredentials()
        .then((creds) => {
          if (creds) return syncShippingExpense(orderId);
        })
        .catch((err) =>
          console.warn("QB shipping expense sync failed (non-blocking):", err)
        );
    }

    return NextResponse.json({
      trackingNumber: result.trackingNumber,
      labelUrl,
      shipmentId: String(result.shipmentId),
      shipStationOrderId: result.shipStationOrderId,
      carrier: result.carrier,
      carrierCode: result.carrierCode,
      serviceCode: result.serviceCode,
      actualCost: result.actualCost,
      listCost: result.actualCost,
    });
  } catch (err) {
    console.error("ShipStation shipment creation error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to create ShipStation label";
    const isConfig =
      message.toLowerCase().includes("not configured") ||
      message.toLowerCase().includes("ship-from") ||
      message.toLowerCase().includes("ship-from address");
    const isWallet =
      message.toLowerCase().includes("wallet") ||
      message.toLowerCase().includes("not been setup");
    const isWarehouse = message.toLowerCase().includes("warehouse");

    return NextResponse.json(
      {
        error: message,
        hint: isWallet
          ? "Open ShipStation → Billing → ShipStation Balance / One Balance and fund your wallet before purchasing labels."
          : isWarehouse
            ? "Add a Ship From Location in ShipStation → Settings → Shipping → Ship From Locations."
            : isConfig
              ? "Verify SHIPSTATION_API_KEY/SECRET and warehouse address env vars (FEDEX_SHIPPER_* or SHIPSTATION_SHIPPER_*)."
              : message.toLowerCase().includes("not available") ||
                  message.toLowerCase().includes("not connected")
                ? "Connect the carrier in ShipStation Settings → Carriers. This account currently supports FedEx One Balance and DHL Express One Balance."
                : null,
      },
      { status: isConfig ? 400 : 502 }
    );
  }
}
