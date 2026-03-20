import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase-service'
import { getFedExCredentials, getRates } from '@/lib/api/fedex'

/**
 * POST /api/shipping/fedex/rates
 *
 * Body: { orderId, packageWeight, packageLength?, packageWidth?, packageHeight?, shipDate }
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { orderId, packageWeight, shipDate } = body as {
      orderId?: string
      packageWeight?: number | string
      shipDate?: string
    }

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'Invalid or missing orderId' }, { status: 400 })
    }

    const weightNumber = typeof packageWeight === 'number' ? packageWeight : Number(packageWeight)
    if (!Number.isFinite(weightNumber) || weightNumber <= 0) {
      return NextResponse.json({ error: 'Invalid packageWeight' }, { status: 400 })
    }

    const shipDateValue = shipDate || new Date().toISOString().split('T')[0]

    const credentials = await getFedExCredentials()
    if (!credentials) {
      return NextResponse.json({ error: 'FedEx is not configured. Go to Settings > System to add credentials.' }, { status: 400 })
    }

    const serviceSupabase = createServiceClient()

    // Load order to get destination postal/country; use service client to avoid RLS issues server-side
    const { data: order, error: orderError } = await serviceSupabase
      .from('outbound_orders')
      .select('id, ship_to_zip, ship_to_country')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (!order.ship_to_zip) {
      return NextResponse.json({ error: 'Order is missing destination postal code' }, { status: 400 })
    }

    const rates = await getRates(
      {
        shipDate: shipDateValue,
        weightLbs: weightNumber,
        shipperPostalCode: credentials.shipper_zip,
        shipperCountryCode: credentials.shipper_country || 'US',
        recipientPostalCode: order.ship_to_zip,
        recipientCountryCode: order.ship_to_country || 'US',
      },
      credentials
    )

    // Audit log (best-effort; don't fail the request if log fails)
    try {
      await serviceSupabase.from('fedex_shipment_log').insert({
        outbound_order_id: orderId,
        action: 'rate',
        request_payload: {
          orderId,
          shipDate: shipDateValue,
          weightLbs: weightNumber,
          recipientPostalCode: order.ship_to_zip,
          recipientCountryCode: order.ship_to_country || 'US',
        },
        response_payload: rates as unknown,
        error_message: null,
      })
    } catch (_) {
      // ignore audit log errors
    }

    return NextResponse.json(rates)
  } catch (err) {
    console.error('FedEx rates error:', err)
    const message = err instanceof Error ? err.message : 'Failed to get FedEx rates'
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

