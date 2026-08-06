import { NextResponse } from "next/server";
import {
  isShopifyTestAppConfigured,
  shouldShowShopifyTestConnectUi,
} from "@/lib/api/shopify/app-credentials";

/**
 * GET /api/integrations/shopify/test-connect
 * Capability probe for the portal Integrations UI.
 *
 * Test stores connect via OAuth using SHOPIFY_TEST_CLIENT_ID / SECRET
 * (`/api/integrations/shopify/auth?app=test`).
 */
export async function GET() {
  return NextResponse.json({
    enabled: isShopifyTestAppConfigured(),
    show_test_card: shouldShowShopifyTestConnectUi(),
    mode: "oauth",
    app: "test",
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
