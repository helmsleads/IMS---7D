import { createServiceClient } from '@/lib/supabase-service'
import { ShopifyApiError } from './client'
import { createShopifyClientForIntegration } from './tokens'
import { fetchOrdersForSync } from './graphql/orders-sync'
import { logSyncResult } from './sync-logger'
import {
  mapShopifyFulfillmentToImsStatus,
  shouldAdvanceImsStatus,
  extractShopifyTracking,
  extractDeliveryDate,
  shopifyLineItemQtyShipped,
} from './order-status-sync'
import { deductInventoryFromShopifyFulfillment } from './order-inventory-deduction'
import {
  normalizeShopifyOrderPayload,
  ensureIntegrationWarehouseLocation,
} from './shopify-order-payload'
import { shopifyOrderHas7DTag } from './order-tag'
import type {
  ClientIntegration,
  ShopifyOrder,
  ShopifyLineItem,
  OutboundStatus,
  SyncTrigger,
} from '@/types/database'

export type ProcessShopifyOrderResult = 'created' | 'exists' | 'skipped'

export { shopifyOrderHas7DTag, SHOPIFY_7D_ORDER_TAG } from './order-tag'

export {
  mapShopifyFulfillmentToImsStatus,
  shouldAdvanceImsStatus,
  extractShopifyTracking,
  extractDeliveryDate,
  shopifyLineItemQtyShipped,
} from './order-status-sync'

function isShopifyOrderCancelled(shopifyOrder: Record<string, unknown>): boolean {
  if (shopifyOrder.cancelled_at) return true
  const status = String(shopifyOrder.status ?? '').toLowerCase()
  return status === 'cancelled'
}

/**
 * Sync line item qty_requested / qty_shipped from Shopify line quantities.
 */
export async function syncShopifyOrderLineItems(
  imsOrderId: string,
  shopifyOrder: Record<string, unknown>,
  integrationId: string
): Promise<{ updated: boolean }> {
  const supabase = createServiceClient()
  const order = shopifyOrder as unknown as ShopifyOrder
  const lineItems = order.line_items ?? []
  if (!lineItems.length) return { updated: false }

  const { data: mappings } = await supabase
    .from('product_mappings')
    .select('product_id, external_variant_id, external_sku')
    .eq('integration_id', integrationId)

  const mappingsByVariant = new Map(
    (mappings || []).map((m) => [String(m.external_variant_id), m.product_id])
  )
  const mappingsBySku = new Map(
    (mappings || [])
      .filter((m) => m.external_sku)
      .map((m) => [m.external_sku!.toLowerCase(), m.product_id])
  )

  const { data: outboundItems } = await supabase
    .from('outbound_items')
    .select('id, product_id, qty_requested, qty_shipped')
    .eq('order_id', imsOrderId)

  if (!outboundItems?.length) return { updated: false }

  const itemsByProduct = new Map(outboundItems.map((i) => [i.product_id, i]))
  let updated = false

  for (const item of lineItems) {
    if (!item.requires_shipping) continue

    const productId = resolveMappedProductId(item, mappingsByVariant, mappingsBySku)
    if (!productId) continue

    const outboundItem = itemsByProduct.get(productId)
    if (!outboundItem) continue

    const qtyRequested = item.quantity
    const qtyShipped = shopifyLineItemQtyShipped(item)

    if (
      outboundItem.qty_requested === qtyRequested &&
      outboundItem.qty_shipped === qtyShipped
    ) {
      continue
    }

    const { error: itemError } = await supabase
      .from('outbound_items')
      .update({ qty_requested: qtyRequested, qty_shipped: qtyShipped })
      .eq('id', outboundItem.id)

    if (itemError) {
      throw new Error(itemError.message)
    }
    updated = true
    outboundItem.qty_requested = qtyRequested
    outboundItem.qty_shipped = qtyShipped
  }

  return { updated }
}

function resolveMappedProductId(
  item: ShopifyLineItem,
  mappingsByVariant: Map<string, string>,
  mappingsBySku: Map<string, string>
): string | undefined {
  const byVariant = mappingsByVariant.get(String(item.variant_id))
  if (byVariant) return byVariant
  if (item.sku) return mappingsBySku.get(item.sku.toLowerCase())
  return undefined
}

/**
 * Apply Shopify fulfillment/cancel state to an existing IMS outbound order.
 * Status only moves forward (except cancel). Tracking is filled when Shopify ships.
 */
