import { createServiceClient } from '@/lib/supabase-service'
import { shopifyLineItemQtyShipped } from './order-status-sync'
import {
  normalizeShopifyOrderPayload,
  resolveWarehouseLocationForIntegration,
} from './shopify-order-payload'
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

async function shipQtyAlreadyRecorded(
  supabase: ReturnType<typeof createServiceClient>,
  imsOrderId: string,
  productId: string,
  targetQty: number
): Promise<number> {
  const { data: txs } = await supabase
    .from('inventory_transactions')
    .select('qty_change')
    .eq('reference_type', 'outbound_order')
    .eq('reference_id', imsOrderId)
    .eq('product_id', productId)
    .eq('transaction_type', 'ship')

  if (!txs?.length) return 0

  const deducted = txs.reduce(
    (sum, tx) => sum + Math.abs(Number(tx.qty_change) || 0),
    0
  )
  return Math.max(0, targetQty - deducted)
}

/**
 * Deduct 7D warehouse inventory when Shopify reports fulfilled quantities.
 * Idempotent via qty_shipped delta and existing ship transactions.
 */
export async function deductInventoryFromShopifyFulfillment(
  imsOrderId: string,
  shopifyOrder: Record<string, unknown>,
  integrationId: string
): Promise<{ deducted: boolean; linesProcessed: number }> {
  const supabase = createServiceClient()
  const normalized = normalizeShopifyOrderPayload(shopifyOrder)
  const order = normalized as unknown as ShopifyOrder
  const lineItems = order.line_items ?? []

  if (!lineItems.length) {
    return { deducted: false, linesProcessed: 0 }
  }

  const locationId = await resolveWarehouseLocationForIntegration(
    supabase,
    integrationId
  )

  if (!locationId) {
    console.warn(
      `deductInventoryFromShopifyFulfillment: no 7D warehouse location for integration ${integrationId}`
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
    if (targetQty <= 0) continue

    let qtyToDeduct = shopifyInventoryQtyToDeduct(
      targetQty,
      outboundItem.qty_shipped ?? 0
    )

    // Recover if line qty was synced without a prior ship transaction
    if (qtyToDeduct <= 0) {
      qtyToDeduct = await shipQtyAlreadyRecorded(
        supabase,
        imsOrderId,
        productId,
        targetQty
      )
    }

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
        const { error: txError } = await supabase.rpc(
          'update_inventory_with_transaction',
          {
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
          }
        )

        if (txError) {
          console.error(
            `Shopify inventory deduct failed for order ${imsOrderId} product ${productId}:`,
            txError.message
          )
          continue
        }
      }

      const { error: itemUpdateError } = await supabase
        .from('outbound_items')
        .update({ qty_shipped: targetQty })
        .eq('id', outboundItem.id)

      if (itemUpdateError) {
        console.error(
          `Shopify qty_shipped update failed for item ${outboundItem.id}:`,
          itemUpdateError.message
        )
      } else {
        outboundItem.qty_shipped = targetQty
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
          qty_shipped: targetQty,
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
