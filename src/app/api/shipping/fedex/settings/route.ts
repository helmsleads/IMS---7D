import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getFedExCredentials, saveFedExCredentials } from '@/lib/api/fedex'
import type { FedExCredentials } from '@/types/database'

/**
 * GET /api/shipping/fedex/settings — Read credentials (masked)
 */
export async function GET(request: NextRequest) {
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

    const credentials = await getFedExCredentials()
    if (!credentials) {
      return NextResponse.json({ configured: false, credentials: null })
    }

    // Mask the secret before returning
    return NextResponse.json({
      configured: true,
      credentials: {
        ...credentials,
        client_secret: '****',
      },
    })
  } catch (err) {
    console.error('FedEx settings read error:', err)
    return NextResponse.json({ error: 'Failed to read FedEx settings' }, { status: 500 })
  }
}

/**
 * POST /api/shipping/fedex/settings — Save credentials
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

    // If the secret is "****", preserve the existing encrypted value
    if (body.client_secret === '****') {
      const existing = await getFedExCredentials()
      if (existing) {
        body.client_secret = existing.client_secret
      } else {
        return NextResponse.json({ error: 'Cannot save with masked secret — no existing credentials found' }, { status: 400 })
      }
    }

    await saveFedExCredentials(body)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('FedEx settings save error:', err)
    const message = err instanceof Error ? err.message : 'Failed to save FedEx settings'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
