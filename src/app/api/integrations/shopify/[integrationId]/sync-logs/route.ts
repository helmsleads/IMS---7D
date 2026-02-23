import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase-service'

/**
 * Fetch sync activity logs for an integration
 * GET /api/integrations/shopify/[integrationId]/sync-logs?limit=10&type=inventory
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  const { integrationId } = await params

  try {
    // Authenticate user via cookies
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
      .select('id')
      .eq('id', integrationId)
      .single()

    if (accessError || !userIntegration) {
      return NextResponse.json({ error: 'Integration not found or access denied' }, { status: 403 })
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)
    const type = searchParams.get('type')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Query logs via service client
    const supabase = createServiceClient()
    let query = supabase
      .from('integration_sync_logs')
      .select('*', { count: 'exact' })
      .eq('integration_id', integrationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (type) {
      query = query.eq('sync_type', type)
    }

    const { data: logs, count, error } = await query

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
    }

    return NextResponse.json({ logs: logs || [], total: count || 0 })
  } catch (error) {
    console.error('Sync logs fetch failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch logs' },
      { status: 500 }
    )
  }
}
