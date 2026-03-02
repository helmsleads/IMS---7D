import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { qbApiRequest } from '@/lib/api/quickbooks'

interface QBAccount {
  Id: string
  Name: string
  AccountType: string
  AccountSubType: string
  Active: boolean
  CurrentBalance: number
}

/**
 * GET /api/integrations/quickbooks/accounts
 * Fetches Chart of Accounts from QB, grouped by type
 */
export async function GET(request: NextRequest) {
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

    const result = await qbApiRequest<Record<string, unknown>>(
      'GET',
      'query?query=' + encodeURIComponent('SELECT * FROM Account WHERE Active = true MAXRESULTS 1000')
    )

    const queryResponse = result.QueryResponse as Record<string, unknown> | undefined
    const accounts = (queryResponse?.Account || []) as QBAccount[]

    // Group by type
    const grouped: Record<string, Array<{ id: string; name: string; subType: string }>> = {}

    for (const acct of accounts) {
      const type = acct.AccountType
      if (!grouped[type]) grouped[type] = []
      grouped[type].push({
        id: acct.Id,
        name: acct.Name,
        subType: acct.AccountSubType,
      })
    }

    // Sort each group by name
    for (const type of Object.keys(grouped)) {
      grouped[type].sort((a, b) => a.name.localeCompare(b.name))
    }

    // Also provide flat lists for common use cases
    const incomeAccounts = accounts
      .filter((a) => a.AccountType === 'Income')
      .map((a) => ({ id: a.Id, name: a.Name }))

    const expenseAccounts = accounts
      .filter((a) => a.AccountType === 'Expense' || a.AccountType === 'Cost of Goods Sold')
      .map((a) => ({ id: a.Id, name: a.Name }))

    const bankAccounts = accounts
      .filter((a) => a.AccountType === 'Bank')
      .map((a) => ({ id: a.Id, name: a.Name }))

    return NextResponse.json({
      grouped,
      income: incomeAccounts,
      expense: expenseAccounts,
      bank: bankAccounts,
    })
  } catch (err) {
    console.error('QB accounts fetch error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Failed to fetch accounts',
    }, { status: 500 })
  }
}
