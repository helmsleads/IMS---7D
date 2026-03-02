import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase-service'
import { syncClientToQB, getQBCredentials } from '@/lib/api/quickbooks'

/**
 * POST /api/integrations/quickbooks/sync/customers
 * Sync client(s) to QB as Customers
 * Body: { clientId: string } or { all: true }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll() {},
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const creds = await getQBCredentials()
    if (!creds) {
      return NextResponse.json({ error: 'QuickBooks is not connected' }, { status: 400 })
    }

    const body = await request.json()

    if (body.clientId) {
      const result = await syncClientToQB(body.clientId)
      return NextResponse.json({ success: true, qbCustomerId: result.qbCustomerId })
    }

    if (body.all) {
      const serviceSupabase = createServiceClient()
      const { data: clients } = await serviceSupabase
        .from('clients')
        .select('id')
        .eq('active', true)

      if (!clients || clients.length === 0) {
        return NextResponse.json({ success: true, synced: 0 })
      }

      const results: Array<{ clientId: string; success: boolean; error?: string }> = []

      for (const client of clients) {
        try {
          await syncClientToQB(client.id)
          results.push({ clientId: client.id, success: true })
        } catch (err) {
          results.push({
            clientId: client.id,
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          })
        }
      }

      return NextResponse.json({
        success: true,
        synced: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
      })
    }

    return NextResponse.json({ error: 'Provide clientId or all: true' }, { status: 400 })
  } catch (err) {
    console.error('QB customer sync error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Sync failed',
    }, { status: 500 })
  }
}
