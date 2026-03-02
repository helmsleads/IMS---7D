import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import {
  getQBCredentials,
  getQBAppCredentials,
  saveQBAppCredentials,
  getAccountMappings,
  saveAccountMappings,
  type QBAccountMappings,
} from '@/lib/api/quickbooks'
import type { QuickBooksAppCredentials } from '@/types/database'

/**
 * GET /api/integrations/quickbooks/settings
 * Returns QB connection status, app credentials (masked), and account mappings
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

    const appCreds = await getQBAppCredentials()
    const creds = await getQBCredentials()

    const response: Record<string, unknown> = {
      configured: !!appCreds?.client_id,
      connected: !!creds,
    }

    // Return masked app credentials
    if (appCreds) {
      response.app_credentials = {
        client_id: appCreds.client_id,
        client_secret: appCreds.client_secret ? '****' : '',
        webhook_verifier: appCreds.webhook_verifier ? '****' : '',
        environment: appCreds.environment,
      }
    }

    // Return OAuth connection info
    if (creds) {
      const tokenExpiry = new Date(creds.token_expires_at)
      const refreshExpiry = new Date(creds.refresh_token_expires_at)
      const now = new Date()

      response.realm_id = creds.realm_id
      response.environment = creds.environment
      response.connected_at = creds.connected_at
      response.token_status = tokenExpiry > now ? 'valid' : 'expired'
      response.token_expires_at = creds.token_expires_at
      response.refresh_token_status = refreshExpiry > now ? 'valid' : 'expired'
      response.refresh_token_expires_at = creds.refresh_token_expires_at
      response.account_mappings = await getAccountMappings()
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('QB settings error:', err)
    return NextResponse.json({ error: 'Failed to load QB settings' }, { status: 500 })
  }
}

/**
 * POST /api/integrations/quickbooks/settings
 * Save app credentials and/or account mappings
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

    const body = await request.json() as {
      app_credentials?: QuickBooksAppCredentials
      account_mappings?: QBAccountMappings
    }

    if (body.app_credentials) {
      // If client_secret is "****", keep the existing one
      if (body.app_credentials.client_secret === '****') {
        const existing = await getQBAppCredentials()
        if (existing) {
          body.app_credentials.client_secret = existing.client_secret
        }
      }
      if (body.app_credentials.webhook_verifier === '****') {
        const existing = await getQBAppCredentials()
        if (existing) {
          body.app_credentials.webhook_verifier = existing.webhook_verifier
        }
      }
      await saveQBAppCredentials(body.app_credentials)
    }

    if (body.account_mappings) {
      await saveAccountMappings(body.account_mappings)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('QB settings update error:', err)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
