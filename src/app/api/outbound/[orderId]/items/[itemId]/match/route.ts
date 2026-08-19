import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase-service'
import { matchUnmatchedOutboundItem } from '@/lib/api/shopify/match-outbound-item'

async function getAuthUser(request: NextRequest) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

async function resolvePortalClientId(userId: string, email?: string | null) {
  const service = createServiceClient()

  const { data: clientUsers } = await service
    .from('client_users')
    .select('client_id, is_primary')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false })
    .limit(1)

  if (clientUsers?.[0]?.client_id) {
    return clientUsers[0].client_id as string
  }

  if (email) {
    const { data: profile } = await service
      .from('user_profiles')
      .select('id')
      .ilike('email', email)
      .maybeSingle()

    if (profile?.id) {
      const { data: byProfile } = await service
        .from('client_users')
        .select('client_id')
        .eq('user_id', profile.id)
        .limit(1)
        .maybeSingle()
      if (byProfile?.client_id) return byProfile.client_id as string
    }
  }

  const { data: legacy } = await service
    .from('clients')
    .select('id')
    .eq('auth_id', userId)
    .limit(1)
    .maybeSingle()

  return (legacy?.id as string | undefined) ?? null
}

async function authorizeOrderAccess(
  userId: string,
  email: string | undefined,
  orderId: string
): Promise<{ ok: true; isStaff: boolean } | { ok: false; status: number; error: string }> {
  const service = createServiceClient()

  const { data: internalUser } = await service
    .from('users')
    .select('role, active')
    .eq('id', userId)
    .maybeSingle()

  if (
    internalUser?.active &&
    (internalUser.role === 'admin' || internalUser.role === 'staff')
  ) {
    const { data: order } = await service
      .from('outbound_orders')
      .select('id')
      .eq('id', orderId)
      .maybeSingle()

    if (!order) {
      return { ok: false, status: 404, error: 'Order not found' }
    }
    return { ok: true, isStaff: true }
  }

  const clientId = await resolvePortalClientId(userId, email)
  if (!clientId) {
    return { ok: false, status: 403, error: 'Not associated with a client' }
  }

  const { data: allowedIds, error: rpcError } = await service.rpc(
    'get_client_order_ids',
    { p_client_id: clientId }
  )

  if (rpcError) {
    return { ok: false, status: 500, error: rpcError.message }
  }

  const allowed = Array.isArray(allowedIds)
    ? allowedIds.map((id) => String(id))
    : []

  if (!allowed.includes(orderId)) {
    return { ok: false, status: 403, error: 'Access denied' }
  }

  return { ok: true, isStaff: false }
}

/**
 * POST /api/outbound/[orderId]/items/[itemId]/match
 * Body: { product_id: string }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string; itemId: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orderId, itemId } = await context.params
    const body = (await request.json()) as { product_id?: string }
    const productId = String(body.product_id || '').trim()

    if (!orderId || !itemId || !productId) {
      return NextResponse.json(
        { error: 'orderId, itemId, and product_id are required' },
        { status: 400 }
      )
    }

    const access = await authorizeOrderAccess(user.id, user.email, orderId)
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const result = await matchUnmatchedOutboundItem({
      orderId,
      itemId,
      imsProductId: productId,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('match outbound item error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to match product' },
      { status: 500 }
    )
  }
}
