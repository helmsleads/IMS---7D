import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-service";
import crypto from "crypto";
import { encryptToken, isEncryptionConfigured } from "@/lib/encryption";
import { SHOPIFY_ADMIN_API_VERSION } from "@/lib/api/shopify/constants";
import { ensureShopifyLocation } from "@/lib/api/shopify/location-management";
import { ensureIntegrationWarehouseLocation } from "@/lib/api/shopify/shopify-order-payload";
import { normalizeShopifyShopDomain } from "@/lib/api/shopify/shop-domain";
import { registerShopifyWebhooks } from "@/lib/api/shopify/register-webhooks";
import {
  isShopifyTestAppConfigured,
  shouldShowShopifyTestConnectUi,
} from "@/lib/api/shopify/app-credentials";
import {
  buildStoredTokenFields,
  exchangeClientCredentials,
} from "@/lib/api/shopify/tokens";
import type { IntegrationSettings } from "@/types/database";

function clientIdPrefix(envName: string): string | null {
  const value = process.env[envName]?.trim();
  if (!value) return null;
  return value.slice(0, 8);
}

/**
 * GET /api/integrations/shopify/test-connect
 * Capability probe for the portal Integrations UI.
 */
export async function GET() {
  const livePrefix = clientIdPrefix("SHOPIFY_CLIENT_ID");
  const testPrefix = clientIdPrefix("SHOPIFY_TEST_CLIENT_ID");
  return NextResponse.json({
    enabled: isShopifyTestAppConfigured(),
    show_test_card: shouldShowShopifyTestConnectUi(),
    mode: "client_credentials",
    app: "test",
    live_client_id_prefix: livePrefix,
    test_client_id_prefix: testPrefix,
    test_matches_live: Boolean(
      livePrefix && testPrefix && livePrefix === testPrefix,
    ),
  });
}

/**
 * POST /api/integrations/shopify/test-connect
 * Body: { clientId, shop }
 *
 * Test store reconnect for Dev Dashboard apps: client_credentials grant.
 * Requires the test app already installed on the shop (same Dev org).
 * Does not use Partners OAuth authorize (avoids Unauthorized Access).
 * Live Partners OAuth is unchanged (`/auth?app=live`).
 */
export async function POST(request: NextRequest) {
  if (!isShopifyTestAppConfigured()) {
    return NextResponse.json(
      {
        error:
          "Test Shopify app is not configured. Set SHOPIFY_TEST_CLIENT_ID and SHOPIFY_TEST_CLIENT_SECRET.",
      },
      { status: 503 },
    );
  }

  let body: { clientId?: string; shop?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const portalClientId = body.clientId?.trim();
  if (!portalClientId || !body.shop?.trim()) {
    return NextResponse.json(
      { error: "clientId and shop are required" },
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
    .eq("client_id", portalClientId)
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

  let tokenData;
  try {
    tokenData = await exchangeClientCredentials(shopDomain, "test");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Token request failed";
    const notInstalled =
      /application_cannot_be_found|shop_not_permitted|not.*install|invalid/i.test(
        message,
      );
    return NextResponse.json(
      {
        error: notInstalled
          ? `Could not get a token for ${shopDomain}. Install “7D Dev Store APP” on that store in Shopify Admin (Apps), then Connect again here. The app and store must be in the same Dev Dashboard organization.`
          : `Shopify client credentials failed: ${message}`,
      },
      { status: 400 },
    );
  }

  const accessToken = tokenData.access_token;
  if (!accessToken) {
    return NextResponse.json(
      { error: "Shopify did not return an access token" },
      { status: 400 },
    );
  }

  let shopName = shopDomain;
  try {
    const shopResponse = await fetch(
      `https://${shopDomain}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/shop.json`,
      { headers: { "X-Shopify-Access-Token": accessToken } },
    );
    if (shopResponse.ok) {
      const shopInfo = (await shopResponse.json()) as {
        shop?: { name?: string };
      };
      shopName = shopInfo.shop?.name || shopDomain;
    }
  } catch {
    /* keep domain as name */
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
    console.error("test-connect location:", error);
  }

  const webhookSecret = crypto.randomBytes(32).toString("hex");
  const tokenFields = buildStoredTokenFields(tokenData);
  const storedWebhookSecret = isEncryptionConfigured()
    ? encryptToken(webhookSecret)
    : webhookSecret;

  const supabase = createServiceClient();
  const { data: integration, error: dbError } = await supabase
    .from("client_integrations")
    .upsert(
      {
        client_id: portalClientId,
        platform: "shopify",
        shop_domain: shopDomain,
        shop_name: shopName,
        access_token: tokenFields.access_token,
        refresh_token: tokenFields.refresh_token,
        token_expires_at: tokenFields.token_expires_at,
        scope: tokenData.scope || "test_app_client_credentials",
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
    console.error("test-connect save:", dbError);
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
        shopify_app: "test",
        connection_mode: "test_app",
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
    app: "test",
    mode: "client_credentials",
  });
}
