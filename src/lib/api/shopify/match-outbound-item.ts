import { createServiceClient } from '@/lib/supabase-service'
import { createShopifyClientForIntegration } from '@/lib/api/shopify/tokens'
import { fetchProductsForIntegrationMapping } from '@/lib/api/shopify/graphql/products-mapping'
import { hasUsableShopifySku } from '@/lib/api/product-mappings'
import type { ClientIntegration } from '@/types/database'

type ShopifyLineItem = {
  variant_id?: number | string
  sku?: string | null
  name?: string | null
  title?: string | null
}

async function resolveShopifyVariantForLine(
  integration: ClientIntegration,
  externalSku: string | null | undefined,
  externalTitle: string | null | undefined,
  externalOrderId: string | null | undefined
): Promise<{
  productId: string | null
  variantId: string | null
  inventoryItemId: string | null
  title: string | null
  sku: string | null
  imageUrl: string | null
}> {
  const client = await createShopifyClientForIntegration(integration)
  const catalog = await fetchProductsForIntegrationMapping(client)

  const skuNorm = externalSku?.trim().toLowerCase()
  if (skuNorm && hasUsableShopifySku(externalSku)) {
    const bySku = catalog.find(
      (row) => row.sku && row.sku.toLowerCase() === skuNorm
    )
    if (bySku) {
      return {
        productId: bySku.productId,
        variantId: bySku.variantId,
        inventoryItemId: bySku.inventoryItemId,
        title:
          bySku.title +
          (bySku.variantTitle ? ` - ${bySku.variantTitle}` : ''),
        sku: bySku.sku,
        imageUrl: bySku.imageUrl,
      }
    }
  }

  if (externalOrderId) {
    const { order } = await client.get<{ order: { line_items?: ShopifyLineItem[] } }>(
      `/orders/${externalOrderId}.json`
    )
    const titleNorm = externalTitle?.trim().toLowerCase()
    const line = (order?.line_items || []).find((li) => {
      if (skuNorm && hasUsableShopifySku(externalSku)) {
        return String(li.sku || '').toLowerCase() === skuNorm
      }
      const lineTitle = String(li.name || li.title || '').toLowerCase()
      return titleNorm ? lineTitle === titleNorm : false
    })

    if (line?.variant_id) {
      const variantId = String(line.variant_id)
      const fromCatalog = catalog.find((row) => row.variantId === variantId)
      if (fromCatalog) {
        return {
          productId: fromCatalog.productId,
          variantId: fromCatalog.variantId,
          inventoryItemId: fromCatalog.inventoryItemId,
          title:
            fromCatalog.title +
            (fromCatalog.variantTitle ? ` - ${fromCatalog.variantTitle}` : ''),
          sku: fromCatalog.sku,
          imageUrl: fromCatalog.imageUrl,
        }
      }
      return {
        productId: null,
        variantId,
        inventoryItemId: null,
        title: externalTitle || null,
        sku: externalSku || null,
        imageUrl: null,
      }
    }
  }

  return {
    productId: null,
    variantId: null,
    inventoryItemId: null,
    title: externalTitle || null,
    sku: externalSku || null,
    imageUrl: null,
  }
}

