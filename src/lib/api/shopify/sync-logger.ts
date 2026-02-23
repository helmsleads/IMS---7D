import { createServiceClient } from '@/lib/supabase-service'
import type { SyncType, SyncDirection, SyncTrigger } from '@/types/database'

interface SyncLogEntry {
  integrationId: string
  syncType: SyncType
  direction: SyncDirection
  triggeredBy: SyncTrigger
  itemsProcessed: number
  itemsFailed: number
  errorDetails?: Array<{ productId?: string; error: string }>
  durationMs?: number
  metadata?: Record<string, unknown>
}

/**
 * Log a sync result to integration_sync_logs (non-blocking).
 * Computes status from items_processed / items_failed.
 */
export function logSyncResult(entry: SyncLogEntry): void {
  const status =
    entry.itemsFailed === 0
      ? 'success'
      : entry.itemsProcessed === 0
        ? 'failed'
        : 'partial'

  const supabase = createServiceClient()

  // Fire-and-forget — don't await so callers aren't blocked
  supabase
    .from('integration_sync_logs')
    .insert({
      integration_id: entry.integrationId,
      sync_type: entry.syncType,
      direction: entry.direction,
      status,
      items_processed: entry.itemsProcessed,
      items_failed: entry.itemsFailed,
      error_details: entry.errorDetails || [],
      duration_ms: entry.durationMs ?? null,
      triggered_by: entry.triggeredBy,
      metadata: entry.metadata || {},
    })
    .then(({ error }) => {
      if (error) {
        console.error('Failed to write sync log:', error.message)
      }
    })
}

/**
 * Delete sync log entries older than 30 days.
 * Call during cron runs to prevent unbounded growth.
 */
export async function cleanupOldSyncLogs(): Promise<number> {
  const supabase = createServiceClient()
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { count, error } = await supabase
    .from('integration_sync_logs')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff)

  if (error) {
    console.error('Failed to clean up old sync logs:', error.message)
    return 0
  }

  return count || 0
}
