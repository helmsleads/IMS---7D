import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase-service'
import {
  processShopifyOrder,
  syncShopifyOrderStatusFromPayload,
  attachMappedShopifyLineItemsIfMissing,
  shopifyOrderHas7DTag,
} from '@/lib/api/shopify/order-sync'
import type { IntegrationSettings } from '@/types/database'
import {
  forwardShopifyOrderToDtc,
  shouldForwardShopifyOrderToDtc,
} from '@/lib/api/dtc/shopify-forward'

function isAutoImportEnabled(integration: Record<string, unknown>): boolean {
  const settings = (integration.settings ?? {}) as IntegrationSettings
  // Default true when unset (matches DB default JSON for classic 7D portal)
  return settings.auto_import_orders !== false
}
import { checkWebhookRateLimit } from '@/lib/rate-limit'
import { logSyncResult } from '@/lib/api/shopify/sync-logger'
import {
  getShopifyAppCredentials,
  listShopifyWebhookSecrets,
  resolveShopifyAppModeFromSettings,
} from '@/lib/api/shopify/app-credentials'

/**
 * Handles incoming Shopify webhooks
 * POST /api/webhooks/shopify/[integrationId]
 *
 * Rate limited: 100 requests per minute per integration (distributed via Upstash Redis)
 * HMAC verified with the live or test app client secret for this integration
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  const { integrationId } = await params

  // Rate limit by integration ID (Shopify may send bursts during busy periods)
  // Uses Upstash Redis for distributed rate limiting across Vercel instances
  const rateLimit = await checkWebhookRateLimit(integrationId)

  if (!rateLimit.success) {
    // Return 429 - Shopify will retry later
    return new NextResponse('Rate limited', {
      status: 429,
      headers: { 'Retry-After': String(rateLimit.resetIn) },
    })
  }

  // Get headers
  const hmac = request.headers.get('X-Shopify-Hmac-Sha256')
  const topic = request.headers.get('X-Shopify-Topic')
  const shopDomain = request.headers.get('X-Shopify-Shop-Domain')

  // Get raw body for HMAC verification
  const body = await request.text()

  if (!hmac) {
    console.error('Missing HMAC header')
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // Load integration first so we can verify with the correct app secret
  const supabase = createServiceClient()
  const { data: integration, error: integrationError } = await supabase
    .from('client_integrations')
    .select('*')
    .eq('id', integrationId)
    .single()

  if (integrationError || !integration) {
    console.error('Integration not found:', integrationId)
    return new NextResponse('Integration not found', { status: 404 })
  }

  const appMode = resolveShopifyAppModeFromSettings(
    (integration.settings ?? {}) as { connection_mode?: string; shopify_app?: string }
  )
  const secretsToTry = new Set<string>()
  try {
    secretsToTry.add(getShopifyAppCredentials(appMode).clientSecret)
  } catch {
    /* fall through to all configured secrets */
  }
  for (const secret of listShopifyWebhookSecrets()) {
    secretsToTry.add(secret)
  }

  if (secretsToTry.size === 0) {
    console.error('No Shopify client secrets configured for webhook verification')
    return new NextResponse('Unauthorized', { status: 401 })
  }

  let signatureValid = false
  for (const secret of secretsToTry) {
    const expectedHmac = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('base64')
    try {
      const a = Buffer.from(hmac)
      const b = Buffer.from(expectedHmac)
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        signatureValid = true
        break
      }
    } catch {
      if (hmac === expectedHmac) {
        signatureValid = true
        break
      }
    }
  }

  if (!signatureValid) {
    console.error('Invalid webhook signature')
    return new NextResponse('Invalid signature', { status: 401 })
  }

  if (integration.status === 'disconnected') {
    console.log(`Ignoring webhook for disconnected integration ${integrationId}`)
    return new NextResponse('Integration disconnected', { status: 200 })
  }

  // Parse payload
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(body)
  } catch (e) {
    console.error('Invalid JSON payload:', e)
    return new NextResponse('Invalid payload', { status: 400 })
  }

  // Generate unique event ID for deduplication
  const eventId = `${shopDomain}-${topic}-${payload.id || Date.now()}`

  // Log webhook event (with deduplication)
  const { data: existingEvent } = await supabase
    .from('webhook_events')
    .select('id, status')
    .eq('event_id', eventId)
    .single()

  if (existingEvent) {
    // Already processed or processing
    console.log(`Duplicate webhook ignored: ${eventId}`)
    return new NextResponse('Already processed', { status: 200 })
  }

  // Create event record
  const { data: event, error: eventError } = await supabase
    .from('webhook_events')
    .insert({
      integration_id: integrationId,
      platform: 'shopify',
      event_type: topic,
      event_id: eventId,
      payload,
      headers: { topic, shop_domain: shopDomain },
      status: 'processing',
    })
    .select()
    .single()

  if (eventError) {
    console.error('Failed to log webhook event:', eventError)
    // Continue processing even if logging fails
  }

  // Process webhook based on topic
  try {
    switch (topic) {
      case 'orders/create': {
        const createOutcome = await handleOrderCreate(payload, integration)
        if (createOutcome === 'created') {
          logSyncResult({
            integrationId,
            syncType: 'orders',
            direction: 'inbound',
            triggeredBy: 'webhook',
            itemsProcessed: 1,
            itemsFailed: 0,
            metadata: { orderName: payload.name, topic },
          })
        } else if (createOutcome === 'skipped') {
          logSyncResult({
            integrationId,
            syncType: 'orders',
            direction: 'inbound',
            triggeredBy: 'webhook',
            itemsProcessed: 0,
            itemsFailed: 0,
            metadata: { orderName: payload.name, topic, skipped: 'missing_7d_tag' },
          })
        }
        break
      }
      case 'orders/updated':
        await handleOrderUpdated(payload, integration)
        break
      case 'orders/fulfilled':
        await handleOrderFulfilled(payload, integration)
        break
      case 'orders/cancelled':
        await handleOrderCancelled(payload, integration)
        break
      case 'inventory_levels/update':
        await handleInventoryLevelUpdate(payload, integration, integrationId)
        break
      default:
        console.log(`Unhandled webhook topic: ${topic}`)
    }

    // Mark as processed
    if (event) {
      await supabase
        .from('webhook_events')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', event.id)
    }
  } catch (error) {
    console.error('Webhook processing failed:', error)

    // Log webhook processing failure for order topics
    if (topic === 'orders/create') {
      logSyncResult({
        integrationId,
        syncType: 'orders',
        direction: 'inbound',
        triggeredBy: 'webhook',
        itemsProcessed: 0,
        itemsFailed: 1,
        errorDetails: [{ error: error instanceof Error ? error.message : 'Webhook processing failed' }],
        metadata: { orderName: payload.name, topic },
      })
    }

    // Mark as failed
    if (event) {
      await supabase
        .from('webhook_events')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', event.id)
    }
  }

  // Always return 200 to prevent Shopify retries (we logged it)
  return new NextResponse('OK', { status: 200 })
}

