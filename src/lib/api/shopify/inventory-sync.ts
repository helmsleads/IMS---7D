import { createServiceClient } from '@/lib/supabase-service'
import { createShopifyClient } from './client'
import { decryptToken } from '@/lib/encryption'

interface SyncResult {
  updated: number
  failed: number
  errors: Array<{ productId: string; error: string }>
}

/**
 * Sync inventory levels from IMS to Shopify
 */
export async function syncInventoryToShopify(
  integrationId: string,
  productIds?: string[]
): Promise<SyncResult> {
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

  if (integration.status !== 'active') {
    throw new Error('Integration is not active')
  }

  if (!integration.access_token || !integration.shop_domain) {
    throw new Error('Integration not properly configured')
  }

  // Get Shopify location ID from settings
  const locationId = integration.settings?.shopify_location_id
  if (!locationId) {
    // Try to get the primary location from Shopify
    const client = createShopifyClient({
      shopDomain: integration.shop_domain,
      accessToken: decryptToken(integration.access_token),
    })

    const locationsResponse = await client.get<{ locations: Array<{ id: number; primary: boolean }> }>(
      '/locations.json'
    )

    const primaryLocation = locationsResponse.locations.find((l) => l.primary)
    if (!primaryLocation) {
      throw new Error('No Shopify location found. Please configure a location ID.')
    }

    // Save the location ID for future use
    await supabase
      .from('client_integrations')
      .update({
        settings: {
          ...integration.settings,
          shopify_location_id: String(primaryLocation.id),
        },
      })
      .eq('id', integrationId)

    integration.settings.shopify_location_id = String(primaryLocation.id)
  }

  // Build query for product mappings
  let query = supabase
    .from('product_mappings')
    .select(`
      *,
      product:products(
        id,
        sku,
        name
      )
    `)
    .eq('integration_id', integrationId)
    .eq('sync_inventory', true)

  if (productIds?.length) {
    query = query.in('product_id', productIds)
  }

  const { data: mappings, error: mappingsError } = await query

  if (mappingsError) {
    throw new Error(`Failed to fetch mappings: ${mappingsError.message}`)
  }

  if (!mappings?.length) {
    return { updated: 0, failed: 0, errors: [] }
  }

  const client = createShopifyClient({
    shopDomain: integration.shop_domain,
    accessToken: decryptToken(integration.access_token),
  })

  const results: SyncResult = { updated: 0, failed: 0, errors: [] }
  const inventoryBuffer = integration.settings?.inventory_buffer || 0

  for (const mapping of mappings) {
    if (!mapping.external_inventory_item_id) {
      results.errors.push({
        productId: mapping.product_id,
        error: 'Missing external_inventory_item_id',
      })
      results.failed++
      continue
    }

    try {
      // Get current IMS inventory for this product
      const { data: inventoryData } = await supabase
        .from('inventory')
        .select('qty_on_hand, qty_reserved')
        .eq('product_id', mapping.product_id)

      // Calculate total available across all locations
      const totalOnHand = (inventoryData || []).reduce(
        (sum, inv) => sum + (inv.qty_on_hand || 0),
        0
      )
      const totalReserved = (inventoryData || []).reduce(
        (sum, inv) => sum + (inv.qty_reserved || 0),
        0
      )

      // Apply buffer
      const available = Math.max(0, totalOnHand - totalReserved - inventoryBuffer)

      // Update Shopify inventory
      await client.post('/inventory_levels/set.json', {
        location_id: parseInt(integration.settings.shopify_location_id),
        inventory_item_id: parseInt(mapping.external_inventory_item_id),
        available,
      })

      // Update last synced timestamp
      await supabase
        .from('product_mappings')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', mapping.id)

      results.updated++

      // Rate limit protection - Shopify allows 2 requests/second for inventory
      await sleep(500)
    } catch (error) {
      results.failed++
      results.errors.push({
        productId: mapping.product_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  // Update integration sync timestamp
  await supabase
    .from('client_integrations')
    .update({ last_inventory_sync_at: new Date().toISOString() })
    .eq('id', integrationId)

  return results
}

/**
 * Fetch products from Shopify for mapping
 */
export async function fetchShopifyProducts(
  integrationId: string
): Promise<
  Array<{
    product_id: string
    variant_id: string
    title: string
    variant_title: string
    sku: string
    inventory_item_id: string
    inventory_quantity: number
  }>
> {
  const supabase = createServiceClient()

  // Get integration
  const { data: integration } = await supabase
    .from('client_integrations')
    .select('*')
    .eq('id', integrationId)
    .single()

  if (!integration?.access_token || !integration?.shop_domain) {
    throw new Error('Integration not configured')
  }

  const client = createShopifyClient({
    shopDomain: integration.shop_domain,
    accessToken: decryptToken(integration.access_token),
  })

  // Fetch all products
  const response = await client.get<{
    products: Array<{
      id: number
      title: string
      variants: Array<{
        id: number
        title: string
        sku: string
        inventory_item_id: number
        inventory_quantity: number
      }>
    }>
  }>('/products.json?limit=250')

  const products: Array<{
    product_id: string
    variant_id: string
    title: string
    variant_title: string
    sku: string
    inventory_item_id: string
    inventory_quantity: number
  }> = []

  for (const product of response.products) {
    for (const variant of product.variants) {
      products.push({
        product_id: String(product.id),
        variant_id: String(variant.id),
        title: product.title,
        variant_title: variant.title,
        sku: variant.sku || '',
        inventory_item_id: String(variant.inventory_item_id),
        inventory_quantity: variant.inventory_quantity,
      })
    }
  }

  return products
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
