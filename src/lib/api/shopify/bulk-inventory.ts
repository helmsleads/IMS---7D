import { ShopifyApiError, type ShopifyClient } from './client'

interface InventoryUpdate {
  inventoryItemId: string
  locationId: string
  quantity: number
}

interface BulkUpdateResult {
  updated: number
  failed: number
  errors: Array<{ inventoryItemId: string; error: string }>
}

const GRAPHQL_BATCH_SIZE = 100 // Shopify limit for inventorySetQuantities

/** Accepts numeric id or full Admin GID; returns numeric id string for REST / GID suffix. */
function numericShopifyResourceId(id: string): string {
  const t = id.trim()
  if (t.startsWith('gid://')) {
    return t.split('/').pop() ?? t
  }
  return t
}

function parseShopifyId(id: string): number {
  return parseInt(numericShopifyResourceId(id), 10)
}

function normalizedAvailableQuantity(q: number): number {
  if (!Number.isFinite(q)) return 0
  return Math.max(0, Math.floor(q))
}

/** Shopify requires an inventory level at the location before set.json works. */
function isBenignInventoryConnectError(err: unknown): boolean {
  if (!(err instanceof ShopifyApiError)) return false
  if (err.status !== 422 && err.status !== 400) return false
  const b = err.body.toLowerCase()
  return (
    b.includes('already') ||
    b.includes('already exists') ||
    b.includes('has already been taken') ||
    (b.includes('inventory level') && b.includes('exist'))
  )
}

function isRecoverableInventorySetError(err: unknown): boolean {
  if (!(err instanceof ShopifyApiError)) return false
  if (err.status !== 422 && err.status !== 404) return false
  const b = err.body.toLowerCase()
  return (
    b.includes('not stocked') ||
    b.includes('inventory level') ||
    b.includes('fulfill') ||
    b.includes('activate') ||
    b.includes('relocate') ||
    b.includes('does not exist') ||
    b.includes('could not find')
  )
}

const INVENTORY_SET_QUANTITIES_MUTATION = `
  mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
    inventorySetQuantities(input: $input) {
      inventoryAdjustmentGroup {
        reason
      }
      userErrors {
        field
        message
      }
    }
  }
`

/**
 * Batch update inventory using Shopify's GraphQL inventorySetQuantities mutation.
 * Falls back to individual REST calls if GraphQL fails.
 */
export async function batchUpdateInventory(
  client: ShopifyClient,
  updates: InventoryUpdate[],
  reason = 'correction'
): Promise<BulkUpdateResult> {
  const result: BulkUpdateResult = { updated: 0, failed: 0, errors: [] }

  // Process in batches of GRAPHQL_BATCH_SIZE
  for (let i = 0; i < updates.length; i += GRAPHQL_BATCH_SIZE) {
    const batch = updates.slice(i, i + GRAPHQL_BATCH_SIZE)

    try {
      const quantities = batch.map((u) => ({
        inventoryItemId: `gid://shopify/InventoryItem/${numericShopifyResourceId(u.inventoryItemId)}`,
        locationId: `gid://shopify/Location/${numericShopifyResourceId(u.locationId)}`,
        quantity: normalizedAvailableQuantity(u.quantity),
      }))

      const data = await client.graphql<{
        inventorySetQuantities: {
          userErrors: Array<{ field: string[]; message: string }>
        } | null
      }>(INVENTORY_SET_QUANTITIES_MUTATION, {
        input: {
          name: `IMS-7D ${reason}`,
          reason,
          ignoreCompareQuantity: true,
          quantities,
        },
      })

      const payload = data.inventorySetQuantities
      if (!payload) {
        console.warn('GraphQL inventorySetQuantities returned no payload; using REST fallback')
        const restResult = await fallbackRestUpdate(
          client,
          batch,
          'inventorySetQuantities response missing'
        )
        result.updated += restResult.updated
        result.failed += restResult.failed
        result.errors.push(...restResult.errors)
        continue
      }

      const userErrors = payload.userErrors || []

      if (userErrors.length > 0) {
        // Some items failed — fall back to REST for this batch
        const gqlHint = userErrors.map((e) => e.message).join('; ')
        console.warn('GraphQL inventorySetQuantities userErrors, falling back to REST:', gqlHint)
        const restResult = await fallbackRestUpdate(client, batch, gqlHint)
        result.updated += restResult.updated
        result.failed += restResult.failed
        result.errors.push(...restResult.errors)
      } else {
        result.updated += batch.length
      }
    } catch (error) {
      // GraphQL failed entirely — fall back to REST
      console.warn('GraphQL batch failed, falling back to REST:', error)
      const restResult = await fallbackRestUpdate(
        client,
        batch,
        error instanceof Error ? error.message : undefined
      )
      result.updated += restResult.updated
      result.failed += restResult.failed
      result.errors.push(...restResult.errors)
    }
  }

  return result
}

async function fallbackRestUpdate(
  client: ShopifyClient,
  updates: InventoryUpdate[],
  graphQlContext?: string
): Promise<BulkUpdateResult> {
  const result: BulkUpdateResult = { updated: 0, failed: 0, errors: [] }

  for (const update of updates) {
    const locationId = parseShopifyId(update.locationId)
    const inventoryItemId = parseShopifyId(update.inventoryItemId)
    if (!Number.isFinite(locationId) || !Number.isFinite(inventoryItemId)) {
      result.failed++
      result.errors.push({
        inventoryItemId: update.inventoryItemId,
        error: `Invalid Shopify id (location=${update.locationId}, item=${update.inventoryItemId})`,
      })
      continue
    }

    try {
      await restInventoryConnectAndSet(
        client,
        locationId,
        inventoryItemId,
        normalizedAvailableQuantity(update.quantity)
      )
      result.updated++
      // Rate limit protection
      await new Promise((r) => setTimeout(r, 500))
    } catch (error) {
      result.failed++
      let msg =
        error instanceof ShopifyApiError
          ? `${error.status}: ${error.body.length > 600 ? `${error.body.slice(0, 600)}…` : error.body}`
          : error instanceof Error
            ? error.message
            : 'Unknown error'
      if (graphQlContext) {
        msg = `${msg} (GraphQL: ${graphQlContext.length > 200 ? `${graphQlContext.slice(0, 200)}…` : graphQlContext})`
      }
      result.errors.push({
        inventoryItemId: update.inventoryItemId,
        error: msg,
      })
    }
  }

  return result
}

/**
 * REST: ensure inventory item is stocked at location, then set available.
 * Uses connect without relocation first, then with relocation for multi-location test stores.
 */
async function restInventoryConnectAndSet(
  client: ShopifyClient,
  locationId: number,
  inventoryItemId: number,
  available: number
): Promise<void> {
  async function connect(rel: boolean): Promise<void> {
    await client.post('/inventory_levels/connect.json', {
      location_id: locationId,
      inventory_item_id: inventoryItemId,
      relocate_if_necessary: rel,
    })
  }

  async function set(): Promise<void> {
    await client.post('/inventory_levels/set.json', {
      location_id: locationId,
      inventory_item_id: inventoryItemId,
      available,
    })
  }

  try {
    try {
      await connect(false)
    } catch (e0) {
      if (isBenignInventoryConnectError(e0)) {
        // already linked
      } else {
        await connect(true)
      }
    }
    await set()
  } catch (first) {
    if (!(first instanceof ShopifyApiError) || !isRecoverableInventorySetError(first)) {
      throw first
    }
    try {
      await connect(true)
    } catch (e1) {
      if (!isBenignInventoryConnectError(e1)) {
        throw e1
      }
    }
    await set()
  }
}