async function handleOrderCreate(
  payload: Record<string, unknown>,
  integration: Record<string, unknown>
): Promise<'created' | 'exists' | 'skipped' | 'forwarded' | 'ignored'> {
  // DTC Alcohol path: government ID in DTC before any 7D fulfill.
  if (shouldForwardShopifyOrderToDtc(integration)) {
    const financial = String(payload.financial_status || "").toLowerCase();
    if (financial && financial !== "paid" && financial !== "partially_paid") {
      console.log(
        `DTC forward skipped for unpaid Shopify order ${payload.name} (${financial})`,
      );
      return 'ignored'
    }
    const result = await forwardShopifyOrderToDtc(payload, {
      id: String(integration.id),
      client_id: String(integration.client_id),
      shop_domain: (integration.shop_domain as string | null) ?? null,
    });
    if (!result.ok) {
      throw new Error(
        `Failed to forward Shopify order to DTC: ${result.body || result.status || "unknown"}`,
      );
    }
    console.log(`Forwarded Shopify order ${payload.name} to DTC for ID verification`);
    return 'forwarded'
  }

  if (!isAutoImportEnabled(integration)) {
    console.log(`Auto-import disabled for integration, skipping order ${payload.name}`)
    return 'ignored'
  }

  // Skip test orders if not in test mode
  if (payload.test === true) {
    console.log(`Test order ${payload.name}, processing anyway for dev`)
  }

  // Requires Shopify tag "7D" — unmatched products are OK (staff finish mapping in 7D).
  const outcome = await processShopifyOrder(payload, integration)
  if (outcome === 'skipped') {
    console.log(`Order ${payload.name} not imported (missing 7D tag)`)
  }
  return outcome
}

