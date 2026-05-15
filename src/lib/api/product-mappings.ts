import { createClient } from '@/lib/supabase'
import { assertIntegrationOwnedByClient } from '@/lib/api/integrations'

export interface ProductMapping {
  id: string
  integration_id: string
  product_id: string
  external_product_id: string | null
  external_variant_id: string | null
  external_sku: string | null
  external_barcode: string | null
  external_title: string | null
  external_image_url: string | null
  sync_inventory: boolean
  sync_price: boolean
  last_synced_at: string | null
  created_at: string
  // Expanded
  product?: {
    id: string
    sku: string
    name: string
  }
}

export async function getProductMappings(
  integrationId: string,
  clientId: string
): Promise<ProductMapping[]> {
  await assertIntegrationOwnedByClient(integrationId, clientId)

  const supabase = createClient()

  const { data, error } = await supabase
    .from('product_mappings')
    .select('*, product:products(id, sku, name)')
    .eq('integration_id', integrationId)
    .order('external_title')

  if (error) throw new Error(error.message)
  return data || []
}

export async function createProductMapping(
  mapping: {
    integration_id: string
    product_id: string
    external_product_id?: string
    external_variant_id?: string
    external_inventory_item_id?: string
    external_sku?: string
    external_title?: string
    external_image_url?: string
    sync_inventory?: boolean
  },
  clientId: string
): Promise<ProductMapping> {
  await assertIntegrationOwnedByClient(mapping.integration_id, clientId)

  const supabase = createClient()

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id')
    .eq('id', mapping.product_id)
    .eq('client_id', clientId)
    .single()

  if (productError || !product) {
    throw new Error('Product not found or access denied')
  }

  const { data, error } = await supabase
    .from('product_mappings')
    .insert({
      integration_id: mapping.integration_id,
      product_id: mapping.product_id,
      external_product_id: mapping.external_product_id || null,
      external_variant_id: mapping.external_variant_id || null,
      external_inventory_item_id: mapping.external_inventory_item_id || null,
      external_sku: mapping.external_sku || null,
      external_title: mapping.external_title || null,
      external_image_url: mapping.external_image_url || null,
      sync_inventory: mapping.sync_inventory ?? true,
    })
    .select('*, product:products(id, sku, name)')
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updateProductMapping(
  id: string,
  updates: Partial<{
    product_id: string
    sync_inventory: boolean
    sync_price: boolean
  }>,
  clientId: string
): Promise<ProductMapping> {
  const supabase = createClient()

  const { data: mappingRow, error: fetchErr } = await supabase
    .from('product_mappings')
    .select('integration_id')
    .eq('id', id)
    .single()

  if (fetchErr?.code === 'PGRST116' || !mappingRow) {
    throw new Error('Mapping not found')
  }

  await assertIntegrationOwnedByClient(mappingRow.integration_id, clientId)

  if (updates.product_id) {
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('id', updates.product_id)
      .eq('client_id', clientId)
      .single()

    if (productError || !product) {
      throw new Error('Product not found or access denied')
    }
  }

  const { data, error } = await supabase
    .from('product_mappings')
    .update(updates)
    .eq('id', id)
    .select('*, product:products(id, sku, name)')
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteProductMapping(id: string, clientId: string): Promise<void> {
  const supabase = createClient()

  const { data: mappingRow, error: fetchErr } = await supabase
    .from('product_mappings')
    .select('integration_id')
    .eq('id', id)
    .single()

  if (fetchErr?.code === 'PGRST116' || !mappingRow) {
    throw new Error('Mapping not found')
  }

  await assertIntegrationOwnedByClient(mappingRow.integration_id, clientId)

  const { error } = await supabase
    .from('product_mappings')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}
