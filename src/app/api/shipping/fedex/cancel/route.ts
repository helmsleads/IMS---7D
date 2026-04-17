import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase-service'
import { getFedExCredentials, cancelShipment } from '@/lib/api/fedex'

/**
 * POST /api/shipping/fedex/cancel — Void a FedEx label/shipment (before tender)
 *
 * Body: { orderId: string, trackingNumber: string }
 */
export async function POST(request: NextRequest) {
  try {
    const userSupabase = createServerClient(
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
    } = await userSupabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orderId, trackingNumber } = body as { orderId?: string; trackingNumber?: string }

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'Invalid or missing orderId' }, { status: 400 })
    }
    if (!trackingNumber || typeof trackingNumber !== 'string') {
      return NextResponse.json({ error: 'Invalid or missing trackingNumber' }, { status: 400 })
    }

    const credentials = await getFedExCredentials()
    if (!credentials) {
      return NextResponse.json(
        { error: 'FedEx is not configured. Go to Settings > System to add credentials.' },
        { status: 400 }
      )
    }

    const serviceSupabase = createServiceClient()
    const { data: order, error: orderError } = await serviceSupabase
      .from('outbound_orders')
      .select('id, status, tracking_number, shipping_method, fedex_shipment_id')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.status === 'delivered') {
      return NextResponse.json(
        { error: 'Cannot cancel FedEx after the order is marked delivered.' },
        { status: 400 }
      )
    }

    const tn = trackingNumber.trim()
    const dbTn = (order.tracking_number || '').trim()
    if (order.shipping_method !== 'fedex_api' || !dbTn || dbTn !== tn) {
      return NextResponse.json(
        { error: 'This order does not have a matching FedEx API shipment to cancel.' },
        { status: 400 }
      )
    }

    await cancelShipment(tn, credentials)

    // If the order was already marked shipped, revert it back to packed
    const statusRevert = order.status === 'shipped' ? { status: 'packed' } : {}

    const { error: updateError } = await serviceSupabase
      .from('outbound_orders')
      .update({
        fedex_shipment_id: null,
        label_url: null,
        tracking_number: null,
        carrier: null,
        shipping_method: 'fedex_voided',
        shipping_cost: null,
        client_shipping_cost: null,
        shipped_date: order.status === 'shipped' ? null : undefined,
        ...statusRevert,
      })
      .eq('id', orderId)

    if (updateError) {
      console.error('FedEx cancel: order update failed after API success:', updateError)
      return NextResponse.json(
        { error: 'FedEx shipment was cancelled but updating the order failed. Refresh the page and verify the order.' },
        { status: 502 }
      )
    }

    try {
      await serviceSupabase.from('fedex_shipment_log').insert({
        outbound_order_id: orderId,
        action: 'cancel',
        request_payload: { orderId, trackingNumber: tn },
        response_payload: { cancelled: true },
        error_message: null,
      })
    } catch {
      // ignore audit log errors
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('FedEx shipment cancel error:', err)
    const message = err instanceof Error ? err.message : 'Failed to cancel FedEx shipment'
    const isAuth =
      typeof message === 'string' &&
      (message.toLowerCase().includes('authorize your credentials') ||
        message.toLowerCase().includes('oauth failed') ||
        message.toLowerCase().includes('authentication') ||
        message.toLowerCase().includes('unauthorized'))

    return NextResponse.json(
      {
        error: message,
        hint: isAuth
          ? 'FedEx rejected your credentials. Confirm Settings > System > FedEx credentials are correct and the environment matches (Sandbox vs Production). If running locally, you can set FEDEX_SANDBOX=true to force sandbox.'
          : null,
      },
      { status: isAuth ? 400 : 502 }
    )
  }
}
