import type { SupabaseClient } from '@supabase/supabase-js'

/** Product id → Shopify listing title from product_mappings. */
export async function fetchShopifyListingTitlesByProductId(
  supabase: SupabaseClient,
  options: {
    integrationId?: string | null
    clientId?: string | null
  }
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  let integrationIds: string[] = []

  if (options.integrationId) {
    integrationIds = [options.integrationId]
  } else if (options.clientId) {
    const { data: integrations } = await supabase
      .from('client_integrations')
      .select('id')
      .eq('client_id', options.clientId)
      .eq('platform', 'shopify')
      .eq('status', 'active')

    integrationIds = (integrations || []).map((row) => row.id as string)
  }

  if (integrationIds.length === 0) {
    return map
  }

  const { data: mappings } = await supabase
    .from('product_mappings')
    .select('product_id, external_title')
    .in('integration_id', integrationIds)

  for (const row of mappings || []) {
    const productId = row.product_id as string | undefined
    const title =
      typeof row.external_title === 'string' ? row.external_title.trim() : ''
    if (productId && title && !map.has(productId)) {
      map.set(productId, title)
    }
  }

  return map
}

export function resolveShopifyListingTitleForOrderItem(
  item: {
    is_unmatched?: boolean | null
    external_title?: string | null
    product_id?: string | null
  },
  listingTitleByProductId: Map<string, string>
): string | null {
  if (item.is_unmatched) {
    const fromLine = item.external_title?.trim()
    return fromLine || null
  }

  if (item.product_id) {
    const mapped = listingTitleByProductId.get(item.product_id)
    if (mapped) return mapped
  }

  const fromLine = item.external_title?.trim()
  return fromLine || null
}
