import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getActiveClient } from "@/lib/api/dtc/clients";
import { DEFAULT_SHOPIFY_INTEGRATION_SETTINGS } from "@/lib/api/dtc/shopify-defaults";
import { normalizeShopifyShopDomain } from "@/lib/api/shopify/shop-domain";
import { verifyDtcApiRequest } from "@/lib/server/dtc-auth";
import { createServiceClient } from "@/lib/supabase-service";

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!;
const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

/**
 * POST /api/dtc/clients/[clientId]/shopify/oauth/start
 * Body: { shop, return_url? }
 *
 * Starts Shopify OAuth for a DTC-provisioned client (no portal browser session).
 * Reuses the shared Shopify callback; nonce is stored in dtc_shopify_oauth_states.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ clientId: string }> },
) {
  const authError = verifyDtcApiRequest(request);
  if (authError) {
    return authError;
  }

  if (!SHOPIFY_CLIENT_ID || !SHOPIFY_SCOPES || !APP_URL) {
    return NextResponse.json(
      { error: "Shopify OAuth is not configured on 7D (SHOPIFY_CLIENT_ID / SCOPES / APP_URL)." },
      { status: 503 },
    );
  }

  try {
    const { clientId } = await context.params;
    const client = await getActiveClient(clientId);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const body = await request.json();
    const shopRaw = String(body?.shop ?? "").trim();
    if (!shopRaw) {
      return NextResponse.json({ error: "shop is required" }, { status: 400 });
    }

    const shopDomain = normalizeShopifyShopDomain(shopRaw);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shopDomain)) {
      return NextResponse.json({ error: "Invalid shop domain format" }, { status: 400 });
    }

    const returnUrl =
      typeof body?.return_url === "string" && body.return_url.startsWith("http")
        ? body.return_url.trim()
        : null;

    const nonce = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const supabase = createServiceClient();

    const { error: insertError } = await supabase.from("dtc_shopify_oauth_states").insert({
      client_id: clientId,
      shop_domain: shopDomain,
      nonce,
      return_url: returnUrl,
      expires_at: expiresAt,
    });

    if (insertError) {
      throw new Error(insertError.message);
    }

    const statePayload = Buffer.from(
      JSON.stringify({
        clientId,
        source: "dtc",
        returnUrl,
      }),
    ).toString("base64");

    const authUrl = new URL(`https://${shopDomain}/admin/oauth/authorize`);
    authUrl.searchParams.set("client_id", SHOPIFY_CLIENT_ID);
    authUrl.searchParams.set("scope", SHOPIFY_SCOPES);
    authUrl.searchParams.set("redirect_uri", `${APP_URL}/api/integrations/shopify/callback`);
    authUrl.searchParams.set("state", `${nonce}:${statePayload}`);
    authUrl.searchParams.append("grant_options[]", "offline");

    return NextResponse.json({
      oauth_url: authUrl.toString(),
      shop_domain: shopDomain,
      client_id: clientId,
      settings_defaults: DEFAULT_SHOPIFY_INTEGRATION_SETTINGS,
    });
  } catch (error) {
    console.error("DTC Shopify OAuth start error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start Shopify OAuth" },
      { status: 500 },
    );
  }
}
