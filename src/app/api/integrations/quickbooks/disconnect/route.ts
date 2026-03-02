import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getQBCredentials, getQBAppCredentials, deleteQBCredentials } from '@/lib/api/quickbooks'

const QB_REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke'

/**
 * POST /api/integrations/quickbooks/disconnect
 * Revokes QB tokens and removes OAuth credentials (keeps app credentials)
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

    // Get current credentials to revoke the token
    const creds = await getQBCredentials()
    const appCreds = await getQBAppCredentials()

    if (creds && appCreds) {
      // Attempt to revoke the refresh token with Intuit
      try {
        await fetch(QB_REVOKE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${Buffer.from(`${appCreds.client_id}:${appCreds.client_secret}`).toString('base64')}`,
          },
          body: JSON.stringify({ token: creds.refresh_token }),
        })
      } catch (revokeErr) {
        // Log but don't fail — we still want to delete local credentials
        console.warn('Failed to revoke QB token:', revokeErr)
      }
    }

    // Delete OAuth credentials from system_settings (keeps app credentials for reconnection)
    await deleteQBCredentials()

    return NextResponse.json({ success: true, message: 'QuickBooks disconnected' })
  } catch (err) {
    console.error('QB disconnect error:', err)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}
