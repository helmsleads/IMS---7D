import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { syncInvoiceToQB, getQBCredentials } from '@/lib/api/quickbooks'

/**
 * POST /api/integrations/quickbooks/sync/invoices
 * Sync an invoice to QB
 * Body: { invoiceId: string }
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

    if (!body.invoiceId) {
      return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 })
    }

    const result = await syncInvoiceToQB(body.invoiceId)

    return NextResponse.json({
      success: true,
      qbInvoiceId: result.qbInvoiceId,
    })
  } catch (err) {
    console.error('QB invoice sync error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Invoice sync failed',
    }, { status: 500 })
  }
}
