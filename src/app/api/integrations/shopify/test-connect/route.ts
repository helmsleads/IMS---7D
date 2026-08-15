import { NextResponse } from "next/server";
import {
  isShopifyTestAppConfigured,
  shouldShowShopifyTestConnectUi,
} from "@/lib/api/shopify/app-credentials";

function clientIdPrefix(envName: string): string | null {
  const value = process.env[envName]?.trim();
  if (!value) return null;
  return value.slice(0, 8);
}

/**
 * GET /api/integrations/shopify/test-connect
 * Capability probe for the portal Integrations UI.
 *
 * Live: Partners OAuth via `/api/integrations/shopify/auth?app=live`.
 * Test: portal Connect → Shopify Admin install/approve via `auth?app=test`
 * (`SHOPIFY_TEST_CLIENT_*`).
 *
 * `live_client_id_prefix` / `test_client_id_prefix` are non-secret fingerprints
 * so you can confirm Vercel env matches Dev Dashboard (e.g. test must be 9c24cd2d…).
 */
export async function GET() {
  const livePrefix = clientIdPrefix("SHOPIFY_CLIENT_ID");
  const testPrefix = clientIdPrefix("SHOPIFY_TEST_CLIENT_ID");
  return NextResponse.json({
    enabled: isShopifyTestAppConfigured(),
    show_test_card: shouldShowShopifyTestConnectUi(),
    mode: "oauth",
    app: "test",
    live_client_id_prefix: livePrefix,
    test_client_id_prefix: testPrefix,
    test_matches_live: Boolean(
      livePrefix && testPrefix && livePrefix === testPrefix,
    ),
  });
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Use OAuth with the test Shopify app: GET /api/integrations/shopify/auth?app=test&shop=...&state=...",
    },
    { status: 405 },
  );
}
