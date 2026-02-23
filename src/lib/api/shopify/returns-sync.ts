import { createServiceClient } from '@/lib/supabase-service'
import { createShopifyClient } from './client'
import { decryptToken } from '@/lib/encryption'
import { logSyncResult } from './sync-logger'

/**
 * Sync a completed return to Shopify as a refund
 * Called when a return status is set to 'completed'
 */
export async function syncReturnToShopify(returnId: string): Promise<void> {
  const supabase = createServiceClient()

  // Get the return with items and original order reference
  const { data: returnRecord, error: returnError } = await supabase
    .from('returns')
    .select(`
      *,
      items:return_items (
        id,
        product_id,
        qty_received,
        disposition
      )
    `)
    .eq('id', returnId)
    .single()

  if (returnError || !returnRecord) {
    console.log('Return not found:', returnId)
    return
  }

  // Get the linked outbound order
  if (!returnRecord.original_order_id) {
    console.log('Return has no linked order, skipping Shopify sync')
    return
  }

  const { data: outboundOrder } = await supabase
    .from('outbound_orders')
    .select('id, external_order_id, external_platform, integration_id')
    .eq('id', returnRecord.original_order_id)
    .single()

  if (!outboundOrder?.external_order_id || outboundOrder.external_platform !== 'shopify') {
    console.log('Not a Shopify order, skipping return sync')
    return
  }

  if (!outboundOrder.integration_id) {
    console.log('No integration_id on order, skipping return sync')
    return
  }

  // Get integration details
  const { data: integration } = await supabase
    .from('client_integrations')
    .select('*')
    .eq('id', outboundOrder.integration_id)
    .single()

  if (!integration?.access_token || !integration?.shop_domain) {
    console.log('Integration not configured, skipping return sync')
    return
  }

  // Get product mappings to map IMS product_id → Shopify variant_id
  const productIds = returnRecord.items.map((i: { product_id: string }) => i.product_id)
  const { data: mappings } = await supabase
    .from('product_mappings')
    .select('product_id, external_variant_id')
    .eq('integration_id', integration.id)
    .in('product_id', productIds)

  if (!mappings?.length) {
    console.log('No product mappings found for return items')
    return
  }

  const variantMap = new Map(mappings.map((m) => [m.product_id, m.external_variant_id]))

  const client = createShopifyClient({
    shopDomain: integration.shop_domain,
    accessToken: decryptToken(integration.access_token),
  })

  try {
    // Fetch the Shopify order to get line_item IDs by variant_id
    const orderResponse = await client.get<{
      order: {
        id: number
        line_items: Array<{
          id: number
          variant_id: number
          quantity: number
          price: string
        }>
      }
    }>(`/orders/${outboundOrder.external_order_id}.json`)

    const shopifyOrder = orderResponse.order
    const lineItemsByVariant = new Map(
      shopifyOrder.line_items.map((li) => [String(li.variant_id), li])
    )

    // Build refund line items
    const refundLineItems: Array<{
      line_item_id: number
      quantity: number
      restock_type: string
    }> = []

    for (const item of returnRecord.items) {
      const variantId = variantMap.get(item.product_id)
      if (!variantId) continue

      const shopifyLineItem = lineItemsByVariant.get(variantId)
      if (!shopifyLineItem) continue

      if (item.qty_received <= 0) continue

      refundLineItems.push({
        line_item_id: shopifyLineItem.id,
        quantity: item.qty_received,
        restock_type: item.disposition === 'restock' ? 'return' : 'no_restock',
      })
    }

    if (refundLineItems.length === 0) {
      console.log('No refundable items found for return')
      return
    }

    // Calculate refund
    const calculateResponse = await client.post<{
      refund: {
        shipping: { amount: string }
        refund_line_items: Array<{
          line_item_id: number
          quantity: number
          subtotal: number
          total_tax: number
        }>
        transactions: Array<{
          gateway: string
          amount: string
        }>
      }
    }>(`/orders/${outboundOrder.external_order_id}/refunds/calculate.json`, {
      refund: {
        refund_line_items: refundLineItems.map((li) => ({
          line_item_id: li.line_item_id,
          quantity: li.quantity,
        })),
      },
    })

    // Create the refund
    const calculatedRefund = calculateResponse.refund
    await client.post(`/orders/${outboundOrder.external_order_id}/refunds.json`, {
      refund: {
        notify: true,
        refund_line_items: refundLineItems,
        transactions: calculatedRefund.transactions,
      },
    })

    console.log(`Synced return ${returnId} as refund to Shopify order ${outboundOrder.external_order_id}`)

    // Log success
    logSyncResult({
      integrationId: integration.id,
      syncType: 'return',
      direction: 'outbound',
      triggeredBy: 'event',
      itemsProcessed: refundLineItems.length,
      itemsFailed: 0,
      metadata: { returnId, shopifyOrderId: outboundOrder.external_order_id },
    })
  } catch (error) {
    console.error('Failed to sync return to Shopify:', error)

    // Log error to integration
    await supabase
      .from('client_integrations')
      .update({
        last_error_at: new Date().toISOString(),
        last_error_message: error instanceof Error ? error.message : 'Return sync failed',
      })
      .eq('id', integration.id)

    // Log failure
    logSyncResult({
      integrationId: integration.id,
      syncType: 'return',
      direction: 'outbound',
      triggeredBy: 'event',
      itemsProcessed: 0,
      itemsFailed: 1,
      errorDetails: [{ error: error instanceof Error ? error.message : 'Return sync failed' }],
      metadata: { returnId },
    })

    throw error
  }
}
