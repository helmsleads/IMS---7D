import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase-service'
import { reimportShopifyOrderLineItems, previewShopifyOrderLinesForIms } from '@/lib/api/shopify/order-sync'

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

async function authorizeOrderAccess(
  userId: string,
  email: string | undefined,
  orderId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
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
    return { ok: true }
  }

  const { data: clientUsers } = await service
    .from('client_users')
    .select('client_id')
    .eq('user_id', userId)
    .limit(1)

  const clientId = clientUsers?.[0]?.client_id as string | undefined
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

  return { ok: true }
}

/**
 * GET /api/outbound/[orderId]/reimport-shopify-lines — preview Shopify lines
 * POST — import lines into IMS
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orderId } = await context.params
    const access = await authorizeOrderAccess(user.id, user.email, orderId)
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const preview = await previewShopifyOrderLinesForIms(orderId)
    return NextResponse.json(preview)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to preview Shopify lines',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/outbound/[orderId]/reimport-shopify-lines
 * Import line items from Shopify when the order header exists but has no lines.
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

    const access = await authorizeOrderAccess(user.id, user.email, orderId)
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const result = await reimportShopifyOrderLineItems(orderId)
    return NextResponse.json(result)
  } catch (error) {
    console.error('reimport shopify lines error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to import line items from Shopify',
      },
      { status: 500 }
    )
  }
}
