import { createServiceClient } from '@/lib/supabase-service'
import { syncInventoryToShopify } from './inventory-sync'

// Debounce timers keyed by integration ID
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Trigger a debounced inventory sync for the given product IDs.
 * Used for non-critical events (stock adjustments, receiving).
 * Groups updates per-integration with a 5s debounce window.
 */
export async function triggerInventorySync(productIds: string[]): Promise<void> {
  const integrationMap = await getIntegrationsForProducts(productIds)

  for (const [integrationId, prodIds] of integrationMap) {
    // Clear any existing debounce timer for this integration
    const existingTimer = debounceTimers.get(integrationId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Set a new debounce timer (5 seconds)
    const timer = setTimeout(async () => {
      debounceTimers.delete(integrationId)
      try {
        await syncInventoryToShopify(integrationId, prodIds, 'event')
        console.log(`Event sync completed for integration ${integrationId}: ${prodIds.length} products`)
      } catch (error) {
        console.error(`Event sync failed for integration ${integrationId}:`, error)
      }
    }, 5000)

    debounceTimers.set(integrationId, timer)
  }
}

/**
 * Trigger an immediate inventory sync for the given product IDs.
 * Used for critical events (shipping) where delays could cause overselling.
 */
export async function triggerImmediateInventorySync(productIds: string[]): Promise<void> {
  const integrationMap = await getIntegrationsForProducts(productIds)

  for (const [integrationId, prodIds] of integrationMap) {
    // Clear any pending debounce for this integration
    const existingTimer = debounceTimers.get(integrationId)
    if (existingTimer) {
      clearTimeout(existingTimer)
      debounceTimers.delete(integrationId)
    }

    try {
      await syncInventoryToShopify(integrationId, prodIds, 'event')
      console.log(`Immediate sync completed for integration ${integrationId}: ${prodIds.length} products`)
    } catch (error) {
      console.error(`Immediate sync failed for integration ${integrationId}:`, error)
    }
  }
}

/**
 * Look up product_mappings to find which integrations need syncing
 * Returns a map of integrationId → productIds[]
 */
async function getIntegrationsForProducts(
  productIds: string[]
): Promise<Map<string, string[]>> {
  const supabase = createServiceClient()

  const { data: mappings, error } = await supabase
    .from('product_mappings')
    .select('integration_id, product_id')
    .in('product_id', productIds)
    .eq('sync_inventory', true)

  if (error || !mappings?.length) {
    return new Map()
  }

  // Also verify integrations are active with auto_sync_inventory enabled
  const integrationIds = [...new Set(mappings.map((m) => m.integration_id))]
  const { data: integrations } = await supabase
    .from('client_integrations')
    .select('id, settings')
    .in('id', integrationIds)
    .eq('status', 'active')

  const activeIntegrations = new Set(
    (integrations || [])
      .filter((i) => i.settings?.auto_sync_inventory === true)
      .map((i) => i.id)
  )

  const result = new Map<string, string[]>()
  for (const mapping of mappings) {
    if (!activeIntegrations.has(mapping.integration_id)) continue

    const existing = result.get(mapping.integration_id) || []
    existing.push(mapping.product_id)
    result.set(mapping.integration_id, existing)
  }

  return result
}
