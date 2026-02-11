import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase-service'

/**
 * Get products from Shopify store
 * GET /api/integrations/shopify/[integrationId]/products
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  const { integrationId } = await params

  try {
    // Verify user is authenticated
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

    const { data: { user } } = await userSupabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check access to this integration
    const { data: userIntegration } = await userSupabase
      .from('client_integrations')
      .select('id')
      .eq('id', integrationId)
      .single()

    if (!userIntegration) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get integration details with service client
    const supabase = createServiceClient()
    const { data: integration, error } = await supabase
      .from('client_integrations')
      .select('*')
      .eq('id', integrationId)
      .single()

    if (error || !integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    // Fetch products from Shopify
    const products: Array<{
      id: string
      title: string
      variants: Array<{
        id: string
        title: string
        sku: string
        barcode: string | null
        inventory_item_id: string
      }>
      image: { src: string } | null
    }> = []

    let url = `https://${integration.shop_domain}/admin/api/2024-01/products.json?limit=250`

    while (url) {
      const response = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': integration.access_token,
        },
      })

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status}`)
      }

      const data = await response.json()
      products.push(...data.products)

      // Check for pagination
      const linkHeader = response.headers.get('Link')
      const nextLink = linkHeader?.match(/<([^>]+)>;\s*rel="next"/)
      url = nextLink ? nextLink[1] : ''
    }

    // Transform to simpler format
    const shopifyProducts = products.flatMap((product) =>
      product.variants.map((variant) => ({
        productId: String(product.id),
        variantId: String(variant.id),
        title: product.title,
        variantTitle: variant.title !== 'Default Title' ? variant.title : null,
        sku: variant.sku || null,
        barcode: variant.barcode || null,
        inventoryItemId: String(variant.inventory_item_id),
        imageUrl: product.image?.src || null,
      }))
    )

    return NextResponse.json({ products: shopifyProducts })
  } catch (error) {
    console.error('Failed to fetch Shopify products:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch products' },
      { status: 500 }
    )
  }
}
