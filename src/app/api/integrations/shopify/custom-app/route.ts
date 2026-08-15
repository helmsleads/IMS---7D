import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-service";
import { encryptToken, isEncryptionConfigured } from "@/lib/encryption";
import { SHOPIFY_ADMIN_API_VERSION } from "@/lib/api/shopify/constants";
import { ensureShopifyLocation } from "@/lib/api/shopify/location-management";
import { ensureIntegrationWarehouseLocation } from "@/lib/api/shopify/shopify-order-payload";
import { normalizeShopifyShopDomain } from "@/lib/api/shopify/shop-domain";
import { registerShopifyWebhooks } from "@/lib/api/shopify/register-webhooks";
import {
  parseShopifyAppMode,
  type ShopifyAppMode,
} from "@/lib/api/shopify/app-credentials";
import type { IntegrationSettings } from "@/types/database";
import crypto from "crypto";

/**
 * POST /api/integrations/shopify/custom-app
 *
 * Connect a store Admin “Develop apps” custom app using its Admin API access
 * token. Partners OAuth (`/auth`) cannot authorize those apps.
 *
 * Body: { clientId, shop, accessToken, app?: "live" | "test" }
 */
export async function POST(request: NextRequest) {
  let body: {
    clientId?: string;
    shop?: string;
    accessToken?: string;
    app?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clientId = body.clientId?.trim();
  const accessToken = body.accessToken?.trim();
  const appMode: ShopifyAppMode = parseShopifyAppMode(body.app || "live");

  if (!clientId || !body.shop?.trim() || !accessToken) {
    return NextResponse.json(
      { error: "clientId, shop, and accessToken are required" },
      { status: 400 },
    );
  }

  if (!accessToken.startsWith("shpat_") && !accessToken.startsWith("shpca_")) {
    return NextResponse.json(
      {
        error:
          "Access token should be an Admin API token (usually starts with shpat_)",
      },
      { status: 400 },
    );
  }

  let shopDomain = normalizeShopifyShopDomain(body.shop);
  if (!shopDomain.includes(".myshopify.com")) {
    shopDomain = `${shopDomain}.myshopify.com`;
  }
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shopDomain)) {
    return NextResponse.json(
      { error: "Invalid shop domain format" },
      { status: 400 },
    );
  }

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
    },
  );

  const {
    data: { user },
  } = await userSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized - please log in" }, { status: 401 });
  }

  const { data: clientAccess, error: accessError } = await userSupabase
    .from("client_users")
    .select("id, role")
    .eq("client_id", clientId)
    .eq("user_id", user.id)
    .single();

  if (accessError || !clientAccess) {
    return NextResponse.json({ error: "Access denied to this client" }, { status: 403 });
  }
  if (!["owner", "admin"].includes(clientAccess.role)) {
    return NextResponse.json(
      { error: "Only client owners and admins can connect integrations" },
      { status: 403 },
    );
  }

  let shopName = shopDomain;
  try {
    const shopResponse = await fetch(
      `https://${shopDomain}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/shop.json`,
      { headers: { "X-Shopify-Access-Token": accessToken } },
    );
    if (!shopResponse.ok) {
      const errText = await shopResponse.text();
      return NextResponse.json(
        {
          error: `Shopify rejected this access token (${shopResponse.status}). Check the Admin API token for ${shopDomain}.`,
          details: errText.slice(0, 300),
        },
        { status: 400 },
      );
    }
    const shopInfo = (await shopResponse.json()) as {
      shop?: { name?: string };
    };
    shopName = shopInfo.shop?.name || shopDomain;
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Could not reach Shopify with this token",
      },
      { status: 400 },
    );
  }

  let locationId: string | null = null;
  let locationName = "7 Degrees Co";
  let locationCreatedByUs = false;
  try {
    const locationResult = await ensureShopifyLocation(
      shopDomain,
      accessToken,
      locationName,
    );
    locationId = locationResult.locationId;
    locationName = locationResult.locationName;
    locationCreatedByUs = locationResult.createdByUs;
  } catch (error) {
    console.error("Failed to create/find location:", error);
  }

  const webhookSecret = crypto.randomBytes(32).toString("hex");
  const storedAccess = isEncryptionConfigured()
    ? encryptToken(accessToken)
    : accessToken;
  const storedWebhookSecret = isEncryptionConfigured()
    ? encryptToken(webhookSecret)
    : webhookSecret;

  if (!isEncryptionConfigured()) {
    console.warn("TOKEN_ENCRYPTION_KEY not configured - storing tokens in plaintext");
  }

  const supabase = createServiceClient();

  const { data: integration, error: dbError } = await supabase
    .from("client_integrations")
    .upsert(
      {
        client_id: clientId,
        platform: "shopify",
        shop_domain: shopDomain,
        shop_name: shopName,
        access_token: storedAccess,
        refresh_token: null,
        token_expires_at: null,
        scope: "custom_app_admin_api",
        webhook_secret: storedWebhookSecret,
        status: "active",
        updated_at: new Date().toISOString(),
        shopify_location_id: locationId,
        shopify_location_name: locationName,
        location_created_by_us: locationCreatedByUs,
      },
      { onConflict: "client_id,platform,shop_domain" },
    )
    .select()
    .single();

  if (dbError || !integration) {
    console.error("Failed to save custom-app integration:", dbError);
    return NextResponse.json(
      { error: "Failed to save Shopify connection" },
      { status: 500 },
    );
  }

  const imsWarehouseId = await ensureIntegrationWarehouseLocation(
    supabase,
    integration.id,
  );
  const existingSettings = (integration.settings ?? {}) as IntegrationSettings;

  await supabase
    .from("client_integrations")
    .update({
      settings: {
        auto_import_orders: true,
        dtc_verify_before_fulfill: false,
        auto_sync_inventory: existingSettings.auto_sync_inventory ?? false,
        auto_sync_prices: existingSettings.auto_sync_prices ?? false,
        sync_inventory_interval_minutes:
          existingSettings.sync_inventory_interval_minutes ?? 60,
        inventory_buffer: existingSettings.inventory_buffer ?? 0,
        default_location_id:
          imsWarehouseId ?? existingSettings.default_location_id ?? null,
        fulfillment_notify_customer:
          existingSettings.fulfillment_notify_customer ?? true,
        shopify_app: appMode,
        connection_mode: "custom_app",
      },
    })
    .eq("id", integration.id);

  await registerShopifyWebhooks(integration.id, shopDomain, accessToken);
  await supabase
    .from("client_integrations")
    .update({ webhooks_registered: true })
    .eq("id", integration.id);

  return NextResponse.json({
    success: true,
    integrationId: integration.id,
    shop: shopDomain,
    shopName,
    app: appMode,
    mode: "custom_app",
  });
}
