import { createServiceClient } from '@/lib/supabase-service'
import { createShopifyClient } from './client'
import { decryptToken } from '@/lib/encryption'

/**
 * Calculate incoming inventory from open inbound orders
 * and update product_mappings.incoming_qty
 */
export async function calculateIncomingInventory(
  integrationId: string
): Promise<{ updated: number }> {
  const supabase = createServiceClient()

  // Get product mappings with sync_inventory enabled
  const { data: mappings, error: mappingsError } = await supabase
    .from('product_mappings')
    .select('id, product_id')
    .eq('integration_id', integrationId)
    .eq('sync_inventory', true)

  if (mappingsError || !mappings?.length) {
    return { updated: 0 }
  }

  const productIds = mappings.map((m) => m.product_id)

  // Query inbound_items for open inbound orders (ordered, in_transit, arrived)
  const { data: inboundItems, error: inboundError } = await supabase
    .from('inbound_items')
    .select(`
      product_id,
      qty_expected,
      qty_received,
      order:inbound_orders!inner (
        id,
        status
      )
    `)
    .in('product_id', productIds)
    .in('order.status', ['ordered', 'in_transit', 'arrived'])

  if (inboundError) {
    console.error('Failed to fetch inbound items:', inboundError)
    return { updated: 0 }
  }

  // Calculate remaining incoming per product
  const incomingByProduct = new Map<string, number>()
  for (const item of inboundItems || []) {
    const remaining = Math.max(0, (item.qty_expected || 0) - (item.qty_received || 0))
    if (remaining > 0) {
      const current = incomingByProduct.get(item.product_id) || 0
      incomingByProduct.set(item.product_id, current + remaining)
    }
  }

  // Update product_mappings with incoming_qty
  let updated = 0
  for (const mapping of mappings) {
    const incomingQty = incomingByProduct.get(mapping.product_id) || 0

    const { error: updateError } = await supabase
      .from('product_mappings')
      .update({ incoming_qty: incomingQty })
      .eq('id', mapping.id)

    if (!updateError) {
      updated++
    }
  }

  return { updated }
}

/**
 * Sync incoming inventory quantities to Shopify as product metafields
 */
export async function syncIncomingToShopify(
  integrationId: string
): Promise<{ updated: number; failed: number }> {
  const supabase = createServiceClient()

  // Get integration
  const { data: integration, error: integrationError } = await supabase
    .from('client_integrations')
    .select('*')
    .eq('id', integrationId)
    .single()

  if (integrationError || !integration) {
    throw new Error('Integration not found')
  }

  if (!integration.access_token || !integration.shop_domain) {
    throw new Error('Integration not configured')
  }

  // Get mappings with incoming_qty > 0
  const { data: mappings } = await supabase
    .from('product_mappings')
    .select('id, product_id, external_product_id, incoming_qty')
    .eq('integration_id', integrationId)
    .gt('incoming_qty', 0)

  if (!mappings?.length) {
    return { updated: 0, failed: 0 }
  }

  const client = createShopifyClient({
    shopDomain: integration.shop_domain,
    accessToken: decryptToken(integration.access_token),
  })

  let updated = 0
  let failed = 0

  for (const mapping of mappings) {
    try {
      // Set product metafield for incoming quantity
      await client.post(
        `/products/${mapping.external_product_id}/metafields.json`,
        {
          metafield: {
            namespace: 'ims_7d',
            key: 'incoming_qty',
            value: String(mapping.incoming_qty),
            type: 'number_integer',
          },
        }
      )

      updated++

      // Rate limit protection
      await sleep(500)
    } catch (error) {
      console.error(
        `Failed to sync incoming qty for product ${mapping.external_product_id}:`,
        error
      )
      failed++
    }
  }

  return { updated, failed }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
