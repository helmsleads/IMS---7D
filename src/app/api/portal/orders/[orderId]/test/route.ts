import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase-service'
import { mergePortalTestOrderNote } from '@/lib/api/shopify/order-tag'

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

/**
 * POST /api/portal/orders/[orderId]/test
 * Body: { test: boolean }
 *
 * Marks or clears a test order from the client portal (`[test:portal]` in notes).
 * Shopify Admin tag "test" continues to set `[test]` via webhooks.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orderId } = await context.params
    if (!orderId) {
      return NextResponse.json({ error: 'orderId required' }, { status: 400 })
    }

    let body: { test?: boolean }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (typeof body.test !== 'boolean') {
      return NextResponse.json({ error: 'test must be a boolean' }, { status: 400 })
    }

    const clientId = await resolvePortalClientId(user.id, user.email)
    if (!clientId) {
      return NextResponse.json(
        { error: 'Not associated with a client' },
        { status: 403 }
      )
    }

    const service = createServiceClient()
    const { data: allowedIds, error: rpcError } = await service.rpc(
      'get_client_order_ids',
      { p_client_id: clientId }
    )

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    const allowed = Array.isArray(allowedIds)
      ? allowedIds.map((id) => String(id))
      : []

    if (!allowed.includes(orderId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { data: order, error: orderError } = await service
      .from('outbound_orders')
      .select('id, notes, status')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Cancelled orders cannot be updated' },
        { status: 400 }
      )
    }

    const notes = mergePortalTestOrderNote(order.notes, body.test)

    const { data: updated, error: updateError } = await service
      .from('outbound_orders')
      .update({ notes })
      .eq('id', orderId)
      .select('id, notes')
      .single()

    if (updateError || !updated) {
      return NextResponse.json(
        { error: updateError?.message || 'Failed to update order' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      test: body.test,
      notes: updated.notes,
    })
  } catch (err) {
    console.error('Portal test order update failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update test flag' },
      { status: 500 }
    )
  }
}
