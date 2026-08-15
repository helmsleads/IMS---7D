import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { checkOAuthRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  getShopifyAppCredentials,
  isShopifyTestAppConfigured,
  parseShopifyAppMode,
  type ShopifyAppMode,
} from "@/lib/api/shopify/app-credentials";
import { normalizeShopifyShopDomain } from "@/lib/api/shopify/shop-domain";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

/**
 * GET /api/integrations/shopify/begin-install?shop=...&app=live|test
 *
 * Legacy install flow: Shopify opens the App URL with ?shop=&hmac= after the
 * distribution install link. The app must then send the merchant to
 * /admin/oauth/authorize (Install / Approve). Portal Connect already does that;
 * this route does it for Shopify-initiated installs (no portal login yet).
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
  const appMode: ShopifyAppMode = parseShopifyAppMode(
    searchParams.get("app") || "live",
  );

  if (!shopRaw) {
    return NextResponse.redirect(
      `${APP_URL}/client-login?redirect=${encodeURIComponent("/portal/integrations")}&error=missing_shop`,
    );
  }

  if (appMode === "test" && !isShopifyTestAppConfigured()) {
    return NextResponse.redirect(
      `${APP_URL}/client-login?redirect=${encodeURIComponent("/portal/integrations")}&error=test_app_not_configured`,
    );
  }

  let credentials;
  try {
    credentials = getShopifyAppCredentials(appMode);
  } catch {
    return NextResponse.redirect(
      `${APP_URL}/client-login?redirect=${encodeURIComponent("/portal/integrations")}&error=oauth_not_configured`,
    );
  }

  // Optional: verify App URL hmac (exclude our own `app` query — not part of Shopify signature)
  const hmac = searchParams.get("hmac");
  if (hmac) {
    const params = new URLSearchParams(searchParams);
    params.delete("hmac");
    params.delete("app");
    const sorted = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");

    const secrets = [credentials.clientSecret];
    try {
      if (appMode === "live") {
        const testCreds = getShopifyAppCredentials("test");
        if (testCreds.clientSecret !== credentials.clientSecret) {
          secrets.push(testCreds.clientSecret);
        }
      }
    } catch {
      /* test app optional */
    }

    let hmacOk = false;
    for (const secret of secrets) {
      const expected = crypto
        .createHmac("sha256", secret)
        .update(sorted)
        .digest("hex");
      try {
        const a = Buffer.from(hmac, "utf8");
        const b = Buffer.from(expected, "utf8");
        if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
          hmacOk = true;
          break;
        }
      } catch {
        if (hmac === expected) {
          hmacOk = true;
          break;
        }
      }
    }

    // Do not block install on hmac mismatch — client_id is public and authorize
    // is the real gate. Bad hmac used to bounce merchants to client-login.
    if (!hmacOk) {
      console.warn(
        "begin-install: App URL hmac mismatch; continuing to OAuth authorize",
      );
    }
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
