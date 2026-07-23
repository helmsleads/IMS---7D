import { NextRequest, NextResponse } from "next/server";
import { getActiveClient } from "@/lib/api/dtc/clients";
import { DEFAULT_SHOPIFY_INTEGRATION_SETTINGS } from "@/lib/api/dtc/shopify-defaults";
import { SHOPIFY_ADMIN_API_VERSION } from "@/lib/api/shopify/constants";
import { deactivateShopifyLocation } from "@/lib/api/shopify/location-management";
import { getShopifyAccessToken } from "@/lib/api/shopify/tokens";
import { verifyDtcApiRequest } from "@/lib/server/dtc-auth";
import { createServiceClient } from "@/lib/supabase-service";

/**
 * GET /api/dtc/clients/[clientId]/shopify
 * Returns active Shopify integration status for the client (shared with DTC).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ clientId: string }> },
) {
  const authError = verifyDtcApiRequest(request);
  if (authError) {
    return authError;
  }

  try {
    const { clientId } = await context.params;
    const client = await getActiveClient(clientId);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("client_integrations")
      .select(
        "id, platform, shop_domain, shop_name, status, settings, webhooks_registered, last_order_sync_at, last_inventory_sync_at, updated_at",
      )
      .eq("client_id", clientId)
      .eq("platform", "shopify")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      connected: Boolean(data),
      integration: data,
      settings_defaults: DEFAULT_SHOPIFY_INTEGRATION_SETTINGS,
    });
  } catch (error) {
    console.error("DTC Shopify status error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load Shopify status" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/dtc/clients/[clientId]/shopify
 * Soft-disconnect the active Shopify integration for this 7D client.
 * Used by DTC so portal + DTC share one Shopify connection lifecycle.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ clientId: string }> },
) {
  const authError = verifyDtcApiRequest(request);
  if (authError) {
    return authError;
  }

  try {
    const { clientId } = await context.params;
    const client = await getActiveClient(clientId);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const supabase = createServiceClient();
    const { data: integration, error: findError } = await supabase
      .from("client_integrations")
      .select("*")
      .eq("client_id", clientId)
      .eq("platform", "shopify")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) {
      throw new Error(findError.message);
    }

    if (!integration) {
      return NextResponse.json({
        success: true,
        disconnected: false,
        reason: "not_connected",
      });
    }

    if (integration.access_token && integration.shop_domain) {
      try {
        const accessToken = await getShopifyAccessToken(integration);
        await deregisterShopifyWebhooks(integration.shop_domain, accessToken);
        if (integration.location_created_by_us && integration.shopify_location_id) {
          await deactivateShopifyLocation(
            integration.shop_domain,
            accessToken,
            integration.shopify_location_id,
          ).catch((err) =>
            console.warn("Failed to deactivate Shopify location (best effort):", err),
          );
        }
      } catch (cleanupErr) {
        console.warn("Shopify cleanup skipped (token/decrypt):", cleanupErr);
      }
    }

    const { error: updateError } = await supabase
      .from("client_integrations")
      .update({
        status: "disconnected",
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
        webhook_secret: null,
        webhooks_registered: false,
        status_message: "Disconnected via DTC",
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      success: true,
      disconnected: true,
      integration_id: integration.id,
      shop_domain: integration.shop_domain,
    });
  } catch (error) {
    console.error("DTC Shopify disconnect error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to disconnect Shopify",
      },
      { status: 500 },
    );
  }
}

async function deregisterShopifyWebhooks(
  shopDomain: string,
  accessToken: string,
): Promise<void> {
  try {
    const listResponse = await fetch(
      `https://${shopDomain}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/webhooks.json`,
      {
        headers: {
          "X-Shopify-Access-Token": accessToken,
        },
      },
    );

    if (!listResponse.ok) {
      console.warn(
        `Failed to list webhooks (${listResponse.status}), token may be revoked`,
      );
      return;
    }

    const { webhooks } = await listResponse.json();
    if (!webhooks?.length) {
      return;
    }

    for (const webhook of webhooks) {
      try {
        await fetch(
          `https://${shopDomain}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/webhooks/${webhook.id}.json`,
          {
            method: "DELETE",
            headers: {
              "X-Shopify-Access-Token": accessToken,
            },
          },
        );
      } catch (err) {
        console.warn(`Failed to delete webhook ${webhook.id}:`, err);
      }
    }
  } catch (err) {
    console.warn("Webhook deregister failed (best effort):", err);
  }
}
