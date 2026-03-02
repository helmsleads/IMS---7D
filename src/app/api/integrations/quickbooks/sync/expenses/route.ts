import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { syncShippingExpense, syncSupplyExpense, getQBCredentials } from '@/lib/api/quickbooks'

/**
 * POST /api/integrations/quickbooks/sync/expenses
 * Sync shipping or supply costs to QB as Expenses
 * Body: { type: 'shipping' | 'supply', orderId: string }
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

    if (!body.type || !body.orderId) {
      return NextResponse.json({ error: 'type and orderId are required' }, { status: 400 })
    }

    if (body.type === 'shipping') {
      const result = await syncShippingExpense(body.orderId)
      return NextResponse.json({ success: true, qbExpenseId: result.qbExpenseId })
    }

    if (body.type === 'supply') {
      const result = await syncSupplyExpense(body.orderId)
      return NextResponse.json({ success: true, qbExpenseId: result.qbExpenseId })
    }

    return NextResponse.json({ error: 'type must be "shipping" or "supply"' }, { status: 400 })
  } catch (err) {
    console.error('QB expense sync error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Expense sync failed',
    }, { status: 500 })
  }
}
