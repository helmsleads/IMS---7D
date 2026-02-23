import { createServiceClient } from '@/lib/supabase-service'
import { decryptToken } from '@/lib/encryption'
import { logSyncResult } from './sync-logger'
import type { ClientIntegration, ShopifyOrder, ShopifyLineItem, ShopifyAddress, SyncTrigger } from '@/types/database'

/**
 * Process and import a Shopify order into IMS
 */
export async function processShopifyOrder(
  shopifyOrder: Record<string, unknown>,
  integration: Record<string, unknown>
): Promise<void> {
  const supabase = createServiceClient()

  const order = shopifyOrder as unknown as ShopifyOrder
  const integrationData = integration as unknown as ClientIntegration

  // Create order number from Shopify order name
  const orderNumber = `SH-${order.name.replace('#', '').replace(/\s/g, '')}`

  // Check if order already exists by external ID
  const { data: existing } = await supabase
    .from('outbound_orders')
    .select('id')
    .eq('external_order_id', String(order.id))
    .eq('external_platform', 'shopify')
    .single()

  if (existing) {
    console.log(`Order ${order.name} already exists in IMS, skipping`)
    return
  }

  // Get product mappings for this integration
  const { data: mappings } = await supabase
    .from('product_mappings')
    .select('*, product:products(id, sku, name)')
    .eq('integration_id', integrationData.id)

  // Create lookup maps
  const mappingsByVariant = new Map(
    (mappings || []).map((m) => [String(m.external_variant_id), m])
  )
  const mappingsBySku = new Map(
    (mappings || [])
      .filter((m) => m.external_sku)
      .map((m) => [m.external_sku!.toLowerCase(), m])
  )

  // Transform line items
  const lineItems: Array<{
    product_id: string
    qty_requested: number
    unit_price: number
  }> = []

  const unmappedItems: string[] = []

  for (const item of order.line_items || []) {
    // Skip non-shippable items
    if (!item.requires_shipping || item.fulfillable_quantity <= 0) {
      continue
    }

    // Find mapping by variant ID first, then by SKU
    let mapping = mappingsByVariant.get(String(item.variant_id))
    if (!mapping && item.sku) {
      mapping = mappingsBySku.get(item.sku.toLowerCase())
    }

    if (!mapping) {
      unmappedItems.push(`${item.sku || 'No SKU'}: ${item.name}`)
      continue
    }

    lineItems.push({
      product_id: mapping.product_id,
      qty_requested: item.fulfillable_quantity,
      unit_price: parseFloat(item.price),
    })
  }

  // If no items could be mapped, log warning but still create order
  if (lineItems.length === 0 && unmappedItems.length > 0) {
    console.warn(`Order ${order.name} has no mapped products:`, unmappedItems)
  }

  // Build shipping info
  const addr = order.shipping_address
  const shippingMethod = order.shipping_lines?.[0]?.title || 'Standard'

  // Determine if rush based on tags or shipping method
  const isRush =
    order.tags?.toLowerCase().includes('rush') ||
    shippingMethod.toLowerCase().includes('express') ||
    shippingMethod.toLowerCase().includes('overnight') ||
    shippingMethod.toLowerCase().includes('priority')

  // Build notes
  const notes: string[] = []
  if (order.note) {
    notes.push(`Customer note: ${order.note}`)
  }
  if (unmappedItems.length > 0) {
    notes.push(`⚠️ ${unmappedItems.length} item(s) could not be mapped: ${unmappedItems.join(', ')}`)
  }

  // Build notes
  const fullNotes = notes.length > 0 ? notes.join('\n') : null

  // Create the order with full shipping details
  const { data: newOrder, error: orderError } = await supabase
    .from('outbound_orders')
    .insert({
      client_id: integrationData.client_id,
      order_number: orderNumber,
      source: 'api',
      status: 'pending',

      // External platform tracking
      external_order_id: String(order.id),
      external_platform: 'shopify',
      external_order_number: order.name,
      integration_id: integrationData.id,

      // Shipping address
      ship_to_name: addr ? `${addr.first_name} ${addr.last_name}`.trim() : null,
      ship_to_company: addr?.company || null,
      ship_to_address: addr?.address1 || null,
      ship_to_address2: addr?.address2 || null,
      ship_to_city: addr?.city || null,
      ship_to_state: addr?.province_code || null,
      ship_to_postal_code: addr?.zip || null,
      ship_to_country: addr?.country_code || null,
      ship_to_phone: addr?.phone || null,
      ship_to_email: order.email || null,

      // Order details
      is_rush: isRush,
      notes: fullNotes,
      requested_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (orderError) {
    console.error('Failed to create order:', orderError)
    throw new Error(`Failed to create order: ${orderError.message}`)
  }

  // Create line items
  if (lineItems.length > 0) {
    const { error: itemsError } = await supabase.from('outbound_items').insert(
      lineItems.map((item) => ({
        order_id: newOrder.id,
        product_id: item.product_id,
        qty_requested: item.qty_requested,
        unit_price: item.unit_price,
      }))
    )

    if (itemsError) {
      console.error('Failed to create order items:', itemsError)
      // Don't throw - order was created, items can be added manually
    }
  }

  // Update integration last sync time
  await supabase
    .from('client_integrations')
    .update({ last_order_sync_at: new Date().toISOString() })
    .eq('id', integrationData.id)

  console.log(`Created order ${newOrder.order_number} from Shopify ${order.name}`)
}

/**
 * Manually sync orders from Shopify (pull)
 */
export async function syncShopifyOrders(
  integrationId: string,
  since?: Date,
  triggeredBy: SyncTrigger = 'manual'
): Promise<{ imported: number; skipped: number; failed: number }> {
  const startTime = Date.now()
  const supabase = createServiceClient()

  // Get integration
  const { data: integration, error } = await supabase
    .from('client_integrations')
    .select('*')
    .eq('id', integrationId)
    .single()

  if (error || !integration) {
    throw new Error('Integration not found')
  }

  if (!integration.access_token || !integration.shop_domain) {
    throw new Error('Integration not properly configured')
  }

  // Build query params
  const params = new URLSearchParams({
    status: 'open',
    fulfillment_status: 'unfulfilled',
    limit: '250',
  })

  if (since) {
    params.set('created_at_min', since.toISOString())
  }

  // Fetch orders from Shopify (decrypt token for API call)
  const accessToken = decryptToken(integration.access_token)
  const response = await fetch(
    `https://${integration.shop_domain}/admin/api/2024-01/orders.json?${params}`,
    {
      headers: {
        'X-Shopify-Access-Token': accessToken,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.status}`)
  }

  const data = await response.json()
  const orders = data.orders || []

  const results = { imported: 0, skipped: 0, failed: 0 }

  for (const order of orders) {
    try {
      // Check if already exists by external ID
      const { data: existing } = await supabase
        .from('outbound_orders')
        .select('id')
        .eq('external_order_id', String(order.id))
        .eq('external_platform', 'shopify')
        .single()

      if (existing) {
        results.skipped++
        continue
      }

      await processShopifyOrder(order, integration)
      results.imported++
    } catch (e) {
      console.error(`Failed to import order ${order.name}:`, e)
      results.failed++
    }
  }

  // Log sync result
  logSyncResult({
    integrationId,
    syncType: 'orders',
    direction: 'inbound',
    triggeredBy,
    itemsProcessed: results.imported,
    itemsFailed: results.failed,
    durationMs: Date.now() - startTime,
    metadata: { skipped: results.skipped },
  })

  return results
}
