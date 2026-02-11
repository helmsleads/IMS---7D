import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase-service'
import { syncShopifyOrders } from '@/lib/api/shopify/order-sync'
import { checkApiRateLimit } from '@/lib/rate-limit'

/**
 * Manually trigger order sync from Shopify
 * POST /api/integrations/shopify/[integrationId]/sync-orders
 *
 * Requires authenticated client user who owns this integration
 * Rate limited: 30 requests per minute per integration (distributed via Upstash Redis)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  const { integrationId } = await params

  // Rate limit by integration ID using distributed rate limiter
  const rateLimit = await checkApiRateLimit(`sync:${integrationId}`)

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Too many sync requests. Please wait before trying again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.resetIn) },
      }
    )
  }

  try {
    // Create authenticated Supabase client from request cookies
    const userSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll() {
            // API routes don't need to set cookies for read operations
          },
        },
      }
    )

    // Verify user is authenticated
    const { data: { user } } = await userSupabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check user has access to this integration via RLS
    const { data: userIntegration, error: accessError } = await userSupabase
      .from('client_integrations')
      .select('id, client_id')
      .eq('id', integrationId)
      .single()

    if (accessError || !userIntegration) {
      return NextResponse.json({ error: 'Integration not found or access denied' }, { status: 403 })
    }

    // Now use service client for the actual operation
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

    // Get optional 'since' parameter from request body
    let since: Date | undefined
    try {
      const body = await request.json()
      if (body.since) {
        since = new Date(body.since)
      }
    } catch {
      // No body or invalid JSON, that's fine
    }

    // Sync orders
    const result = await syncShopifyOrders(integrationId, since)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Order sync failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
