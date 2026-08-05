import { NextRequest, NextResponse } from "next/server";
import { getActiveClient } from "@/lib/api/dtc/clients";
import { verifyDtcApiRequest } from "@/lib/server/dtc-auth";
import { createServiceClient } from "@/lib/supabase-service";
import { createShopifyClientForIntegration } from "@/lib/api/shopify/tokens";
import { fetchOrdersForSync } from "@/lib/api/shopify/graphql/orders-sync";

/**
 * POST /api/dtc/clients/[clientId]/shopify/orders/pull
 * Pull paid Shopify orders for DTC ingest (does NOT create 7D outbound).
 * Body: { since?: ISO string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const authError = verifyDtcApiRequest(request);
  if (authError) {
    return authError;
  }

  const { clientId } = await params;
  const client = await getActiveClient(clientId);
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const since = body?.since ? new Date(body.since) : undefined;

  const supabase = createServiceClient();
  const { data: integration, error } = await supabase
    .from("client_integrations")
    .select("*")
    .eq("client_id", clientId)
    .eq("platform", "shopify")
    .eq("status", "connected")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !integration?.access_token || !integration.shop_domain) {
    return NextResponse.json(
      { error: "Shopify is not connected for this client" },
      { status: 409 },
    );
  }

  const shopifyClient = await createShopifyClientForIntegration(integration);
  const orders = await fetchOrdersForSync(
    shopifyClient,
    since && !Number.isNaN(since.getTime())
      ? since
      : integration.last_order_sync_at
        ? new Date(integration.last_order_sync_at)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  );

  const paid = orders.filter((o) => {
    const status = String(o.financial_status || "").toLowerCase();
    return status === "paid" || status === "partially_paid";
  });

  await supabase
    .from("client_integrations")
    .update({ last_order_sync_at: new Date().toISOString() })
    .eq("id", integration.id);

  return NextResponse.json({
    seven_d_client_id: clientId,
    seven_d_integration_id: integration.id,
    shop_domain: integration.shop_domain,
    orders: paid,
    count: paid.length,
  });
}