async function upsertProductMapping(
  integrationId: string,
  imsProductId: string,
  shopify: {
    productId: string | null
    variantId: string | null
    inventoryItemId: string | null
    title: string | null
    sku: string | null
    imageUrl: string | null
  }
): Promise<void> {
  const supabase = createServiceClient()
  const usableSku = hasUsableShopifySku(shopify.sku)

  if (!usableSku && !shopify.variantId) {
    throw new Error(
      'Cannot create mapping without a Shopify SKU or variant. Add a SKU in Shopify or map from Integrations → Products.'
    )
  }

  let existingQuery = supabase
    .from('product_mappings')
    .select('id')
    .eq('integration_id', integrationId)

  if (shopify.variantId) {
    existingQuery = existingQuery.eq('external_variant_id', shopify.variantId)
  } else if (usableSku) {
    existingQuery = existingQuery.eq('external_sku', String(shopify.sku).trim())
  }

  const { data: existing } = await existingQuery.maybeSingle()

  const payload = {
    integration_id: integrationId,
    product_id: imsProductId,
    external_product_id: shopify.productId,
    external_variant_id: shopify.variantId,
    external_inventory_item_id: shopify.inventoryItemId,
    external_sku: usableSku ? String(shopify.sku).trim() : null,
    external_title: shopify.title,
    external_image_url: shopify.imageUrl,
    sync_inventory: usableSku,
  }

  if (existing?.id) {
    const { error } = await supabase
      .from('product_mappings')
      .update({
        product_id: imsProductId,
        external_product_id: payload.external_product_id,
        external_inventory_item_id: payload.external_inventory_item_id,
        external_sku: payload.external_sku,
        external_title: payload.external_title,
        external_image_url: payload.external_image_url,
        sync_inventory: payload.sync_inventory,
      })
      .eq('id', existing.id)
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await supabase.from('product_mappings').insert(payload)
  if (error) throw new Error(error.message)
}

async function cleanupNeedsMappingNotes(orderId: string): Promise<void> {
  const supabase = createServiceClient()

  const { data: remaining } = await supabase
    .from('outbound_items')
    .select('id')
    .eq('order_id', orderId)
    .eq('is_unmatched', true)
    .limit(1)

  if (remaining?.length) return

  const { data: order } = await supabase
    .from('outbound_orders')
    .select('notes')
    .eq('id', orderId)
    .single()

  if (!order?.notes || !/\[needs mapping\]/i.test(order.notes)) return

  const cleaned = String(order.notes)
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
    .eq('id', orderId)
}

/**
 * Match an unmatched Shopify outbound line to an IMS product.
 * Creates/updates the Shopify product mapping and converts the line to a real fulfillable row.
 */
export async function matchUnmatchedOutboundItem(params: {
  orderId: string
  itemId: string
  imsProductId: string
}): Promise<{ matched: true; product_id: string; qty_requested: number }> {
  const supabase = createServiceClient()
  const { orderId, itemId, imsProductId } = params

  const { data: item, error: itemError } = await supabase
    .from('outbound_items')
    .select(
      `
      id,
      order_id,
      is_unmatched,
      virtual_qty,
      qty_requested,
      qty_shipped,
      external_sku,
      external_title,
      unit_price,
      order:outbound_orders (
        id,
        client_id,
        integration_id,
        external_platform,
        external_order_id,
        status,
        notes
      )
    `
    )
    .eq('id', itemId)
    .eq('order_id', orderId)
    .single()

  if (itemError || !item) {
    throw new Error('Order line not found')
  }

  if (!item.is_unmatched) {
    throw new Error('This line is already matched to an IMS product')
  }

  const order = Array.isArray(item.order) ? item.order[0] : item.order
  if (!order) {
    throw new Error('Order not found')
  }

  if (order.external_platform !== 'shopify' || !order.integration_id) {
    throw new Error('Product matching is only available for Shopify orders')
  }

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, client_id')
    .eq('id', imsProductId)
    .eq('client_id', order.client_id)
    .single()

  if (productError || !product) {
    throw new Error('Product not found for this brand')
  }

  const { data: integration, error: integrationError } = await supabase
    .from('client_integrations')
    .select('*')
    .eq('id', order.integration_id)
    .single()

  if (integrationError || !integration) {
    throw new Error('Shopify integration not found')
  }

  const shopifyVariant = await resolveShopifyVariantForLine(
    integration as ClientIntegration,
    item.external_sku,
    item.external_title,
    order.external_order_id
  )

  await upsertProductMapping(order.integration_id, imsProductId, shopifyVariant)

  const qtyRequested = Math.max(
    0,
    Number(item.virtual_qty) || Number(item.qty_requested) || 0
  )
  const alreadyShipped = order.status === 'shipped' || order.status === 'delivered'
  const qtyShipped = alreadyShipped
    ? qtyRequested
    : Math.max(0, Number(item.qty_shipped) || 0)

  const { error: updateError } = await supabase
    .from('outbound_items')
    .update({
      product_id: imsProductId,
      qty_requested: qtyRequested,
      qty_shipped: qtyShipped,
      is_unmatched: false,
      virtual_qty: 0,
      external_sku: null,
      external_title: null,
    })
    .eq('id', itemId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  await cleanupNeedsMappingNotes(orderId)

  return { matched: true, product_id: imsProductId, qty_requested: qtyRequested }
}
