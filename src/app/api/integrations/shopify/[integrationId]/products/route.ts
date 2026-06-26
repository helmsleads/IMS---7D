import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase-service'
import { createShopifyClientForIntegration } from '@/lib/api/shopify/tokens'
import { fetchProductsForIntegrationMapping } from '@/lib/api/shopify/graphql/products-mapping'

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

    if (!integration.access_token || !integration.shop_domain) {
      return NextResponse.json({ error: 'Integration not properly configured' }, { status: 400 })
    }

    const client = await createShopifyClientForIntegration(integration)
    const shopifyProducts = await fetchProductsForIntegrationMapping(client)

    return NextResponse.json({ products: shopifyProducts })
  } catch (error) {
    console.error('Failed to fetch Shopify products:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch products' },
      { status: 500 }
    )
  }
}
