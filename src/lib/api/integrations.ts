import { createClient } from '@/lib/supabase'
import type { ClientIntegration } from '@/types/database'

/**
 * Ensures the integration row exists and belongs to the given client (portal / tenant scope).
 */
export async function assertIntegrationOwnedByClient(
  integrationId: string,
  clientId: string
): Promise<void> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('client_integrations')
    .select('id')
    .eq('id', integrationId)
    .eq('client_id', clientId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  if (!data) {
    throw new Error('Integration not found or access denied')
  }
}

/**
 * Get all integrations for a client
 */
export async function getClientIntegrations(clientId: string): Promise<ClientIntegration[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('client_integrations')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching integrations:', error.message || error)
    // Return empty array if table doesn't exist or other DB errors
    return []
  }

  // Ensure new columns have defaults for backwards compatibility
  return (data || []).map(integration => ({
    ...integration,
    shopify_location_id: integration.shopify_location_id ?? null,
    shopify_location_name: integration.shopify_location_name ?? '7 Degrees Co',
    location_created_by_us: integration.location_created_by_us ?? false,
  }))
}

/**
 * Get a specific integration by ID (scoped to client)
 */
export async function getIntegration(
  integrationId: string,
  clientId: string
): Promise<ClientIntegration | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('client_integrations')
    .select('*')
    .eq('id', integrationId)
    .eq('client_id', clientId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error fetching integration:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Get Shopify integration for a client
 */
export async function getClientShopifyIntegration(clientId: string): Promise<ClientIntegration | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('client_integrations')
    .select('*')
    .eq('client_id', clientId)
    .eq('platform', 'shopify')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error fetching Shopify integration:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Update integration settings
 */
export async function updateIntegrationSettings(
  integrationId: string,
  settings: Partial<ClientIntegration['settings']>,
  clientId: string
): Promise<ClientIntegration> {
  const supabase = createClient()

  const { data: current, error: fetchError } = await supabase
    .from('client_integrations')
    .select('settings')
    .eq('id', integrationId)
    .eq('client_id', clientId)
    .single()

  if (fetchError || !current) {
    throw new Error(fetchError?.message || 'Integration not found or access denied')
  }

  const { data, error } = await supabase
    .from('client_integrations')
    .update({
      settings: { ...current.settings, ...settings },
      updated_at: new Date().toISOString(),
    })
    .eq('id', integrationId)
    .eq('client_id', clientId)
    .select()
    .single()

  if (error) {
    console.error('Error updating integration settings:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Disconnect an integration (scoped to client)
 */
export async function disconnectIntegration(integrationId: string, clientId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('client_integrations')
    .update({
      status: 'disconnected',
      access_token: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', integrationId)
    .eq('client_id', clientId)

  if (error) {
    console.error('Error disconnecting integration:', error)
    throw new Error(error.message)
  }
}

/**
 * Auto-map products by SKU
 */
export async function autoMapProductsBySku(
  integrationId: string,
  clientId: string,
  shopifyProducts: Array<{ variant_id: string; sku: string; product_id: string; title: string; inventory_item_id: string }>
): Promise<{ mapped: number; skipped: number }> {
  await assertIntegrationOwnedByClient(integrationId, clientId)

  const supabase = createClient()

  // Get existing mappings
  const { data: existingMappings } = await supabase
    .from('product_mappings')
    .select('external_variant_id')
    .eq('integration_id', integrationId)

  const mappedVariants = new Set(existingMappings?.map((m) => m.external_variant_id) || [])

  // Get client's products
  const { data: products } = await supabase
    .from('products')
    .select('id, sku')
    .eq('client_id', clientId)
    .eq('active', true)

  const productsBySku = new Map(products?.map((p) => [p.sku?.toLowerCase(), p]) || [])

  let mapped = 0
  let skipped = 0

  for (const shopifyProduct of shopifyProducts) {
    // Skip if already mapped
    if (mappedVariants.has(shopifyProduct.variant_id)) {
      skipped++
      continue
    }

    // Find matching IMS product by SKU
    const imsProduct = productsBySku.get(shopifyProduct.sku?.toLowerCase())
    if (!imsProduct) {
      skipped++
      continue
    }

    // Create mapping
    const { error } = await supabase.from('product_mappings').insert({
      integration_id: integrationId,
      product_id: imsProduct.id,
      external_product_id: shopifyProduct.product_id,
      external_variant_id: shopifyProduct.variant_id,
      external_sku: shopifyProduct.sku,
      external_inventory_item_id: shopifyProduct.inventory_item_id,
      external_title: shopifyProduct.title,
      sync_inventory: true,
    })

    if (error) {
      console.error('Error creating mapping:', error)
      skipped++
    } else {
      mapped++
    }
  }

  return { mapped, skipped }
}
