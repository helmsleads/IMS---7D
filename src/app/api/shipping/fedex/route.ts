import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase-service'
import { getFedExCredentials, createShipment } from '@/lib/api/fedex'
import { getQBCredentials, syncShippingExpense } from '@/lib/api/quickbooks'

/**
 * GET /api/shipping/fedex — Check if FedEx is configured
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

    const credentials = await getFedExCredentials()
    return NextResponse.json({
      configured: !!credentials,
      environment: credentials?.environment || null,
    })
  } catch (err) {
    console.error('FedEx config check error:', err)
    return NextResponse.json({ configured: false, environment: null })
  }
}

/**
 * POST /api/shipping/fedex — Create FedEx shipment
 *
 * Body: { orderId, serviceType, packageWeight, packageLength?, packageWidth?, packageHeight?, isAlcohol, shipDate }
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
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
    const { orderId, serviceType, packageWeight, packageLength, packageWidth, packageHeight, isAlcohol, shipDate } = body

    // Small, safe validation
    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'Invalid or missing orderId' }, { status: 400 })
    }
    if (!serviceType || typeof serviceType !== 'string') {
      return NextResponse.json({ error: 'Invalid or missing serviceType' }, { status: 400 })
    }
    const weightNumber = typeof packageWeight === 'number' ? packageWeight : Number(packageWeight)
    if (!Number.isFinite(weightNumber) || weightNumber <= 0) {
      return NextResponse.json({ error: 'Invalid packageWeight' }, { status: 400 })
    }

    // Load FedEx credentials
    const credentials = await getFedExCredentials()
    if (!credentials) {
      return NextResponse.json({ error: 'FedEx is not configured. Go to Settings > System to add credentials.' }, { status: 400 })
    }

    // Fetch order details for recipient address
    const serviceSupabase = createServiceClient()
    const { data: order, error: orderError } = await serviceSupabase
      .from('outbound_orders')
      .select('id, order_number, ship_to_name, ship_to_company, ship_to_address, ship_to_address2, ship_to_city, ship_to_state, ship_to_zip, ship_to_country, ship_to_phone, fedex_shipment_id, tracking_number, label_url, shipping_method')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const missingFields: string[] = []
    if (!order.ship_to_address) missingFields.push('ship_to_address')
    if (!order.ship_to_city) missingFields.push('ship_to_city')
    if (!order.ship_to_state) missingFields.push('ship_to_state')
    if (!order.ship_to_zip) missingFields.push('ship_to_zip')

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: 'Order is missing ship-to address fields', missingFields },
        { status: 400 }
      )
    }

    // Idempotency: if shipment already created for this order, return existing
    if (order.shipping_method === 'fedex_api' && order.fedex_shipment_id && order.tracking_number) {
      return NextResponse.json({
        trackingNumber: order.tracking_number,
        labelUrl: order.label_url || null,
        shipmentId: order.fedex_shipment_id,
        actualCost: null,
        listCost: null,
      })
    }

    // Create FedEx shipment
    const result = await createShipment(
      {
        orderId,
        serviceType,
        packageWeight: weightNumber,
        packageLength,
        packageWidth,
        packageHeight,
        isAlcohol: isAlcohol ?? false,
        shipDate: shipDate || new Date().toISOString().split('T')[0],
        recipient: {
          name: order.ship_to_name || 'Recipient',
          company: order.ship_to_company || undefined,
          street: order.ship_to_address,
          street2: order.ship_to_address2 || undefined,
          city: order.ship_to_city,
          state: order.ship_to_state,
          zip: order.ship_to_zip,
          country: order.ship_to_country || 'US',
          phone: order.ship_to_phone || credentials.shipper_phone,
        },
      },
      credentials
    )

    // Store label PDF in Supabase Storage
    let labelUrl: string | null = null
    if (result.labelPdfBase64) {
      const labelBuffer = Buffer.from(result.labelPdfBase64, 'base64')
      const labelPath = `${orderId}/${result.trackingNumber}.pdf`

      const { error: uploadError } = await serviceSupabase.storage
        .from('shipping-labels')
        .upload(labelPath, labelBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        })

      if (uploadError) {
        console.error('Failed to upload label:', uploadError)
      } else {
        labelUrl = labelPath
      }
    }

    // Update order with FedEx data + shipping costs
    const orderUpdate: Record<string, unknown> = {
      fedex_shipment_id: result.shipmentId,
      label_url: labelUrl,
      shipping_method: 'fedex_api',
      carrier: 'FedEx',
      tracking_number: result.trackingNumber,
    }
    if (result.actualCost != null) orderUpdate.shipping_cost = result.actualCost
    if (result.listCost != null) orderUpdate.client_shipping_cost = result.listCost

    await serviceSupabase
      .from('outbound_orders')
      .update(orderUpdate)
      .eq('id', orderId)

    // Audit log (best-effort; don't fail the request if log fails)
    try {
      await serviceSupabase.from('fedex_shipment_log').insert({
        outbound_order_id: orderId,
        action: 'create',
        request_payload: {
          orderId,
          serviceType,
          packageWeight: weightNumber,
          packageLength: packageLength ?? null,
          packageWidth: packageWidth ?? null,
          packageHeight: packageHeight ?? null,
          isAlcohol: isAlcohol ?? false,
          shipDate: shipDate || new Date().toISOString().split('T')[0],
        },
        response_payload: {
          trackingNumber: result.trackingNumber,
          shipmentId: result.shipmentId,
          labelUrl,
          actualCost: result.actualCost ?? null,
          listCost: result.listCost ?? null,
        },
        error_message: null,
      })
    } catch (_) {
      // ignore audit log errors
    }

    // Fire-and-forget: sync shipping cost to QuickBooks if connected
    if (result.actualCost != null && result.actualCost > 0) {
      getQBCredentials()
        .then((creds) => {
          if (creds) return syncShippingExpense(orderId)
        })
        .catch((err) => console.warn('QB shipping expense sync failed (non-blocking):', err))
    }

    return NextResponse.json({
      trackingNumber: result.trackingNumber,
      labelUrl,
      shipmentId: result.shipmentId,
      actualCost: result.actualCost ?? null,
      listCost: result.listCost ?? null,
    })
  } catch (err) {
    console.error('FedEx shipment creation error:', err)
    const message = err instanceof Error ? err.message : 'Failed to create FedEx shipment'
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
