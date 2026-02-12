import { createServiceClient } from '@/lib/supabase-service'
import { createShopifyClient } from './client'
import { decryptToken } from '@/lib/encryption'

/**
 * Sync fulfillment/tracking info from IMS to Shopify
 * Called when an order is marked as shipped
 */
export async function syncFulfillmentToShopify(
  orderId: string,
  trackingNumber: string,
  carrier: string,
  trackingUrl?: string,
  items?: Array<{ product_id: string; qty: number }>
): Promise<void> {
  const supabase = createServiceClient()

  // Get order with integration details
  const { data: order, error } = await supabase
    .from('outbound_orders')
    .select(`
      *,
      integration:client_integrations(*)
    `)
    .eq('id', orderId)
    .single()

  if (error || !order) {
    console.log('Order not found:', orderId)
    return
  }

  // Check if this is a Shopify order
  if (!order.external_order_id || order.external_platform !== 'shopify') {
    console.log('Order is not from Shopify, skipping fulfillment sync')
    return
  }

  const integration = order.integration
  if (!integration || !integration.access_token || !integration.shop_domain) {
    console.log('Integration not found or not configured')
    return
  }

  const client = createShopifyClient({
    shopDomain: integration.shop_domain,
    accessToken: decryptToken(integration.access_token),
  })

  try {
    // Get fulfillment orders from Shopify
    const fulfillmentOrdersResponse = await client.get<{ fulfillment_orders: FulfillmentOrder[] }>(
      `/orders/${order.external_order_id}/fulfillment_orders.json`
    )

    const openFulfillmentOrder = fulfillmentOrdersResponse.fulfillment_orders.find(
      (fo) => fo.status === 'open' || fo.status === 'in_progress'
    )

    if (!openFulfillmentOrder) {
      console.log('No open fulfillment order found in Shopify')
      return
    }

    // Build fulfillment order line items (partial or full)
    let fulfillmentOrderEntry: Record<string, unknown> = {
      fulfillment_order_id: openFulfillmentOrder.id,
    }

    if (items?.length) {
      // Partial fulfillment — map IMS product_ids to Shopify line_item IDs
      const { data: mappings } = await supabase
        .from('product_mappings')
        .select('product_id, external_variant_id')
        .eq('integration_id', integration.id)
        .in('product_id', items.map((i) => i.product_id))

      if (mappings?.length) {
        const variantMap = new Map(mappings.map((m) => [m.product_id, m.external_variant_id]))
        const fulfillmentLineItems: Array<{ id: number; quantity: number }> = []

        for (const item of items) {
          const variantId = variantMap.get(item.product_id)
          if (!variantId) continue

          // Find the matching line item in the fulfillment order
          const lineItem = openFulfillmentOrder.line_items.find(
            (li) => String(li.variant_id) === variantId
          )
          if (lineItem) {
            fulfillmentLineItems.push({
              id: lineItem.id,
              quantity: Math.min(item.qty, lineItem.fulfillable_quantity),
            })
          }
        }

        if (fulfillmentLineItems.length > 0) {
          fulfillmentOrderEntry.fulfillment_order_line_items = fulfillmentLineItems
        }
      }
    }

    // Create fulfillment
    await client.post('/fulfillments.json', {
      fulfillment: {
        line_items_by_fulfillment_order: [fulfillmentOrderEntry],
        tracking_info: {
          number: trackingNumber,
          company: mapCarrierToShopify(carrier),
          url: trackingUrl,
        },
        notify_customer: integration.settings?.fulfillment_notify_customer ?? true,
      },
    })

    console.log(`Synced fulfillment to Shopify for order ${order.order_number}`)

    // Update integration last sync time
    await supabase
      .from('client_integrations')
      .update({ last_order_sync_at: new Date().toISOString() })
      .eq('id', integration.id)
  } catch (error) {
    console.error('Failed to sync fulfillment to Shopify:', error)

    // Log error to integration
    await supabase
      .from('client_integrations')
      .update({
        last_error_at: new Date().toISOString(),
        last_error_message: error instanceof Error ? error.message : 'Fulfillment sync failed',
      })
      .eq('id', integration.id)

    throw error
  }
}

interface FulfillmentOrder {
  id: number
  status: string
  line_items: Array<{
    id: number
    variant_id: number
    quantity: number
    fulfillable_quantity: number
  }>
}

function mapCarrierToShopify(carrier: string): string {
  const carrierMap: Record<string, string> = {
    ups: 'UPS',
    UPS: 'UPS',
    usps: 'USPS',
    USPS: 'USPS',
    fedex: 'FedEx',
    FedEx: 'FedEx',
    FEDEX: 'FedEx',
    dhl: 'DHL Express',
    DHL: 'DHL Express',
    'DHL Express': 'DHL Express',
    ontrac: 'OnTrac',
    OnTrac: 'OnTrac',
    lasership: 'LaserShip',
    LaserShip: 'LaserShip',
  }

  return carrierMap[carrier] || carrier
}
