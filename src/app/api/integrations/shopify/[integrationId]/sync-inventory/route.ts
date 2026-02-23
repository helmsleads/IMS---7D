import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase-service'
import { syncInventoryToShopify } from '@/lib/api/shopify/inventory-sync'
import { checkApiRateLimit } from '@/lib/rate-limit'

/**
 * Manually trigger inventory sync to Shopify
 * POST /api/integrations/shopify/[integrationId]/sync-inventory
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  const { integrationId } = await params

  // Rate limit by integration ID
  const rateLimit = await checkApiRateLimit(`sync:${integrationId}`)
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Too many sync requests. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.resetIn) } }
    )
  }

  try {
    // Authenticate user
    const userSupabase = createServerClient(
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

    const { data: { user } } = await userSupabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify access via RLS
    const { data: userIntegration, error: accessError } = await userSupabase
      .from('client_integrations')
      .select('id, client_id')
      .eq('id', integrationId)
      .single()

    if (accessError || !userIntegration) {
      return NextResponse.json({ error: 'Integration not found or access denied' }, { status: 403 })
    }

    // Verify integration is active
    const supabase = createServiceClient()
    const { data: integration, error } = await supabase
      .from('client_integrations')
      .select('id, status')
      .eq('id', integrationId)
      .single()

    if (error || !integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    if (integration.status !== 'active') {
      return NextResponse.json({ error: 'Integration is not active' }, { status: 400 })
    }

    // Sync inventory with 'manual' trigger
    const result = await syncInventoryToShopify(integrationId, undefined, 'manual')

    return NextResponse.json(result)
  } catch (error) {
    console.error('Inventory sync failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
