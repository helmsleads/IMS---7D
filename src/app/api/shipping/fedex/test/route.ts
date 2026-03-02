import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getAccessToken } from '@/lib/api/fedex'
import type { FedExCredentials } from '@/types/database'

/**
 * POST /api/shipping/fedex/test — Test FedEx connection
 *
 * Accepts credentials in body (for testing before saving).
 * Attempts OAuth token acquisition and returns success/failure.
 */
export async function POST(request: NextRequest) {
  try {
    const userSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll() {},
        },
      }
    )

    const { data: { user } } = await userSupabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as FedExCredentials

    if (!body.client_id || !body.client_secret || !body.account_number) {
      return NextResponse.json(
        { error: 'Missing required fields: client_id, client_secret, account_number' },
        { status: 400 }
      )
    }

    // Don't test with masked secret
    if (body.client_secret === '****') {
      return NextResponse.json(
        { error: 'Cannot test with masked secret. Enter the actual API secret.' },
        { status: 400 }
      )
    }

    // Attempt OAuth token acquisition
    await getAccessToken(body)

    return NextResponse.json({ success: true, message: 'Successfully connected to FedEx API' })
  } catch (err) {
    console.error('FedEx connection test failed:', err)
    const message = err instanceof Error ? err.message : 'Connection test failed'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
