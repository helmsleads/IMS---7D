import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServerClient } from '@supabase/ssr'
import { getQBAppCredentials } from '@/lib/api/quickbooks'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

const QB_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'
const QB_SCOPES = 'com.intuit.quickbooks.accounting'

/**
 * GET /api/integrations/quickbooks/auth
 * Initiates the QuickBooks OAuth 2.0 flow
 * Reads client_id from system_settings (entered via Settings UI)
 */
export async function GET(request: NextRequest) {
  try {
    // Auth check
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

    // Read app credentials from system_settings
    const appCreds = await getQBAppCredentials()
    if (!appCreds?.client_id) {
      return NextResponse.json(
        { error: 'QuickBooks app credentials not configured — enter Client ID and Secret in Settings first' },
        { status: 400 }
      )
    }

    // Generate state nonce for CSRF protection
    const nonce = crypto.randomBytes(16).toString('hex')

    const authUrl = new URL(QB_AUTH_URL)
    authUrl.searchParams.set('client_id', appCreds.client_id)
    authUrl.searchParams.set('scope', QB_SCOPES)
    authUrl.searchParams.set('redirect_uri', `${APP_URL}/api/integrations/quickbooks/callback`)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('state', nonce)

    const response = NextResponse.redirect(authUrl.toString())

    // Store nonce in cookie for callback validation
    response.cookies.set('qb_oauth_nonce', nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    })

    return response
  } catch (err) {
    console.error('QB auth initiation error:', err)
    return NextResponse.json({ error: 'Failed to initiate OAuth' }, { status: 500 })
  }
}
