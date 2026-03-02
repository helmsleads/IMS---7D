import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase-service'
import { qbApiRequest, getMappingByQBId, getQBAppCredentials } from '@/lib/api/quickbooks'

interface QBWebhookNotification {
  eventNotifications: Array<{
    realmId: string
    dataChangeEvent: {
      entities: Array<{
        name: string  // 'Payment', 'Invoice', etc.
        id: string
        operation: string  // 'Create', 'Update', 'Delete'
        lastUpdated: string
      }>
    }
  }>
}

/**
 * POST /api/webhooks/quickbooks
 * Receives webhook notifications from Intuit
 * Verifies HMAC-SHA256 signature, deduplicates, processes payment events
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()

    // HMAC-SHA256 verification — read verifier from system_settings
    const signature = request.headers.get('intuit-signature')
    const appCreds = await getQBAppCredentials()
    const webhookVerifier = appCreds?.webhook_verifier

    if (!signature || !webhookVerifier) {
      return NextResponse.json({ error: 'Missing signature or webhook verifier not configured' }, { status: 401 })
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookVerifier)
      .update(rawBody)
      .digest('base64')

    if (signature !== expectedSignature) {
      console.error('QB webhook: invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload: QBWebhookNotification = JSON.parse(rawBody)
    const supabase = createServiceClient()

    for (const notification of payload.eventNotifications || []) {
      for (const entity of notification.dataChangeEvent?.entities || []) {
        // Dedup via webhook_events table
        const eventId = `qb-${entity.name}-${entity.id}-${entity.operation}-${entity.lastUpdated}`

        const { data: existing } = await supabase
          .from('webhook_events')
          .select('id')
          .eq('event_id', eventId)
          .eq('platform', 'quickbooks')
          .single()

        if (existing) {
          continue // Already processed
        }

        // Record the event
        await supabase.from('webhook_events').insert({
          platform: 'quickbooks',
          event_type: `${entity.name}.${entity.operation}`,
          event_id: eventId,
          payload: entity as unknown as Record<string, unknown>,
          status: 'processing',
          received_at: new Date().toISOString(),
        })

        // Process Payment events
        if (entity.name === 'Payment' && (entity.operation === 'Create' || entity.operation === 'Update')) {
          try {
            await processPayment(entity.id, supabase)
            await supabase
              .from('webhook_events')
              .update({ status: 'processed', processed_at: new Date().toISOString() })
              .eq('event_id', eventId)
              .eq('platform', 'quickbooks')
          } catch (err) {
            console.error(`QB webhook: failed to process payment ${entity.id}:`, err)
            await supabase
              .from('webhook_events')
              .update({
                status: 'failed',
                error_message: err instanceof Error ? err.message : 'Unknown error',
              })
              .eq('event_id', eventId)
              .eq('platform', 'quickbooks')
          }
        } else {
          // Mark non-payment events as processed (we only handle payments for now)
          await supabase
            .from('webhook_events')
            .update({ status: 'processed', processed_at: new Date().toISOString() })
            .eq('event_id', eventId)
            .eq('platform', 'quickbooks')
        }
      }
    }

    // Intuit expects a 200 response
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('QB webhook error:', err)
    // Still return 200 to prevent Intuit from retrying indefinitely
    return NextResponse.json({ ok: true })
  }
}

/**
 * Fetch the full Payment from QB and update linked IMS invoices
 */
async function processPayment(
  qbPaymentId: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<void> {
  // Fetch the full payment from QB
  const result = await qbApiRequest<Record<string, Record<string, unknown>>>(
    'GET',
    `payment/${qbPaymentId}`
  )

  const payment = result.Payment
  if (!payment) {
    console.warn(`QB payment ${qbPaymentId} not found`)
    return
  }

  // QB Payment has a Line array with LinkedTxn referencing invoices
  const lines = (payment.Line || []) as Array<{
    Amount: number
    LinkedTxn: Array<{ TxnId: string; TxnType: string }>
  }>

  for (const line of lines) {
    for (const txn of line.LinkedTxn || []) {
      if (txn.TxnType === 'Invoice') {
        // Find the IMS invoice mapped to this QB invoice
        const mapping = await getMappingByQBId('invoice', txn.TxnId)
        if (!mapping) continue

        // Update the IMS invoice status to paid
        const { error } = await supabase
          .from('invoices')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            qb_payment_id: qbPaymentId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', mapping.ims_entity_id)
          .in('status', ['sent', 'overdue']) // Only update if not already paid

        if (error) {
          console.error(`Failed to update invoice ${mapping.ims_entity_id}:`, error)
        } else {
          console.log(`QB webhook: marked invoice ${mapping.ims_entity_id} as paid (QB payment ${qbPaymentId})`)
        }
      }
    }
  }
}

/**
 * GET /api/webhooks/quickbooks
 * Intuit sends a GET to verify the webhook URL during setup
 */
export async function GET() {
  return NextResponse.json({ ok: true })
}
