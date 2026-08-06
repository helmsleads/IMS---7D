/**
 * Live vs test Shopify Partners / Dev Dashboard apps.
 *
 * Production stores → SHOPIFY_CLIENT_ID / SECRET
 * Development / test stores → SHOPIFY_TEST_CLIENT_ID / SECRET
 */

export type ShopifyAppMode = "live" | "test";

export type ShopifyAppCredentials = {
  mode: ShopifyAppMode;
  clientId: string;
  clientSecret: string;
  scopes: string;
};

export function isShopifyTestAppConfigured(): boolean {
  return Boolean(
    process.env.SHOPIFY_TEST_CLIENT_ID?.trim() &&
      process.env.SHOPIFY_TEST_CLIENT_SECRET?.trim(),
  );
}

/**
 * Staging / local portals show a dedicated test-store connection card.
 * Production (app.7degreesco.com) stays live-only unless test credentials are set.
 */
export function shouldShowShopifyTestConnectUi(): boolean {
  if (isShopifyTestAppConfigured()) {
    return true;
  }
  if (process.env.NEXT_PUBLIC_SHOPIFY_SHOW_TEST_CONNECT === "true") {
    return true;
  }
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    ""
  ).toLowerCase();
  if (appUrl.includes("app.7degreesco.com")) {
    return false;
  }
  // Staging Vercel / local / preview hosts
  return (
    process.env.VERCEL_ENV !== "production" ||
    appUrl.includes("vercel.app") ||
    appUrl.includes("localhost") ||
    appUrl.includes("127.0.0.1")
  );
}

export function parseShopifyAppMode(raw: unknown): ShopifyAppMode {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (
    value === "test" ||
    value === "test_app" ||
    value === "test_token" ||
    value === "development"
  ) {
    return "test";
  }
  return "live";
}

export function resolveShopifyAppModeFromSettings(
  settings: { connection_mode?: string; shopify_app?: string } | null | undefined,
): ShopifyAppMode {
  if (settings?.shopify_app) {
    return parseShopifyAppMode(settings.shopify_app);
  }
  return parseShopifyAppMode(settings?.connection_mode);
}

export function getShopifyAppCredentials(
  mode: ShopifyAppMode = "live",
): ShopifyAppCredentials {
  if (mode === "test") {
    const clientId = process.env.SHOPIFY_TEST_CLIENT_ID?.trim();
    const clientSecret = process.env.SHOPIFY_TEST_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      throw new Error(
        "Test Shopify app is not configured. Set SHOPIFY_TEST_CLIENT_ID and SHOPIFY_TEST_CLIENT_SECRET.",
      );
    }
    const scopes =
      process.env.SHOPIFY_TEST_SCOPES?.trim() ||
      process.env.SHOPIFY_SCOPES?.trim();
    if (!scopes) {
      throw new Error("SHOPIFY_SCOPES (or SHOPIFY_TEST_SCOPES) must be configured");
    }
    return { mode: "test", clientId, clientSecret, scopes };
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET must be configured");
  }
  const scopes = process.env.SHOPIFY_SCOPES?.trim();
  if (!scopes) {
    throw new Error("SHOPIFY_SCOPES must be configured");
  }
  return { mode: "live", clientId, clientSecret, scopes };
}

/** All configured client secrets (for webhook HMAC when app mode is unknown). */
export function listShopifyWebhookSecrets(): string[] {
  const secrets: string[] = [];
  const live = process.env.SHOPIFY_CLIENT_SECRET?.trim();
  const test = process.env.SHOPIFY_TEST_CLIENT_SECRET?.trim();
  if (live) secrets.push(live);
  if (test && test !== live) secrets.push(test);
  return secrets;
}

export function connectionModeForApp(mode: ShopifyAppMode): "oauth" | "test_app" {
  return mode === "test" ? "test_app" : "oauth";
}
