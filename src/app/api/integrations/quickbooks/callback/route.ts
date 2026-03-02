import { NextRequest, NextResponse } from 'next/server'
import { getQBAppCredentials, saveQBCredentials } from '@/lib/api/quickbooks'
import type { QuickBooksCredentials } from '@/types/database'
import { createServerClient } from '@supabase/ssr'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

/**
 * GET /api/integrations/quickbooks/callback
 * Handles the OAuth callback from Intuit — exchanges code for tokens
 * Reads client_id/secret from system_settings (entered via Settings UI)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const realmId = searchParams.get('realmId')

  const redirectError = (error: string) =>
    NextResponse.redirect(`${APP_URL}/settings/system?qb=error&message=${encodeURIComponent(error)}`)

  if (!code || !state || !realmId) {
    console.error('QB callback missing params:', { code: !!code, state: !!state, realmId: !!realmId })
    return redirectError('Missing OAuth parameters')
  }

  // Validate state nonce
  const nonceCookie = request.cookies.get('qb_oauth_nonce')?.value
  if (!nonceCookie || nonceCookie !== state) {
    console.error('QB callback invalid state nonce')
    return redirectError('Invalid state — possible CSRF')
  }

  // Verify user is authenticated
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
    return redirectError('Not authenticated')
  }

  // Read app credentials from system_settings
  const appCreds = await getQBAppCredentials()
  if (!appCreds?.client_id || !appCreds?.client_secret) {
    return redirectError('QuickBooks app credentials not found — re-enter in Settings')
  }

  // Exchange authorization code for tokens
  let tokenData: {
    access_token: string
    refresh_token: string
    expires_in: number
    x_refresh_token_expires_in: number
    token_type: string
  }

  try {
    const tokenResponse = await fetch(QB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${appCreds.client_id}:${appCreds.client_secret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${APP_URL}/api/integrations/quickbooks/callback`,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('QB token exchange failed:', errorText)
      return redirectError('Token exchange failed')
    }

    tokenData = await tokenResponse.json()
  } catch (err) {
    console.error('QB token exchange error:', err)
    return redirectError('Token exchange failed')
  }

  const now = new Date()
  const credentials: QuickBooksCredentials = {
    realm_id: realmId,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_expires_at: new Date(now.getTime() + tokenData.expires_in * 1000).toISOString(),
    refresh_token_expires_at: new Date(now.getTime() + tokenData.x_refresh_token_expires_in * 1000).toISOString(),
    environment: appCreds.environment,
    connected_at: now.toISOString(),
    connected_by: user.id,
  }

  try {
    await saveQBCredentials(credentials)
  } catch (err) {
    console.error('Failed to save QB credentials:', err)
    return redirectError('Failed to save credentials')
  }

  // Clear nonce cookie and redirect to success
  const response = NextResponse.redirect(`${APP_URL}/settings/system?qb=connected`)
  response.cookies.delete('qb_oauth_nonce')

  return response
}
