import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-service";
import {
  decryptToken,
  encryptToken,
  isEncryptionConfigured,
} from "@/lib/encryption";
import { SHOPIFY_ADMIN_API_VERSION } from "@/lib/api/shopify/constants";
import { ensureShopifyLocation } from "@/lib/api/shopify/location-management";
import { ensureIntegrationWarehouseLocation } from "@/lib/api/shopify/shopify-order-payload";
import { normalizeShopifyShopDomain } from "@/lib/api/shopify/shop-domain";
import { registerShopifyWebhooks } from "@/lib/api/shopify/register-webhooks";
import {
  buildStoredTokenFields,
  type ShopifyOAuthTokenData,
} from "@/lib/api/shopify/tokens";
import {
  parseShopifyAppMode,
  type ShopifyAppMode,
} from "@/lib/api/shopify/app-credentials";
import type { IntegrationSettings } from "@/types/database";
import crypto from "crypto";

type PendingInstall = {
  shop: string;
  access_token: string;
  refresh_token?: string | null;
  scope: string;
  expires_in?: number | null;
  app?: string;
  created_at?: number;
};

function readPending(raw: string): PendingInstall {
  const trimmed = raw.trim();
  const json = trimmed.startsWith("{")
    ? trimmed
    : decryptToken(trimmed);
  return JSON.parse(json) as PendingInstall;
}

/**
 * POST /api/integrations/shopify/claim-install
 * Body: { clientId }
 *
 * Attaches tokens from the `shopify_pending_install` cookie (set after
 * Shopify App URL / begin-install OAuth) to the logged-in portal client.
 */
export async function POST(request: NextRequest) {
  let body: { clientId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clientId = body.clientId?.trim();
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const pendingRaw = request.cookies.get("shopify_pending_install")?.value;
  if (!pendingRaw) {
    return NextResponse.json(
      { error: "No pending Shopify install. Start again from the install link." },
      { status: 400 },
    );
  }

  let pending: PendingInstall;
  try {
    pending = readPending(pendingRaw);
  } catch (e) {
    console.error("claim-install: bad pending cookie", e);
    const res = NextResponse.json(
      { error: "Pending install expired or invalid. Install again from Shopify." },
      { status: 400 },
    );
    res.cookies.delete("shopify_pending_install");
    return res;
  }

  if (
    pending.created_at &&
    Date.now() - pending.created_at > 10 * 60 * 1000
  ) {
    const res = NextResponse.json(
      { error: "Pending install expired. Install again from Shopify." },
      { status: 400 },
    );
    res.cookies.delete("shopify_pending_install");
    return res;
  }

  const accessToken = pending.access_token?.trim();
  if (!accessToken || !pending.shop) {
    return NextResponse.json({ error: "Invalid pending install" }, { status: 400 });
  }

  const appMode: ShopifyAppMode = parseShopifyAppMode(pending.app || "live");
  const shopDomain = normalizeShopifyShopDomain(pending.shop);

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

  const { data: clientAccess } = await userSupabase
    .from("client_users")
    .select("id, role")
    .eq("client_id", clientId)
    .eq("user_id", user.id)
    .single();

  if (!clientAccess || !["owner", "admin"].includes(clientAccess.role)) {
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
    if (shopResponse.ok) {
      const shopInfo = (await shopResponse.json()) as { shop?: { name?: string } };
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
    console.error("claim-install location:", error);
  }

  const tokenData: ShopifyOAuthTokenData = {
    access_token: accessToken,
    scope: pending.scope || "custom_app_admin_api",
    refresh_token: pending.refresh_token || undefined,
    expires_in: pending.expires_in || undefined,
  };
  const storedTokens = buildStoredTokenFields(tokenData);
  const webhookSecret = crypto.randomBytes(32).toString("hex");
  const encryptedWebhookSecret = isEncryptionConfigured()
    ? encryptToken(webhookSecret)
    : webhookSecret;

  const supabase = createServiceClient();
  const { data: integration, error: dbError } = await supabase
    .from("client_integrations")
    .upsert(
      {
        client_id: clientId,
        platform: "shopify",
        shop_domain: shopDomain,
        shop_name: shopName,
        access_token: storedTokens.access_token,
        refresh_token: storedTokens.refresh_token,
        token_expires_at: storedTokens.token_expires_at,
        scope: tokenData.scope,
        webhook_secret: encryptedWebhookSecret,
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
    console.error("claim-install save:", dbError);
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
        connection_mode: appMode === "test" ? "test_app" : "oauth",
      },
    })
    .eq("id", integration.id);

  await registerShopifyWebhooks(integration.id, shopDomain, accessToken);
  await supabase
    .from("client_integrations")
    .update({ webhooks_registered: true })
    .eq("id", integration.id);

  const res = NextResponse.json({
    success: true,
    integrationId: integration.id,
    shop: shopDomain,
    shopName,
  });
  res.cookies.delete("shopify_pending_install");
  return res;
}