async function handleOrderUpdated(
  payload: Record<string, unknown>,
  integration: Record<string, unknown>
): Promise<void> {
  const supabase = createServiceClient()

  const { data: order } = await supabase
    .from('outbound_orders')
    .select('id, status')
    .eq('external_order_id', String(payload.id))
    .eq('external_platform', 'shopify')
    .single()

  if (!order) {
    // Paid/updated after create: DTC path may have skipped unpaid create.
    if (shouldForwardShopifyOrderToDtc(integration)) {
      const financial = String(payload.financial_status || "").toLowerCase();
      if (financial && financial !== "paid" && financial !== "partially_paid") {
        console.log(
          `DTC forward skipped for unpaid Shopify order update ${payload.name} (${financial})`,
        );
        return;
      }
      const result = await forwardShopifyOrderToDtc(payload, {
        id: String(integration.id),
        client_id: String(integration.client_id),
        shop_domain: (integration.shop_domain as string | null) ?? null,
      });
      if (!result.ok) {
        throw new Error(
          `Failed to forward Shopify order to DTC: ${result.body || result.status || "unknown"}`,
        );
      }
      console.log(`Forwarded Shopify order ${payload.name} to DTC on update`);
      return;
    }

    // Tag added after create: import when 7D tag is present.
    if (isAutoImportEnabled(integration)) {
      if (!shopifyOrderHas7DTag(payload.tags as string | string[] | null | undefined)) {
        console.log(`Order ${payload.id} not in IMS and missing 7D tag — not importing`)
        return
      }
      console.log(`Order ${payload.id} not in IMS — importing from orders/updated (7D tag)`)
      await processShopifyOrder(payload, integration)
    } else {
      console.log(`Order ${payload.id} not found in IMS; auto-import is off`)
    }
    return
  }

  await attachMappedShopifyLineItemsIfMissing(
    order.id,
    payload,
    String(integration.id)
  )

  const statusResult = await syncShopifyOrderStatusFromPayload(payload)
  if (statusResult.updated) {
    console.log(
      `Synced Shopify status for order ${order.id} → ${statusResult.status}`
    )
  }

  const statusAfterSync = statusResult.status ?? order.status
  if (!['pending', 'confirmed'].includes(statusAfterSync)) {
    return
  }

  const addr = payload.shipping_address as Record<string, unknown> | null
  if (addr) {
    await supabase
      .from('outbound_orders')
      .update({
        ship_to_name: `${addr.first_name || ''} ${addr.last_name || ''}`.trim(),
        ship_to_company: addr.company || null,
        ship_to_address: addr.address1,
        ship_to_address2: addr.address2 || null,
        ship_to_city: addr.city,
        ship_to_state: addr.province_code,
        ship_to_zip: addr.zip,
        ship_to_country: addr.country_code,
        ship_to_phone: addr.phone || null,
      })
      .eq('id', order.id)

    console.log(`Updated shipping address for order ${order.id}`)
  }
}

async function handleOrderFulfilled(
  payload: Record<string, unknown>,
  _integration: Record<string, unknown>
): Promise<void> {
  const result = await syncShopifyOrderStatusFromPayload(payload)
  if (result.updated) {
    console.log(`Order ${payload.name} marked ${result.status} from Shopify fulfillment`)
  }
}

