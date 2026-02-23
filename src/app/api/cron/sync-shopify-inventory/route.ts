import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'
import { syncInventoryToShopify } from '@/lib/api/shopify/inventory-sync'
import { calculateIncomingInventory, syncIncomingToShopify } from '@/lib/api/shopify/incoming-sync'
import { cleanupOldSyncLogs } from '@/lib/api/shopify/sync-logger'

/**
 * Scheduled Inventory Sync to Shopify
 * POST /api/cron/sync-shopify-inventory
 *
 * Syncs inventory from IMS to Shopify for all active integrations
 * with auto_sync_inventory enabled.
 *
 * Trigger with Upstash QStash (recommended):
 * - URL: POST https://your-app.com/api/cron/sync-shopify-inventory
 * - Schedule: 0 * * * * (hourly)
 * - Header: Authorization: Bearer <CRON_SECRET>
 *
 * Security: Requires CRON_SECRET in Authorization header
 */
export async function POST(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('CRON_SECRET not configured')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error('Unauthorized cron request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const supabase = createServiceClient()

  // Clean up old sync logs (>30 days)
  try {
    const cleaned = await cleanupOldSyncLogs()
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} old sync log entries`)
    }
  } catch (cleanupError) {
    console.error('Sync log cleanup failed:', cleanupError)
  }

  try {
    // Get all active Shopify integrations with auto_sync_inventory enabled
    const { data: integrations, error: fetchError } = await supabase
      .from('client_integrations')
      .select('id, client_id, shop_domain, shop_name, settings, last_inventory_sync_at')
      .eq('platform', 'shopify')
      .eq('status', 'active')

    if (fetchError) {
      console.error('Failed to fetch integrations:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 })
    }

    // Filter to only those with auto_sync_inventory enabled
    const autoSyncIntegrations = (integrations || []).filter(
      (i) => i.settings?.auto_sync_inventory === true
    )

    if (autoSyncIntegrations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No integrations with auto-sync enabled',
        processed: 0,
      })
    }

    const results: Array<{
      integrationId: string
      shopDomain: string
      success: boolean
      updated?: number
      failed?: number
      error?: string
    }> = []

    // Process each integration
    for (const integration of autoSyncIntegrations) {
      try {
        // Check if enough time has passed since last sync
        const syncIntervalMinutes = integration.settings?.sync_inventory_interval_minutes || 60
        const lastSync = integration.last_inventory_sync_at
          ? new Date(integration.last_inventory_sync_at)
          : null

        if (lastSync) {
          const minutesSinceLastSync = (Date.now() - lastSync.getTime()) / 60000
          if (minutesSinceLastSync < syncIntervalMinutes) {
            results.push({
              integrationId: integration.id,
              shopDomain: integration.shop_domain,
              success: true,
              updated: 0,
              failed: 0,
              error: `Skipped - last sync was ${Math.round(minutesSinceLastSync)} minutes ago`,
            })
            continue
          }
        }

        // Sync inventory
        const syncResult = await syncInventoryToShopify(integration.id, undefined, 'cron')

        // Also calculate and sync incoming inventory
        try {
          await calculateIncomingInventory(integration.id)
          await syncIncomingToShopify(integration.id)
        } catch (incomingError) {
          console.error(`Failed to sync incoming inventory for ${integration.shop_domain}:`, incomingError)
        }

        results.push({
          integrationId: integration.id,
          shopDomain: integration.shop_domain,
          success: true,
          updated: syncResult.updated,
          failed: syncResult.failed,
        })

        console.log(
          `Synced inventory for ${integration.shop_domain}: ${syncResult.updated} updated, ${syncResult.failed} failed`
        )
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Failed to sync ${integration.shop_domain}:`, error)

        results.push({
          integrationId: integration.id,
          shopDomain: integration.shop_domain,
          success: false,
          error: errorMessage,
        })

        // Update integration with error
        await supabase
          .from('client_integrations')
          .update({
            last_error_at: new Date().toISOString(),
            last_error_message: `Scheduled sync failed: ${errorMessage}`,
          })
          .eq('id', integration.id)
      }

      // Small delay between integrations to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    const duration = Date.now() - startTime
    const successCount = results.filter((r) => r.success).length
    const failCount = results.filter((r) => !r.success).length
    const totalUpdated = results.reduce((sum, r) => sum + (r.updated || 0), 0)

    console.log(
      `Inventory sync completed: ${successCount} succeeded, ${failCount} failed, ${totalUpdated} products updated in ${duration}ms`
    )

    return NextResponse.json({
      success: true,
      processed: results.length,
      succeeded: successCount,
      failed: failCount,
      totalUpdated,
      duration: `${duration}ms`,
      results,
    })
  } catch (error) {
    console.error('Cron job failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cron job failed' },
      { status: 500 }
    )
  }
}

// GET for health checks (no auth required)
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/cron/sync-shopify-inventory',
    method: 'POST',
    auth: 'Bearer <CRON_SECRET>',
    description: 'Syncs inventory to Shopify for all active integrations',
  })
}
