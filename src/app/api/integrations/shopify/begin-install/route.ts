import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { checkOAuthRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  getShopifyAppCredentials,
  isShopifyTestAppConfigured,
  parseShopifyAppMode,
  type ShopifyAppMode,
  type ShopifyAppCredentials,
} from "@/lib/api/shopify/app-credentials";
import { normalizeShopifyShopDomain } from "@/lib/api/shopify/shop-domain";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

function hmacMatches(secret: string, sortedParams: string, hmac: string): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(sortedParams)
    .digest("hex");
  try {
    const a = Buffer.from(hmac, "utf8");
    const b = Buffer.from(expected, "utf8");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return hmac === expected;
  }
}

/**
 * GET /api/integrations/shopify/begin-install?shop=...&app=live|test
 *
 * Shopify App URL / distribution install: merchant installs from the store,
 * Shopify opens the App URL with ?shop=&hmac=, then we send them to
 * /admin/oauth/authorize. After approve, callback stashes tokens for
 * portal claim-install (no shop URL / install link paste in 7D).
 *
 * When `app` is omitted, detect live vs test from which client secret
 * verifies the App URL hmac (test Dev Dashboard apps hit the same App URL).
 */
export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);
  const rateLimit = await checkOAuthRateLimit(clientIp);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const shopRaw = searchParams.get("shop");
  const appParam = searchParams.get("app");
  let appMode: ShopifyAppMode = parseShopifyAppMode(appParam || "live");

  if (!shopRaw) {
    return NextResponse.redirect(
      `${APP_URL}/client-login?redirect=${encodeURIComponent("/portal/integrations")}&error=missing_shop`,
    );
  }

  const hmac = searchParams.get("hmac");
  if (hmac) {
    const params = new URLSearchParams(searchParams);
    params.delete("hmac");
    params.delete("app");
    const sorted = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");

    const modesToTry: ShopifyAppMode[] = appParam
      ? [parseShopifyAppMode(appParam)]
      : isShopifyTestAppConfigured()
        ? ["test", "live"]
        : ["live"];

    let matched: ShopifyAppMode | null = null;
    for (const mode of modesToTry) {
      try {
        const creds = getShopifyAppCredentials(mode);
        if (hmacMatches(creds.clientSecret, sorted, hmac)) {
          matched = mode;
          break;
        }
      } catch {
        /* mode not configured */
      }
    }

    if (matched) {
      appMode = matched;
    } else {
      console.warn(
        "begin-install: App URL hmac mismatch; continuing with app=",
        appMode,
      );
    }
  }

  if (appMode === "test" && !isShopifyTestAppConfigured()) {
    return NextResponse.redirect(
      `${APP_URL}/client-login?redirect=${encodeURIComponent("/portal/integrations")}&error=test_app_not_configured`,
    );
  }

  let credentials: ShopifyAppCredentials;
  try {
    credentials = getShopifyAppCredentials(appMode);
  } catch {
    return NextResponse.redirect(
      `${APP_URL}/client-login?redirect=${encodeURIComponent("/portal/integrations")}&error=oauth_not_configured`,
    );
  }

  let shopDomain = normalizeShopifyShopDomain(shopRaw);
  if (!shopDomain.includes(".myshopify.com")) {
    shopDomain = `${shopDomain}.myshopify.com`;
  }
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shopDomain)) {
    return NextResponse.redirect(
      `${APP_URL}/client-login?redirect=${encodeURIComponent("/portal/integrations")}&error=invalid_shop`,
    );
  }

  if (!APP_URL) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL is not configured" },
      { status: 503 },
    );
  }

  const nonce = crypto.randomBytes(16).toString("hex");
  const statePayload = btoa(
    JSON.stringify({
      source: "begin_install",
      app: appMode,
      shop: shopDomain,
      timestamp: Date.now(),
    }),
  );

  const authUrl = new URL(`https://${shopDomain}/admin/oauth/authorize`);
  authUrl.searchParams.set("client_id", credentials.clientId);
  authUrl.searchParams.set("scope", credentials.scopes);
  authUrl.searchParams.set(
    "redirect_uri",
    `${APP_URL}/api/integrations/shopify/callback`,
  );
  authUrl.searchParams.set("state", `${nonce}:${statePayload}`);
  authUrl.searchParams.append("grant_options[]", "offline");

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set("shopify_oauth_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
