import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase-service'
import { getFedExCredentials, trackShipment } from '@/lib/api/fedex'

/**
 * GET /api/shipping/fedex/track?orderId=... or ?trackingNumber=...
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

    const url = new URL(request.url)
    const orderId = url.searchParams.get('orderId')
    const trackingFromQuery = url.searchParams.get('trackingNumber')
    const shipDateFromQuery = url.searchParams.get('shipDate')

    if (!orderId && !trackingFromQuery) {
      return NextResponse.json({ error: 'Provide orderId or trackingNumber' }, { status: 400 })
    }

    const credentials = await getFedExCredentials()
    if (!credentials) {
      return NextResponse.json({ error: 'FedEx is not configured. Go to Settings > System to add credentials.' }, { status: 400 })
    }

    const serviceSupabase = createServiceClient()

    let trackingNumber = trackingFromQuery || ''
    let resolvedOrderId: string | null = null
    let shippedDate: string | null = null

    if (orderId) {
      const { data: order, error: orderError } = await serviceSupabase
        .from('outbound_orders')
        .select('id, tracking_number, shipped_date')
        .eq('id', orderId)
        .single()

      if (orderError || !order || !order.tracking_number) {
        return NextResponse.json({ error: 'Order not found or missing tracking number' }, { status: 404 })
      }

      trackingNumber = order.tracking_number
      resolvedOrderId = order.id
      shippedDate = order.shipped_date ?? null
    }

    if (!trackingNumber) {
      return NextResponse.json({ error: 'Tracking number is required' }, { status: 400 })
    }

    // Basic FedEx tracking validation (12/15/20/22 digits)
    const clean = trackingNumber.replace(/\s/g, '')
    if (!/^\d{12}(\d{3})?(\d{5})?(\d{2})?$/.test(clean) || ![12, 15, 20, 22].includes(clean.length)) {
      return NextResponse.json({ error: 'Invalid FedEx tracking number format' }, { status: 400 })
    }

    // FedEx Track API often works better when providing a shipment date range.
    const rawShipDate = shipDateFromQuery || shippedDate
    const shipDateBegin = rawShipDate ? rawShipDate.split('T')[0] : undefined
    const shipDateEnd = shipDateBegin
    const result = await trackShipment(trackingNumber, credentials, {
      shipDateBegin,
      shipDateEnd,
    })

    // Best-effort: update tracking_status fields on the order
    if (resolvedOrderId) {
      const update: Record<string, unknown> = {
        tracking_status: result.statusDescription,
        tracking_status_updated_at: new Date().toISOString(),
      }
      if (result.actualDelivery) {
        update.delivered_date = result.actualDelivery
      }

      await serviceSupabase
        .from('outbound_orders')
        .update(update)
        .eq('id', resolvedOrderId)

      // Audit log (best-effort; don't fail the request if log fails)
      try {
        await serviceSupabase.from('fedex_shipment_log').insert({
          outbound_order_id: resolvedOrderId,
          action: 'track',
          request_payload: { orderId: resolvedOrderId, trackingNumber },
          response_payload: result as unknown,
          error_message: null,
        })
      } catch (_) {
        // ignore audit log errors
      }
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('FedEx track error:', err)
    const message = err instanceof Error ? err.message : 'Failed to track FedEx shipment'
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
          ? 'FedEx rejected your credentials. Confirm Settings > System > FedEx credentials are correct and the environment matches (Sandbox vs Production). If running locally, set FEDEX_SANDBOX=true to force sandbox.'
          : null,
      },
      { status: isAuth ? 400 : 502 }
    )
  }
}

