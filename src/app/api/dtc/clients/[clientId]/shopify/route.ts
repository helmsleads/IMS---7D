import { NextRequest, NextResponse } from "next/server";
import { getActiveClient } from "@/lib/api/dtc/clients";
import { verifyDtcApiRequest } from "@/lib/server/dtc-auth";
import { createServiceClient } from "@/lib/supabase-service";
import { DEFAULT_SHOPIFY_INTEGRATION_SETTINGS } from "@/lib/api/dtc/shopify-defaults";

/**
 * GET /api/dtc/clients/[clientId]/shopify
 * Returns active Shopify integration status for the client.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ clientId: string }> },
) {
  const authError = verifyDtcApiRequest(request);
  if (authError) {
    return authError;
  }

  try {
    const { clientId } = await context.params;
    const client = await getActiveClient(clientId);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("client_integrations")
      .select(
        "id, platform, shop_domain, shop_name, status, settings, webhooks_registered, last_order_sync_at, last_inventory_sync_at, updated_at",
      )
      .eq("client_id", clientId)
      .eq("platform", "shopify")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      connected: Boolean(data),
      integration: data,
      settings_defaults: DEFAULT_SHOPIFY_INTEGRATION_SETTINGS,
    });
  } catch (error) {
    console.error("DTC Shopify status error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load Shopify status" },
      { status: 500 },
    );
  }
}