async function handleInventoryLevelUpdate(
  payload: Record<string, unknown>,
  integration: Record<string, unknown>,
  integrationId: string
): Promise<void> {
  const supabase = createServiceClient()
  const integrationData = integration as { id: string; shopify_location_id: string | null; settings: Record<string, unknown> }

  // Ignore if change is at a different location than our shopify_location_id
  const locationId = String(payload.location_id || '')
  if (integrationData.shopify_location_id && locationId !== integrationData.shopify_location_id) {
    console.log(`Inventory update at location ${locationId} ignored (our location: ${integrationData.shopify_location_id})`)
    return
  }

  const inventoryItemId = String(payload.inventory_item_id || '')
  if (!inventoryItemId) return

  // Look up product_mappings by external_inventory_item_id
  const { data: mapping } = await supabase
    .from('product_mappings')
    .select('id, product_id, last_synced_at')
    .eq('integration_id', integrationId)
    .eq('external_inventory_item_id', inventoryItemId)
    .single()

  if (!mapping) {
    console.log(`No mapping found for inventory_item_id ${inventoryItemId}`)
    return
  }

  // If last_synced_at is within 60 seconds, assume it's our own sync → ignore
  if (mapping.last_synced_at) {
    const syncAge = Date.now() - new Date(mapping.last_synced_at).getTime()
    if (syncAge < 60000) {
      console.log(`Inventory update for ${inventoryItemId} is likely our own sync (${Math.round(syncAge / 1000)}s ago), ignoring`)
      return
    }
  }

  // External change detected — log as inbound sync event with warning
  console.warn(`External inventory change detected in Shopify for product ${mapping.product_id}`)

  logSyncResult({
    integrationId,
    syncType: 'inventory',
    direction: 'inbound',
    triggeredBy: 'webhook',
    itemsProcessed: 1,
    itemsFailed: 0,
    metadata: {
      warning: 'Inventory changed externally in Shopify',
      inventoryItemId,
      productId: mapping.product_id,
      available: payload.available,
    },
  })
}

async function handleOrderCancelled(
  payload: Record<string, unknown>,
  integration: Record<string, unknown>
): Promise<void> {
  const supabase = createServiceClient()

  // Find the IMS order
  const { data: order } = await supabase
    .from('outbound_orders')
    .select('id, status, notes')
    .eq('external_order_id', String(payload.id))
    .eq('external_platform', 'shopify')
    .single()

  if (!order) {
    console.log(`Cancelled order ${payload.id} not found in IMS`)
    return
  }

  // Only cancel if not already shipped
  if (['pending', 'confirmed', 'processing', 'packed'].includes(order.status)) {
    await supabase
      .from('outbound_orders')
      .update({
        status: 'cancelled',
        notes: `${order.notes || ''}\n[Auto-cancelled from Shopify at ${new Date().toISOString()}]`.trim(),
      })
      .eq('id', order.id)

    console.log(`Cancelled order ${order.id} from Shopify webhook`)

    // Release reserved inventory
    const defaultLocationId = (integration as Record<string, any>).settings?.default_location_id
    if (defaultLocationId) {
      try {
        // Get order items to release reservations
        const { data: items } = await supabase
          .from('outbound_items')
          .select('id, product_id, qty_requested, qty_shipped')
          .eq('order_id', order.id)

        for (const item of items || []) {
          const qtyToRelease = (item.qty_requested || 0) - (item.qty_shipped || 0)
          if (qtyToRelease <= 0) continue

          await supabase.rpc('release_reservation', {
            p_product_id: item.product_id,
            p_location_id: defaultLocationId,
            p_qty_to_release: qtyToRelease,
            p_also_deduct: false,
            p_reference_type: 'outbound_order',
            p_reference_id: order.id,
            p_performed_by: null,
          })
        }

        console.log(`Released reservations for cancelled order ${order.id}`)
      } catch (releaseError) {
        console.error(`Failed to release reservations for order ${order.id}:`, releaseError)
      }
    }
  } else {
    console.log(`Order ${order.id} already ${order.status}, cannot cancel`)
  }
}
