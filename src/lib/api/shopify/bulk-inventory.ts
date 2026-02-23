import type { ShopifyClient } from './client'

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
        inventoryItemId: `gid://shopify/InventoryItem/${u.inventoryItemId}`,
        locationId: `gid://shopify/Location/${u.locationId}`,
        quantity: u.quantity,
      }))

      const data = await client.graphql<{
        inventorySetQuantities: {
          userErrors: Array<{ field: string[]; message: string }>
        }
      }>(INVENTORY_SET_QUANTITIES_MUTATION, {
        input: {
          name: `IMS-7D ${reason}`,
          reason,
          ignoreCompareQuantity: true,
          quantities,
        },
      })

      const userErrors = data.inventorySetQuantities?.userErrors || []

      if (userErrors.length > 0) {
        // Some items failed — fall back to REST for this batch
        console.warn('GraphQL partial failure, falling back to REST for batch:', userErrors)
        const restResult = await fallbackRestUpdate(client, batch)
        result.updated += restResult.updated
        result.failed += restResult.failed
        result.errors.push(...restResult.errors)
      } else {
        result.updated += batch.length
      }
    } catch (error) {
      // GraphQL failed entirely — fall back to REST
      console.warn('GraphQL batch failed, falling back to REST:', error)
      const restResult = await fallbackRestUpdate(client, batch)
      result.updated += restResult.updated
      result.failed += restResult.failed
      result.errors.push(...restResult.errors)
    }
  }

  return result
}

async function fallbackRestUpdate(
  client: ShopifyClient,
  updates: InventoryUpdate[]
): Promise<BulkUpdateResult> {
  const result: BulkUpdateResult = { updated: 0, failed: 0, errors: [] }

  for (const update of updates) {
    try {
      await client.post('/inventory_levels/set.json', {
        location_id: parseInt(update.locationId),
        inventory_item_id: parseInt(update.inventoryItemId),
        available: update.quantity,
      })
      result.updated++
      // Rate limit protection
      await new Promise((r) => setTimeout(r, 500))
    } catch (error) {
      result.failed++
      result.errors.push({
        inventoryItemId: update.inventoryItemId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return result
}
