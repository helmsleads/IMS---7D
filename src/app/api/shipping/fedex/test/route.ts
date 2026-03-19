import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getAccessToken, getRates } from '@/lib/api/fedex'
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

    // Optional override: force sandbox in local/dev environments
    if (process.env.FEDEX_SANDBOX === 'true') {
      body.environment = 'sandbox'
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

    // Optional: also test Rates API (catches "OAuth works but Ship/Rate permissions fail")
    let ratesOk: boolean | null = null
    let ratesError: string | null = null
    try {
      if (body.shipper_zip && body.shipper_country) {
        await getRates(
          {
            shipDate: new Date().toISOString().split('T')[0],
            weightLbs: 1,
            shipperPostalCode: body.shipper_zip,
            shipperCountryCode: body.shipper_country || 'US',
            recipientPostalCode: '10001',
            recipientCountryCode: 'US',
          },
          body
        )
        ratesOk = true
      } else {
        ratesOk = null
      }
    } catch (e) {
      ratesOk = false
      ratesError = e instanceof Error ? e.message : 'Rates test failed'
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully connected to FedEx API',
      checks: {
        oauth: true,
        rates: ratesOk,
      },
      ratesError,
      note:
        ratesOk === null
          ? 'Rates check skipped (missing shipper_zip/shipper_country on credentials).'
          : null,
    })
  } catch (err) {
    console.error('FedEx connection test failed:', err)
    const message = err instanceof Error ? err.message : 'Connection test failed'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
