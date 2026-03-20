import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase-service'

/**
 * GET /api/shipping/fedex/label?path=orderId/tracking.pdf
 *
 * Returns a signed URL for a FedEx label stored in the `shipping-labels` bucket.
 * Small, safe implementation:
 * - Requires authentication
 * - Verifies the label belongs to an existing outbound order (by id prefix)
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const path = url.searchParams.get('path')

    if (!path) {
      return NextResponse.json({ error: 'Missing required query parameter: path' }, { status: 400 })
    }

    // Basic auth check
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

    // Expect path format: "{orderId}/{tracking}.pdf"
    const [orderId] = path.split('/')
    if (!orderId) {
      return NextResponse.json({ error: 'Invalid label path format' }, { status: 400 })
    }

    const serviceSupabase = createServiceClient()

    // Verify the order exists and has a matching label_url
    const { data: order, error: orderError } = await serviceSupabase
      .from('outbound_orders')
      .select('id, label_url')
      .eq('id', orderId)
      .single()

    if (orderError || !order || !order.label_url || order.label_url !== path) {
      return NextResponse.json({ error: 'Label not found for this order' }, { status: 404 })
    }

    // Create a short-lived signed URL for the label
    const { data: signed, error: signError } = await serviceSupabase.storage
      .from('shipping-labels')
      .createSignedUrl(path, 60 * 5) // 5 minutes

    if (signError || !signed?.signedUrl) {
      console.error('Failed to create signed label URL:', signError)
      return NextResponse.json({ error: 'Failed to generate label URL' }, { status: 500 })
    }

    // Redirect so the browser opens the actual PDF URL
    // (the client currently uses `window.open('/api/...')`).
    return NextResponse.redirect(signed.signedUrl)
  } catch (err) {
    console.error('FedEx label download error:', err)
    const message = err instanceof Error ? err.message : 'Failed to generate label URL'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

