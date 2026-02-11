/**
 * Shopify Location Management API
 *
 * GET  - List all Shopify locations and current selection
 * PUT  - Update selected location for inventory sync
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase-service'
import { decryptToken } from '@/lib/encryption'
import {
  getShopifyLocations,
  verifyLocationExists,
} from '@/lib/api/shopify/location-management'

/**
 * GET /api/integrations/shopify/locations
 * List all available Shopify locations and the currently selected one
 */
export async function GET(request: NextRequest) {
  // Authenticate user
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's client ID from client_users
  const { data: clientUser } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

  if (!clientUser) {
    return NextResponse.json({ error: 'No client access' }, { status: 403 })
  }

  // Get the Shopify integration for this client
  const serviceClient = createServiceClient()
  const { data: integration, error: integrationError } = await serviceClient
    .from('client_integrations')
    .select('*')
    .eq('client_id', clientUser.client_id)
    .eq('platform', 'shopify')
    .eq('status', 'active')
    .single()

  if (integrationError || !integration) {
    return NextResponse.json(
      { error: 'Shopify integration not found' },
      { status: 404 }
    )
  }

  // Decrypt access token and fetch locations from Shopify
  try {
    const accessToken = decryptToken(integration.access_token)
    const locations = await getShopifyLocations(
      integration.shop_domain,
      accessToken
    )

    return NextResponse.json({
      locations: locations.map((loc) => ({
        id: String(loc.id),
        name: loc.name,
        active: loc.active,
        fulfills_online_orders: loc.fulfills_online_orders,
        city: loc.city,
        province_code: loc.province_code,
        country_code: loc.country_code,
      })),
      currentLocationId: integration.shopify_location_id,
      currentLocationName: integration.shopify_location_name,
      locationCreatedByUs: integration.location_created_by_us,
    })
  } catch (error) {
    console.error('Failed to fetch Shopify locations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch locations from Shopify' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/integrations/shopify/locations
 * Update the selected location for inventory sync
 */
export async function PUT(request: NextRequest) {
  // Authenticate user
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's client ID and verify admin/owner role
  const { data: clientUser } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

  if (!clientUser) {
    return NextResponse.json({ error: 'No client access' }, { status: 403 })
  }

  if (!['owner', 'admin'].includes(clientUser.role)) {
    return NextResponse.json(
      { error: 'Only owners and admins can change location settings' },
      { status: 403 }
    )
  }

  // Parse request body
  const body = await request.json()
  const { locationId } = body

  if (!locationId) {
    return NextResponse.json(
      { error: 'Location ID is required' },
      { status: 400 }
    )
  }

  // Get the Shopify integration
  const serviceClient = createServiceClient()
  const { data: integration, error: integrationError } = await serviceClient
    .from('client_integrations')
    .select('*')
    .eq('client_id', clientUser.client_id)
    .eq('platform', 'shopify')
    .eq('status', 'active')
    .single()

  if (integrationError || !integration) {
    return NextResponse.json(
      { error: 'Shopify integration not found' },
      { status: 404 }
    )
  }

  // Verify the location exists in Shopify
  try {
    const accessToken = decryptToken(integration.access_token)
    const exists = await verifyLocationExists(
      integration.shop_domain,
      accessToken,
      locationId
    )

    if (!exists) {
      return NextResponse.json(
        { error: 'Location not found or inactive in Shopify' },
        { status: 400 }
      )
    }

    // Fetch the location details to get the name
    const locations = await getShopifyLocations(
      integration.shop_domain,
      accessToken
    )
    const selectedLocation = locations.find((loc) => String(loc.id) === locationId)

    if (!selectedLocation) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 400 }
      )
    }

    // Update the integration with the new location
    const { error: updateError } = await serviceClient
      .from('client_integrations')
      .update({
        shopify_location_id: locationId,
        shopify_location_name: selectedLocation.name,
        location_created_by_us: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id)

    if (updateError) {
      console.error('Failed to update integration:', updateError)
      return NextResponse.json(
        { error: 'Failed to update location' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      locationId,
      locationName: selectedLocation.name,
      message: `Inventory will now sync to "${selectedLocation.name}"`,
    })
  } catch (error) {
    console.error('Failed to update location:', error)
    return NextResponse.json(
      { error: 'Failed to verify location with Shopify' },
      { status: 500 }
    )
  }
}
