import type { SupabaseClient } from '@supabase/supabase-js'
import type { IntegrationSettings } from '@/types/database'

/** Coerce REST webhook / GraphQL-mapped order payloads for sync logic. */
export function normalizeShopifyOrderPayload(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const rawItems = payload.line_items
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return payload
  }

  const fulfillmentStatus = String(payload.fulfillment_status ?? '')
    .toLowerCase()
    .replace(/-/g, '_')

  const treatAsFullyFulfilled =
    fulfillmentStatus === 'fulfilled' ||
    fulfillmentStatus === 'partial' ||
    fulfillmentStatus === 'partially_fulfilled'

  const line_items = rawItems.map((raw) => {
    const li = raw as Record<string, unknown>
    const quantity = Number(li.quantity ?? 0)
    let fulfillableQuantity = li.fulfillable_quantity

    if (fulfillableQuantity === undefined || fulfillableQuantity === null) {
      // REST webhooks often omit this; when fulfilled, remaining fulfillable is 0
      fulfillableQuantity = treatAsFullyFulfilled ? 0 : quantity
    }

    return {
      ...li,
      id: Number(li.id ?? 0),
      product_id: Number(li.product_id ?? 0),
      variant_id: Number(li.variant_id ?? 0),
      sku: String(li.sku ?? ''),
      name: String(li.name ?? li.title ?? ''),
      quantity,
      price: String(li.price ?? '0'),
      fulfillable_quantity: Number(fulfillableQuantity),
      requires_shipping: li.requires_shipping !== false && li.requires_shipping !== 'false',
    }
  })

  return { ...payload, line_items }
}

/** First active pickable 7D warehouse location (single-site default). */
export async function resolveDefaultImsLocationId(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data, error } = await supabase
    .from('locations')
    .select('id')
    .eq('active', true)
    .eq('is_pickable', true)
    .order('name')
    .limit(1)
    .maybeSingle()

  if (error) {
    console.warn('resolveDefaultImsLocationId:', error.message)
    return null
  }

  return data?.id ?? null
}

/** Warehouse location for inventory deduct / reservation (settings, then fallback). */
export async function resolveWarehouseLocationForIntegration(
  supabase: SupabaseClient,
  integrationId: string
): Promise<string | null> {
  const { data: integration, error } = await supabase
    .from('client_integrations')
    .select('settings')
    .eq('id', integrationId)
    .single()

  if (error || !integration) return null

  const settings = (integration.settings ?? {}) as IntegrationSettings
  if (settings.default_location_id) {
    return settings.default_location_id
  }

  return resolveDefaultImsLocationId(supabase)
}

/** Persist default_location_id on integration settings when missing. */
export async function ensureIntegrationWarehouseLocation(
  supabase: SupabaseClient,
  integrationId: string
): Promise<string | null> {
  const { data: integration } = await supabase
    .from('client_integrations')
    .select('settings')
    .eq('id', integrationId)
    .single()

  const settings = (integration?.settings ?? {}) as IntegrationSettings
  if (settings.default_location_id) {
    return settings.default_location_id
  }

  const locationId = await resolveDefaultImsLocationId(supabase)
  if (!locationId) return null

  const { error } = await supabase
    .from('client_integrations')
    .update({
      settings: { ...settings, default_location_id: locationId },
      updated_at: new Date().toISOString(),
    })
    .eq('id', integrationId)

  if (error) {
    console.warn('ensureIntegrationWarehouseLocation:', error.message)
    return null
  }

  return locationId
}
