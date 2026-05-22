import { createServiceClient } from '@/lib/supabase-service'
import { shopifyLineItemQtyShipped } from './order-status-sync'
import type { ShopifyLineItem, ShopifyOrder } from '@/types/database'

/** Additional units to deduct in 7D based on Shopify fulfilled qty vs current qty_shipped. */
export function shopifyInventoryQtyToDeduct(
  shopifyShippedQty: number,
  currentQtyShippedIn7d: number
): number {
  return Math.max(0, shopifyShippedQty - currentQtyShippedIn7d)
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
 * Deduct 7D warehouse inventory when Shopify reports fulfilled quantities.
 * Uses integration settings.default_location_id. Idempotent: only deducts the
 * delta between Shopify shipped qty and outbound_items.qty_shipped.
 */
export async function deductInventoryFromShopifyFulfillment(
  imsOrderId: string,
  shopifyOrder: Record<string, unknown>,
  integrationId: string
): Promise<{ deducted: boolean; linesProcessed: number }> {
  const supabase = createServiceClient()
  const order = shopifyOrder as unknown as ShopifyOrder
  const lineItems = order.line_items ?? []

  if (!lineItems.length) {
    return { deducted: false, linesProcessed: 0 }
  }

  const { data: integration, error: intError } = await supabase
    .from('client_integrations')
    .select('settings')
    .eq('id', integrationId)
    .single()

  if (intError || !integration) {
    console.warn(`deductInventoryFromShopifyFulfillment: integration ${integrationId} not found`)
    return { deducted: false, linesProcessed: 0 }
  }

  const locationId = (integration.settings as { default_location_id?: string | null })
    ?.default_location_id

  if (!locationId) {
    console.warn(
      `deductInventoryFromShopifyFulfillment: no default_location_id on integration ${integrationId}, skipping inventory deduct`
    )
    return { deducted: false, linesProcessed: 0 }
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

  const { data: outboundItems } = await supabase
    .from('outbound_items')
    .select('id, product_id, qty_shipped')
    .eq('order_id', imsOrderId)

  if (!outboundItems?.length) {
    return { deducted: false, linesProcessed: 0 }
  }

  const itemsByProduct = new Map(outboundItems.map((i) => [i.product_id, i]))
  let deducted = false
  let linesProcessed = 0
  const productIdsToSync: string[] = []

  for (const line of lineItems) {
    if (!line.requires_shipping) continue

    const productId = resolveMappedProductId(line, mappingsByVariant, mappingsBySku)
    if (!productId) continue

    const outboundItem = itemsByProduct.get(productId)
    if (!outboundItem) continue

    const targetQty = shopifyLineItemQtyShipped(line)
    const qtyToDeduct = shopifyInventoryQtyToDeduct(
      targetQty,
      outboundItem.qty_shipped ?? 0
    )

    if (qtyToDeduct <= 0) continue

    try {
      const { error: releaseError } = await supabase.rpc('release_reservation', {
        p_product_id: productId,
        p_location_id: locationId,
        p_qty_to_release: qtyToDeduct,
        p_also_deduct: true,
        p_reference_type: 'outbound_order',
        p_reference_id: imsOrderId,
        p_performed_by: null,
      })

      if (releaseError) {
        const { error: txError } = await supabase.rpc('update_inventory_with_transaction', {
          p_product_id: productId,
          p_location_id: locationId,
          p_qty_change: -qtyToDeduct,
          p_transaction_type: 'ship',
          p_reference_type: 'outbound_order',
          p_reference_id: imsOrderId,
          p_lot_id: null,
          p_sublocation_id: null,
          p_reason: 'Shopify fulfillment sync',
          p_notes: null,
          p_performed_by: null,
          p_fill_status: 'full',
        })

        if (txError) {
          console.error(
            `Shopify inventory deduct failed for order ${imsOrderId} product ${productId}:`,
            txError.message
          )
          continue
        }
      }

      deducted = true
      linesProcessed += 1
      productIdsToSync.push(productId)

      await supabase.from('activity_log').insert({
        entity_type: 'outbound_item',
        entity_id: outboundItem.id,
        action: 'shipped',
        user_id: null,
        details: {
          source: 'shopify_fulfillment_sync',
          product_id: productId,
          qty_deducted: qtyToDeduct,
          location_id: locationId,
          order_id: imsOrderId,
        },
      })
    } catch (err) {
      console.error(
        `Shopify inventory deduct error for order ${imsOrderId} product ${productId}:`,
        err
      )
    }
  }

  if (productIdsToSync.length > 0) {
    import('./event-sync')
      .then((mod) => mod.triggerImmediateInventorySync([...new Set(productIdsToSync)]))
      .catch((err) => console.error('Failed to trigger Shopify inventory sync:', err))
  }

  return { deducted, linesProcessed }
}