export async function applyShopifyStatusToOrder(
  imsOrderId: string,
  shopifyOrder: Record<string, unknown>
): Promise<{ updated: boolean; status?: string; inventoryDeducted?: boolean }> {
  const supabase = createServiceClient()
  const normalizedOrder = normalizeShopifyOrderPayload(shopifyOrder)

  const { data: order, error } = await supabase
    .from('outbound_orders')
    .select(
      'id, status, notes, tracking_number, carrier, shipped_date, delivered_date, integration_id'
    )
    .eq('id', imsOrderId)
    .single()

  if (error || !order) {
    throw new Error(error?.message ?? 'Order not found')
  }

  const fulfillments = normalizedOrder.fulfillments as
    | Array<Record<string, unknown>>
    | undefined

  const fulfillmentStatus = normalizedOrder.fulfillment_status as string | null | undefined
  const targetStatus = mapShopifyFulfillmentToImsStatus(fulfillmentStatus, {
    cancelled: isShopifyOrderCancelled(normalizedOrder),
    fulfillments,
  })

  const tracking = extractShopifyTracking(normalizedOrder)
  let headerUpdated = false
  let appliedStatus: string | undefined

  if (shouldAdvanceImsStatus(order.status, targetStatus)) {
    const update: Record<string, unknown> = { status: targetStatus }

    if (targetStatus === 'shipped' || targetStatus === 'delivered') {
      if (!order.shipped_date) {
        update.shipped_date = tracking.shipped_at ?? new Date().toISOString()
      }
      if (tracking.tracking_number && !order.tracking_number) {
        update.tracking_number = tracking.tracking_number
      }
      if (tracking.carrier && !order.carrier) {
        update.carrier = tracking.carrier
      }
    }

    if (targetStatus === 'delivered' && !order.delivered_date) {
      update.delivered_date =
        extractDeliveryDate(normalizedOrder) ?? new Date().toISOString()
    }

    if (targetStatus === 'cancelled') {
      const stamp = new Date().toISOString()
      update.notes =
        `${order.notes || ''}\n[Status synced from Shopify: cancelled at ${stamp}]`.trim()
    } else if (targetStatus !== order.status) {
      const stamp = new Date().toISOString()
      update.notes =
        `${order.notes || ''}\n[Status synced from Shopify: ${targetStatus} at ${stamp}]`.trim()
    }

    const { error: updateError } = await supabase
      .from('outbound_orders')
      .update(update)
      .eq('id', imsOrderId)

    if (updateError) {
      throw new Error(updateError.message)
    }

    headerUpdated = true
    appliedStatus = targetStatus
  }

  const inventoryResult =
    order.integration_id != null && !isShopifyOrderCancelled(normalizedOrder)
      ? await deductInventoryFromShopifyFulfillment(
          imsOrderId,
          normalizedOrder,
          order.integration_id
        )
      : { deducted: false, linesProcessed: 0 }

  const lineResult =
    order.integration_id != null
      ? await syncShopifyOrderLineItems(
          imsOrderId,
          normalizedOrder,
          order.integration_id
        )
      : { updated: false }

  if (!headerUpdated && !lineResult.updated && !inventoryResult.deducted) {
    return { updated: false }
  }

  return {
    updated: true,
    status: appliedStatus,
    inventoryDeducted: inventoryResult.deducted,
  }
}

/** Webhook / REST payload → status sync for an order matched by Shopify id. */
export async function syncShopifyOrderStatusFromPayload(
  payload: Record<string, unknown>
): Promise<{ updated: boolean; status?: string }> {
  const supabase = createServiceClient()
  const normalized = normalizeShopifyOrderPayload(payload)

  const { data: order } = await supabase
    .from('outbound_orders')
    .select('id')
    .eq('external_order_id', String(payload.id))
    .eq('external_platform', 'shopify')
    .single()

  if (!order) {
    return { updated: false }
  }

  return applyShopifyStatusToOrder(order.id, normalized)
}

/**
 * Global unique outbound order_number — must not collide across shops
 * (every store restarts at #1001).
 */
export function buildShopifyOrderNumber(
  orderName: string,
  shopDomain?: string | null
): string {
  const namePart = String(orderName || '')
    .replace(/#/g, '')
    .replace(/\s/g, '')
  const shop = String(shopDomain || '')
    .toLowerCase()
    .replace(/\.myshopify\.com$/i, '')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 40)
  return shop ? `SH-${shop}-${namePart}` : `SH-${namePart}`
}

