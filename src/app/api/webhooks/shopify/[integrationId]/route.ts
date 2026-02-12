import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase-service'
import { processShopifyOrder } from '@/lib/api/shopify/order-sync'
import { checkWebhookRateLimit } from '@/lib/rate-limit'

// Shopify signs webhooks with the OAuth Client Secret
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!

/**
 * Handles incoming Shopify webhooks
 * POST /api/webhooks/shopify/[integrationId]
 *
 * Rate limited: 100 requests per minute per integration (distributed via Upstash Redis)
 * HMAC signature verification required using SHOPIFY_CLIENT_SECRET
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

  // Verify HMAC signature using Shopify Client Secret
  // Shopify signs all webhook payloads with the OAuth client secret
  if (!hmac || !SHOPIFY_CLIENT_SECRET) {
    console.error('Missing HMAC header or SHOPIFY_CLIENT_SECRET not configured')
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const expectedHmac = crypto
    .createHmac('sha256', SHOPIFY_CLIENT_SECRET)
    .update(body, 'utf8')
    .digest('base64')

  if (hmac !== expectedHmac) {
    console.error('Invalid webhook signature')
    return new NextResponse('Invalid signature', { status: 401 })
  }

  // Get integration from database (after signature verified)
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
      case 'orders/create':
        await handleOrderCreate(payload, integration)
        break
      case 'orders/updated':
        await handleOrderUpdated(payload, integration)
        break
      case 'orders/cancelled':
        await handleOrderCancelled(payload, integration)
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
): Promise<void> {
  // Skip if already fulfilled
  if (payload.fulfillment_status === 'fulfilled') {
    console.log(`Order ${payload.name} already fulfilled, skipping`)
    return
  }

  // Skip test orders if not in test mode
  if (payload.test === true) {
    console.log(`Test order ${payload.name}, processing anyway for dev`)
  }

  await processShopifyOrder(payload, integration)
}

async function handleOrderUpdated(
  payload: Record<string, unknown>,
  integration: Record<string, unknown>
): Promise<void> {
  const supabase = createServiceClient()

  // Find existing IMS order
  const { data: order } = await supabase
    .from('outbound_orders')
    .select('id, status')
    .eq('external_order_id', String(payload.id))
    .eq('external_platform', 'shopify')
    .single()

  if (!order) {
    console.log(`Order ${payload.id} not found in IMS, may need to import`)
    // Could trigger order create if not exists
    return
  }

  // Only update if order is still in early stages
  if (!['pending', 'confirmed'].includes(order.status)) {
    console.log(`Order ${order.id} already in progress, not updating from Shopify`)
    return
  }

  // Update shipping address if changed
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
        ship_to_postal_code: addr.zip,
        ship_to_country: addr.country_code,
        ship_to_phone: addr.phone || null,
      })
      .eq('id', order.id)

    console.log(`Updated shipping address for order ${order.id}`)
  }
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
