import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { qbApiRequest } from '@/lib/api/quickbooks'

/**
 * POST /api/integrations/quickbooks/test
 * Tests the QB connection by fetching company info
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

    // QB companyinfo endpoint returns { CompanyInfo: { ... } }
    // but with realm_id in the URL it's /companyinfo/{realmId}
    const result = await qbApiRequest<Record<string, unknown>>('GET', 'companyinfo')
    const companyInfo = result.CompanyInfo as Record<string, unknown> | undefined

    if (!companyInfo) {
      // Try the query endpoint instead
      const queryResult = await qbApiRequest<Record<string, unknown>>(
        'GET',
        'query?query=SELECT%20*%20FROM%20CompanyInfo'
      )
      const qr = queryResult.QueryResponse as Record<string, unknown[]> | undefined
      const info = qr?.CompanyInfo?.[0] as Record<string, unknown> | undefined

      return NextResponse.json({
        success: true,
        message: `Connected to ${(info?.CompanyName as string) || 'QuickBooks'}`,
        company_name: info?.CompanyName || 'Unknown',
      })
    }

    return NextResponse.json({
      success: true,
      message: `Connected to ${companyInfo.CompanyName || 'QuickBooks'}`,
      company_name: companyInfo.CompanyName,
    })
  } catch (err) {
    console.error('QB test connection error:', err)
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Connection test failed',
    })
  }
}