/**
 * Process and import a Shopify order into IMS.
 * Only orders tagged **7D** are imported (warehouse location is not reliable for multi-fulfillment shops).
 * Unmapped line items still create the outbound order so 7D staff can finish product matching.
 */
export async function processShopifyOrder(
  shopifyOrder: Record<string, unknown>,
  integration: Record<string, unknown>
): Promise<ProcessShopifyOrderResult> {
  const supabase = createServiceClient()

  const order = shopifyOrder as unknown as ShopifyOrder
  const integrationData = integration as unknown as ClientIntegration

  if (!shopifyOrderHas7DTag(order.tags)) {
    console.log(
      `Order ${order.name} skipped — missing 7D tag (add tag "7D" in Shopify Admin to assign to 7 Degrees)`
    )
    return 'skipped'
  }

  const orderNumber = buildShopifyOrderNumber(
    order.name,
    integrationData.shop_domain
  )

  // Check if order already exists by external ID
  const { data: existing } = await supabase
    .from('outbound_orders')
    .select('id')
    .eq('external_order_id', String(order.id))
    .eq('external_platform', 'shopify')
    .single()

  if (existing) {
    console.log(`Order ${order.name} already exists in IMS, skipping`)
    return 'exists'
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

  // Transform line items (matched + unmatched display rows)
  const lineItems: Array<{
    product_id: string | null
    qty_requested: number
    qty_shipped: number
    unit_price: number
    external_sku?: string | null
    external_title?: string | null
    is_unmatched?: boolean
    virtual_qty?: number
  }> = []

  const unmappedItems: string[] = []
  let hasUnmatchedLines = false

  for (const item of order.line_items || []) {
    if (!item.requires_shipping || item.quantity <= 0) {
      continue
    }

    // Find mapping by variant ID first, then by SKU
    let mapping = mappingsByVariant.get(String(item.variant_id))
    if (!mapping && item.sku) {
      mapping = mappingsBySku.get(item.sku.toLowerCase())
    }

    if (!mapping) {
      const label = `${item.sku || 'No SKU'}: ${item.name}`
      unmappedItems.push(label)
      hasUnmatchedLines = true
      // Persist unmatched line for tester UI: real qty 0, virtual_qty = Shopify qty
      lineItems.push({
        product_id: null,
        qty_requested: 0,
        qty_shipped: 0,
        unit_price: parseFloat(item.price) || 0,
        external_sku: item.sku || null,
        external_title: item.name || item.title || null,
        is_unmatched: true,
        virtual_qty: item.quantity,
      })
      continue
    }

    // Mapped lines (including no-SKU / Test-tab mappings) are real fulfillable lines.
    // Missing Shopify SKU alone does not make the order a test order.
    lineItems.push({
      product_id: mapping.product_id,
      qty_requested: item.quantity,
      qty_shipped: 0,
      unit_price: parseFloat(item.price),
      is_unmatched: false,
      virtual_qty: 0,
    })
  }

  // 7D-tagged orders import even with zero mapped lines — staff finish matching in 7D.
  if (hasUnmatchedLines) {
    console.warn(
      `Order ${order.name} imported with unmapped products (7D tag present):`,
      unmappedItems
    )
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

  // Build notes — [test] only when Shopify marks the order as test, not for no-SKU mappings
  const notes: string[] = []
  if (order.test === true) {
    notes.push('[test]')
  }
  notes.push('[7D]')
  if (order.note) {
    notes.push(`Customer note: ${order.note}`)
  }
  if (unmappedItems.length > 0) {
    notes.push('[needs mapping]')
    notes.push(
      `⚠️ ${unmappedItems.length} item(s) not matching IMS (shown with virtual qty): ${unmappedItems.join(', ')}`
    )
  }

  // Build notes
  const fullNotes = notes.length > 0 ? notes.join('\n') : null

  const initialStatus = mapShopifyFulfillmentToImsStatus(order.fulfillment_status, {
    cancelled: !!order.cancelled_at,
    fulfillments: order.fulfillments,
  })
  const tracking = extractShopifyTracking(order as unknown as Record<string, unknown>)

  const insertRow: Record<string, unknown> = {
      client_id: integrationData.client_id,
      order_number: orderNumber,
      source: 'api',
      status: initialStatus,

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
      ship_to_zip: addr?.zip || null,
      ship_to_country: addr?.country_code || null,
      ship_to_phone: addr?.phone || null,
      ship_to_email: order.email || null,

      // Order details
      is_rush: isRush,
      notes: fullNotes,
      requested_at: new Date().toISOString(),
  }

  if (initialStatus === 'shipped' || initialStatus === 'delivered') {
    insertRow.shipped_date = tracking.shipped_at ?? new Date().toISOString()
    if (tracking.tracking_number) insertRow.tracking_number = tracking.tracking_number
    if (tracking.carrier) insertRow.carrier = tracking.carrier
  }
  if (initialStatus === 'delivered') {
    insertRow.delivered_date =
      extractDeliveryDate(order as unknown as Record<string, unknown>) ??
      new Date().toISOString()
  }

  const { data: newOrder, error: orderError } = await supabase
    .from('outbound_orders')
    .insert(insertRow)
    .select()
    .single()

  if (orderError) {
    console.error('Failed to create order:', orderError)
    throw new Error(`Failed to create order: ${orderError.message}`)
  }

  await ensureIntegrationWarehouseLocation(supabase, integrationData.id)

  // Create line items (matched + unmatched display rows)
  if (lineItems.length > 0) {
    const { error: itemsError } = await supabase.from('outbound_items').insert(
      lineItems.map((item) => ({
        order_id: newOrder.id,
        product_id: item.product_id,
        qty_requested: item.qty_requested,
        qty_shipped: item.qty_shipped,
        unit_price: item.unit_price,
        external_sku: item.external_sku ?? null,
        external_title: item.external_title ?? null,
        is_unmatched: item.is_unmatched ?? false,
        virtual_qty: item.virtual_qty ?? 0,
      }))
    )

    if (itemsError) {
      console.error('Failed to create order items:', itemsError)
      // Don't throw - order was created, items can be added manually
    } else {
      const matchedCount = lineItems.filter((i) => !i.is_unmatched && i.product_id).length
      const hasShopifyShipped =
        matchedCount > 0 &&
        (order.line_items || []).some(
          (item) => item.requires_shipping && shopifyLineItemQtyShipped(item) > 0
        )
      if (hasShopifyShipped) {
        const payload = order as unknown as Record<string, unknown>
        await deductInventoryFromShopifyFulfillment(
          newOrder.id,
          payload,
          integrationData.id
        )
        await syncShopifyOrderLineItems(newOrder.id, payload, integrationData.id)
      }
    }
  }

  // Update integration last sync time
  await supabase
    .from('client_integrations')
    .update({ last_order_sync_at: new Date().toISOString() })
    .eq('id', integrationData.id)

  console.log(`Created order ${newOrder.order_number} from Shopify ${order.name}`)
  return 'created'
}

/**
 * If an imported 7D order has no matched line items yet, attach newly mapped products
 * from the Shopify payload (replaces unmatched placeholder rows for those SKUs).
 * Used when staff finish product matching after the order already landed in IMS.
 */
export async function attachMappedShopifyLineItemsIfMissing(
  imsOrderId: string,
  shopifyOrder: Record<string, unknown>,
  integrationId: string
): Promise<{ attached: number }> {
  const supabase = createServiceClient()
  const order = shopifyOrder as unknown as ShopifyOrder

  const { data: existingItems } = await supabase
    .from('outbound_items')
    .select('id, is_unmatched, product_id')
    .eq('order_id', imsOrderId)

  const hasMatched = (existingItems || []).some(
    (row) => row.product_id && !row.is_unmatched
  )
  if (hasMatched) {
    return { attached: 0 }
  }

  const { data: mappings } = await supabase
    .from('product_mappings')
    .select('product_id, external_variant_id, external_sku')
    .eq('integration_id', integrationId)

  const mappingsByVariant = new Map(
    (mappings || []).map((m) => [String(m.external_variant_id), m.product_id])
  )
  const mappingsBySku = new Map(
    (mappings || [])
      .filter((m) => m.external_sku)
      .map((m) => [m.external_sku!.toLowerCase(), m.product_id])
  )

  const lineItems: Array<{
    order_id: string
    product_id: string
    qty_requested: number
    qty_shipped: number
    unit_price: number
    is_unmatched: boolean
    virtual_qty: number
  }> = []

  for (const item of order.line_items || []) {
    if (!item.requires_shipping || item.quantity <= 0) continue
    const productId = resolveMappedProductId(item, mappingsByVariant, mappingsBySku)
    if (!productId) continue
    lineItems.push({
      order_id: imsOrderId,
      product_id: productId,
      qty_requested: item.quantity,
      qty_shipped: 0,
      unit_price: parseFloat(item.price) || 0,
      is_unmatched: false,
      virtual_qty: 0,
    })
  }

  if (lineItems.length === 0) return { attached: 0 }

  // Drop unmatched placeholders before inserting real matched lines
  const unmatchedIds = (existingItems || [])
    .filter((row) => row.is_unmatched)
    .map((row) => row.id)
  if (unmatchedIds.length > 0) {
    await supabase.from('outbound_items').delete().in('id', unmatchedIds)
  } else if ((existingItems || []).length > 0) {
    // Had only empty/legacy rows with no product — clear them
    await supabase.from('outbound_items').delete().eq('order_id', imsOrderId)
  }

  const { error } = await supabase.from('outbound_items').insert(lineItems)
  if (error) {
    console.error('Failed to attach mapped Shopify line items:', error)
    return { attached: 0 }
  }

  const { data: current } = await supabase
    .from('outbound_orders')
    .select('notes')
    .eq('id', imsOrderId)
    .single()

  if (current?.notes && /\[needs mapping\]/i.test(current.notes)) {
    const cleaned = String(current.notes)
      .split('\n')
      .filter((line) => {
        const t = line.trim()
        if (!t) return false
        if (/^\[needs mapping\]$/i.test(t)) return false
        if (/item\(s\) could not be mapped/i.test(t)) return false
        if (/item\(s\) not matching IMS/i.test(t)) return false
        return true
      })
      .join('\n')
      .trim()
    await supabase
      .from('outbound_orders')
      .update({ notes: cleaned || null })
      .eq('id', imsOrderId)
  }

  return { attached: lineItems.length }
}
export async function syncShopifyOrders(
  integrationId: string,
  since?: Date,
  triggeredBy: SyncTrigger = 'manual'
): Promise<{ imported: number; updated: number; skipped: number; failed: number }> {
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

  const syncSince =
    since ??
    (integration.last_order_sync_at
      ? new Date(integration.last_order_sync_at)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))

  const client = await createShopifyClientForIntegration(integration)

  let orders: ShopifyOrder[]
  try {
    orders = await fetchOrdersForSync(client, syncSince)
  } catch (e) {
    if (e instanceof ShopifyApiError && e.status === 401) {
      const snippet = e.body.length > 400 ? `${e.body.slice(0, 400)}…` : e.body
      throw new Error(
        `Shopify returned 401 for ${integration.shop_domain}. ${snippet} If the token is invalid, disconnect and reconnect Shopify in Portal. If you recently changed TOKEN_ENCRYPTION_KEY, reconnect so a new token is stored.`,
        { cause: e }
      )
    }
    throw e
  }

  const results = { imported: 0, updated: 0, skipped: 0, failed: 0 }

  for (const order of orders) {
    try {
      const payload = order as unknown as Record<string, unknown>

      const { data: existing } = await supabase
        .from('outbound_orders')
        .select('id')
        .eq('external_order_id', String(order.id))
        .eq('external_platform', 'shopify')
        .single()

      if (existing) {
        const attached = await attachMappedShopifyLineItemsIfMissing(
          existing.id,
          payload,
          integrationId
        )
        const statusResult = await applyShopifyStatusToOrder(existing.id, payload)
        if (statusResult.updated || attached.attached > 0) {
          results.updated++
        } else {
          results.skipped++
        }
        continue
      }

      // Skip fulfilled-with-no-shippable only when there is nothing to import
      const shippable = (order.line_items || []).some(
        (item) => item.requires_shipping && item.quantity > 0
      )
      if (!shippable && order.fulfillment_status === 'fulfilled') {
        results.skipped++
        continue
      }

      if (!shopifyOrderHas7DTag(order.tags)) {
        results.skipped++
        continue
      }

      const outcome = await processShopifyOrder(payload, integration)
      if (outcome === 'created') {
        results.imported++
      } else {
        results.skipped++
      }
    } catch (e) {
      console.error(`Failed to sync order ${order.name}:`, e)
      results.failed++
    }
  }

  // Log sync result
  logSyncResult({
    integrationId,
    syncType: 'orders',
    direction: 'inbound',
    triggeredBy,
    itemsProcessed: results.imported + results.updated,
    itemsFailed: results.failed,
    durationMs: Date.now() - startTime,
    metadata: { skipped: results.skipped, imported: results.imported, updated: results.updated },
  })

  return results
}
