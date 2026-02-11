/**
 * Shopify Location Management
 *
 * Manages dedicated locations in client Shopify stores for multi-location inventory.
 * Each client gets a "7 Degrees Co" location that we sync inventory to exclusively.
 *
 * @see SHOPIFY_MULTI_LOCATION_PLAN.md for full documentation
 */

import { createShopifyClient, ShopifyApiError } from './client'

const DEFAULT_LOCATION_NAME = '7 Degrees Co'

export interface ShopifyLocation {
  id: number
  name: string
  active: boolean
  fulfills_online_orders: boolean
  address1?: string | null
  address2?: string | null
  city?: string | null
  province?: string | null
  province_code?: string | null
  country?: string | null
  country_code?: string | null
  zip?: string | null
  phone?: string | null
  legacy?: boolean
}

export interface EnsureLocationResult {
  locationId: string
  locationName: string
  createdByUs: boolean
}

/**
 * Find or create our dedicated location in the client's Shopify store
 *
 * This is called during OAuth callback to set up the location.
 * If a location with our name already exists, we use that one.
 * Otherwise, we create a new location.
 *
 * @param shopDomain - The Shopify store domain
 * @param accessToken - The decrypted access token
 * @param locationName - The name for our location (default: "7 Degrees Co")
 * @returns Location ID and whether we created it
 */
export async function ensureShopifyLocation(
  shopDomain: string,
  accessToken: string,
  locationName: string = DEFAULT_LOCATION_NAME
): Promise<EnsureLocationResult> {
  const client = createShopifyClient({
    shopDomain,
    accessToken,
  })

  // First, check if location already exists
  const { locations } = await client.get<{ locations: ShopifyLocation[] }>(
    '/locations.json'
  )

  // Look for existing location with our name (case-insensitive)
  const existingLocation = locations.find(
    (loc) =>
      loc.name.toLowerCase() === locationName.toLowerCase() && loc.active
  )

  if (existingLocation) {
    console.log(
      `Found existing location "${existingLocation.name}" (ID: ${existingLocation.id})`
    )
    return {
      locationId: String(existingLocation.id),
      locationName: existingLocation.name,
      createdByUs: false,
    }
  }

  // Create new location
  try {
    const { location } = await client.post<{ location: ShopifyLocation }>(
      '/locations.json',
      {
        location: {
          name: locationName,
          fulfills_online_orders: true,
        },
      }
    )

    console.log(`Created new location "${location.name}" (ID: ${location.id})`)
    return {
      locationId: String(location.id),
      locationName: location.name,
      createdByUs: true,
    }
  } catch (error) {
    // If creation fails (e.g., location limit reached on Shopify plan),
    // try to use the first active location as fallback
    if (error instanceof ShopifyApiError) {
      console.warn(
        `Failed to create location: ${error.message}. Checking for fallback...`
      )

      const activeLocations = locations.filter((loc) => loc.active)
      if (activeLocations.length > 0) {
        const fallback = activeLocations[0]
        console.warn(
          `Using fallback location "${fallback.name}" (ID: ${fallback.id})`
        )
        return {
          locationId: String(fallback.id),
          locationName: fallback.name,
          createdByUs: false,
        }
      }
    }
    throw error
  }
}

/**
 * Get all active locations for a Shopify store
 *
 * @param shopDomain - The Shopify store domain
 * @param accessToken - The decrypted access token
 * @returns Array of active locations
 */
export async function getShopifyLocations(
  shopDomain: string,
  accessToken: string
): Promise<ShopifyLocation[]> {
  const client = createShopifyClient({
    shopDomain,
    accessToken,
  })

  const { locations } = await client.get<{ locations: ShopifyLocation[] }>(
    '/locations.json'
  )

  return locations.filter((loc) => loc.active)
}

/**
 * Get a specific location by ID
 *
 * @param shopDomain - The Shopify store domain
 * @param accessToken - The decrypted access token
 * @param locationId - The Shopify location ID
 * @returns The location if found and active, null otherwise
 */
export async function getShopifyLocation(
  shopDomain: string,
  accessToken: string,
  locationId: string
): Promise<ShopifyLocation | null> {
  const client = createShopifyClient({
    shopDomain,
    accessToken,
  })

  try {
    const { location } = await client.get<{ location: ShopifyLocation }>(
      `/locations/${locationId}.json`
    )
    return location.active ? location : null
  } catch (error) {
    if (error instanceof ShopifyApiError && error.status === 404) {
      return null
    }
    throw error
  }
}

/**
 * Verify our location still exists and is active
 *
 * Use this as a health check before syncing inventory.
 *
 * @param shopDomain - The Shopify store domain
 * @param accessToken - The decrypted access token
 * @param locationId - The Shopify location ID to verify
 * @returns true if location exists and is active
 */
export async function verifyLocationExists(
  shopDomain: string,
  accessToken: string,
  locationId: string
): Promise<boolean> {
  const location = await getShopifyLocation(shopDomain, accessToken, locationId)
  return location !== null && location.active
}

/**
 * Update location details
 *
 * Can be used to update the location's address or other settings.
 *
 * @param shopDomain - The Shopify store domain
 * @param accessToken - The decrypted access token
 * @param locationId - The Shopify location ID
 * @param updates - Fields to update
 * @returns Updated location
 */
export async function updateShopifyLocation(
  shopDomain: string,
  accessToken: string,
  locationId: string,
  updates: Partial<
    Pick<
      ShopifyLocation,
      | 'name'
      | 'address1'
      | 'address2'
      | 'city'
      | 'province'
      | 'country'
      | 'zip'
      | 'phone'
    >
  >
): Promise<ShopifyLocation> {
  const client = createShopifyClient({
    shopDomain,
    accessToken,
  })

  const { location } = await client.put<{ location: ShopifyLocation }>(
    `/locations/${locationId}.json`,
    {
      location: updates,
    }
  )

  return location
}

/**
 * Deactivate a location (cannot fully delete in Shopify)
 *
 * Note: Shopify doesn't allow deleting locations, only deactivating them.
 * Only use this if we created the location and want to clean up on disconnect.
 *
 * @param shopDomain - The Shopify store domain
 * @param accessToken - The decrypted access token
 * @param locationId - The Shopify location ID
 * @returns true if deactivation was successful
 */
export async function deactivateShopifyLocation(
  shopDomain: string,
  accessToken: string,
  locationId: string
): Promise<boolean> {
  const client = createShopifyClient({
    shopDomain,
    accessToken,
  })

  try {
    // First, we need to move inventory to another location
    // Then deactivate - for now, just log a warning
    console.warn(
      `Location deactivation requested for ${locationId} but not implemented yet`
    )
    console.warn(
      'Shopify requires moving inventory before deactivating a location'
    )

    // In a full implementation, we would:
    // 1. Get all inventory levels at this location
    // 2. Move inventory to another location or set to 0
    // 3. Then deactivate the location

    // For now, return false as this is a complex operation
    return false
  } catch (error) {
    console.error('Failed to deactivate location:', error)
    return false
  }
}
