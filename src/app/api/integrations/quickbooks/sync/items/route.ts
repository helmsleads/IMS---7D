import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase-service'
import { syncRateCardToQB, syncServiceToQB, getQBCredentials } from '@/lib/api/quickbooks'

/**
 * POST /api/integrations/quickbooks/sync/items
 * Sync rate cards or services to QB as Items
 * Body: { rateCardId: string } or { serviceId: string } or { all: true }
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

    if (body.rateCardId) {
      const result = await syncRateCardToQB(body.rateCardId)
      return NextResponse.json({ success: true, qbItemId: result.qbItemId })
    }

    if (body.serviceId) {
      const result = await syncServiceToQB(body.serviceId)
      return NextResponse.json({ success: true, qbItemId: result.qbItemId })
    }

    if (body.all) {
      const serviceSupabase = createServiceClient()
      const results: Array<{ id: string; type: string; success: boolean; error?: string }> = []

      // Sync all active rate cards
      const { data: rateCards } = await serviceSupabase
        .from('client_rate_cards')
        .select('id')
        .eq('is_active', true)

      for (const rc of rateCards || []) {
        try {
          await syncRateCardToQB(rc.id)
          results.push({ id: rc.id, type: 'rate_card', success: true })
        } catch (err) {
          results.push({
            id: rc.id,
            type: 'rate_card',
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          })
        }
      }

      // Sync all active services
      const { data: services } = await serviceSupabase
        .from('services')
        .select('id')
        .eq('status', 'active')

      for (const svc of services || []) {
        try {
          await syncServiceToQB(svc.id)
          results.push({ id: svc.id, type: 'service', success: true })
        } catch (err) {
          results.push({
            id: svc.id,
            type: 'service',
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

    return NextResponse.json({ error: 'Provide rateCardId, serviceId, or all: true' }, { status: 400 })
  } catch (err) {
    console.error('QB item sync error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Sync failed',
    }, { status: 500 })
  }
}
