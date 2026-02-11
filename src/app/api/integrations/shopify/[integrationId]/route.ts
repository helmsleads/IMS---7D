import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase-service'
import { decryptToken } from '@/lib/encryption'

/**
 * Delete/disconnect a Shopify integration
 * DELETE /api/integrations/shopify/[integrationId]
 *
 * This endpoint:
 * 1. Verifies user authentication and authorization
 * 2. Deregisters webhooks from Shopify (cleanup)
 * 3. Deletes the integration record from database
 */
export async function DELETE(
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

    // Check user has access to this integration via RLS
    const { data: userIntegration } = await userSupabase
      .from('client_integrations')
      .select('id, client_id')
      .eq('id', integrationId)
      .single()

    if (!userIntegration) {
      return NextResponse.json({ error: 'Integration not found or access denied' }, { status: 403 })
    }

    // Check user is owner/admin of the client
    const { data: clientAccess } = await userSupabase
      .from('client_users')
      .select('role')
      .eq('client_id', userIntegration.client_id)
      .eq('user_id', user.id)
      .single()

    if (!clientAccess || !['owner', 'admin'].includes(clientAccess.role)) {
      return NextResponse.json({ error: 'Only owners and admins can disconnect integrations' }, { status: 403 })
    }

    // Use service client for operations
    const supabase = createServiceClient()

    // Get full integration details for Shopify cleanup
    const { data: integration } = await supabase
      .from('client_integrations')
      .select('*')
      .eq('id', integrationId)
      .single()

    // Attempt to clean up webhooks in Shopify (best effort - don't fail if this fails)
    if (integration?.access_token && integration?.shop_domain) {
      // Decrypt the access token for Shopify API calls
      const accessToken = decryptToken(integration.access_token)
      await deregisterShopifyWebhooks(integration.shop_domain, accessToken)
    }

    // Delete the integration (product mappings are preserved via FK with SET NULL or kept)
    const { error } = await supabase
      .from('client_integrations')
      .delete()
      .eq('id', integrationId)

    if (error) {
      console.error('Failed to delete integration:', error)
      return NextResponse.json({ error: 'Failed to disconnect integration' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Disconnect failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * Deregister all webhooks from Shopify for this integration
 * This is best-effort - we proceed with disconnect even if this fails
 */
async function deregisterShopifyWebhooks(
  shopDomain: string,
  accessToken: string
): Promise<void> {
  try {
    // Fetch all webhooks registered for this app
    const listResponse = await fetch(
      `https://${shopDomain}/admin/api/2024-01/webhooks.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
        },
      }
    )

    if (!listResponse.ok) {
      console.warn(`Failed to list webhooks (${listResponse.status}), token may be revoked`)
      return
    }

    const { webhooks } = await listResponse.json()

    if (!webhooks || webhooks.length === 0) {
      console.log('No webhooks to deregister')
      return
    }

    // Delete each webhook
    let deleted = 0
    let failed = 0

    for (const webhook of webhooks) {
      try {
        const deleteResponse = await fetch(
          `https://${shopDomain}/admin/api/2024-01/webhooks/${webhook.id}.json`,
          {
            method: 'DELETE',
            headers: {
              'X-Shopify-Access-Token': accessToken,
            },
          }
        )

        if (deleteResponse.ok) {
          deleted++
        } else {
          failed++
          console.warn(`Failed to delete webhook ${webhook.id}: ${deleteResponse.status}`)
        }
      } catch (e) {
        failed++
        console.warn(`Error deleting webhook ${webhook.id}:`, e)
      }
    }

    console.log(`Webhook cleanup: ${deleted} deleted, ${failed} failed out of ${webhooks.length} total`)
  } catch (error) {
    // Don't throw - this is best-effort cleanup
    console.warn('Failed to deregister webhooks:', error)
  }
}
