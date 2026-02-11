import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServerClient } from '@supabase/ssr'
import { checkOAuthRateLimit, getClientIp } from '@/lib/rate-limit'

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!
const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

/**
 * Initiates the Shopify OAuth flow
 * GET /api/integrations/shopify/auth?shop=mystore&state=base64encodedstate
 *
 * Requires authenticated user who belongs to the client
 * Rate limited: 10 requests per minute per IP (distributed via Upstash Redis)
 */
export async function GET(request: NextRequest) {
  // Rate limit by IP using distributed rate limiter
  const clientIp = getClientIp(request)
  const rateLimit = await checkOAuthRateLimit(clientIp)

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.resetIn),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const shop = searchParams.get('shop')
  const state = searchParams.get('state')

  if (!shop) {
    return NextResponse.json({ error: 'Missing shop parameter' }, { status: 400 })
  }

  if (!state) {
    return NextResponse.json({ error: 'Missing state parameter' }, { status: 400 })
  }

  // Parse and verify clientId from state
  let clientId: string
  try {
    const decoded = JSON.parse(atob(state))
    clientId = decoded.clientId
    if (!clientId) throw new Error('No clientId')
  } catch {
    return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 })
  }

  // Verify the user is authenticated and belongs to this client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized - please log in' }, { status: 401 })
  }

  // Verify user has access to this client (via RLS)
  const { data: clientAccess, error: accessError } = await supabase
    .from('client_users')
    .select('id, role')
    .eq('client_id', clientId)
    .eq('user_id', user.id)
    .single()

  if (accessError || !clientAccess) {
    return NextResponse.json({ error: 'Access denied to this client' }, { status: 403 })
  }

  // Only owners and admins can connect integrations
  if (!['owner', 'admin'].includes(clientAccess.role)) {
    return NextResponse.json(
      { error: 'Only client owners and admins can connect integrations' },
      { status: 403 }
    )
  }

  // Clean and validate shop domain
  let shopDomain = shop.trim().toLowerCase()

  // Remove protocol if present
  shopDomain = shopDomain.replace(/^https?:\/\//, '')

  // Add .myshopify.com if not present
  if (!shopDomain.includes('.myshopify.com')) {
    shopDomain = `${shopDomain}.myshopify.com`
  }

  // Validate shop domain format
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shopDomain)) {
    return NextResponse.json({ error: 'Invalid shop domain format' }, { status: 400 })
  }

  // Generate nonce for CSRF protection
  const nonce = crypto.randomBytes(16).toString('hex')

  // Build OAuth URL
  const authUrl = new URL(`https://${shopDomain}/admin/oauth/authorize`)
  authUrl.searchParams.set('client_id', SHOPIFY_CLIENT_ID)
  authUrl.searchParams.set('scope', SHOPIFY_SCOPES)
  authUrl.searchParams.set('redirect_uri', `${APP_URL}/api/integrations/shopify/callback`)
  authUrl.searchParams.set('state', `${nonce}:${state}`)

  // Create response with redirect
  const response = NextResponse.redirect(authUrl.toString())

  // Store nonce in cookie for validation in callback
  response.cookies.set('shopify_oauth_nonce', nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  return response
}
