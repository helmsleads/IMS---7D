/**
 * QuickBooks Online API Client — Server-side only
 *
 * Handles OAuth token management, entity sync (Customers, Invoices, Items, Expenses),
 * and entity mapping between IMS and QB.
 *
 * Follows the same patterns as src/lib/api/fedex.ts:
 * - Encrypted credentials in system_settings
 * - In-memory token cache with auto-refresh
 * - Service client for DB access
 */

import { createServiceClient } from '@/lib/supabase-service'
import { decryptToken, encryptToken } from '@/lib/encryption'
import type { QuickBooksCredentials, QuickBooksAppCredentials, QBEntityMap } from '@/types/database'

// ── Base URLs ────────────────────────────────────────────
const QB_API_URLS = {
  sandbox: 'https://sandbox-quickbooks.api.intuit.com',
  production: 'https://quickbooks.api.intuit.com',
} as const

const QB_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'
const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const QB_REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke'

// ── Token cache ──────────────────────────────────────────
let cachedToken: { token: string; expiresAt: number } | null = null

// ── App Credentials (client_id / secret / webhook verifier) ──

export async function getQBAppCredentials(): Promise<QuickBooksAppCredentials | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('category', 'integrations')
    .eq('setting_key', 'quickbooks_app_credentials')
    .single()

  if (error || !data) return null

  const creds = data.setting_value as QuickBooksAppCredentials
  if (!creds?.client_id) return null

  try {
    creds.client_secret = decryptToken(creds.client_secret)
    if (creds.webhook_verifier) {
      creds.webhook_verifier = decryptToken(creds.webhook_verifier)
    }
  } catch {
    console.error('Failed to decrypt QuickBooks app credentials')
    return null
  }

  return creds
}

export async function saveQBAppCredentials(creds: QuickBooksAppCredentials): Promise<void> {
  const supabase = createServiceClient()

  const encrypted: QuickBooksAppCredentials = {
    ...creds,
    client_secret: encryptToken(creds.client_secret),
    webhook_verifier: creds.webhook_verifier ? encryptToken(creds.webhook_verifier) : '',
  }

  const { error } = await supabase
    .from('system_settings')
    .upsert(
      {
        category: 'integrations',
        setting_key: 'quickbooks_app_credentials',
        setting_value: encrypted as unknown,
        description: 'QuickBooks Online app credentials (Client ID, Secret, Webhook Verifier)',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'category,setting_key' }
    )

  if (error) throw new Error(`Failed to save QB app credentials: ${error.message}`)
}

// ── OAuth Token Credentials ──────────────────────────────

export async function getQBCredentials(): Promise<QuickBooksCredentials | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('category', 'integrations')
    .eq('setting_key', 'quickbooks_credentials')
    .single()

  if (error || !data) return null

  const creds = data.setting_value as QuickBooksCredentials
  if (!creds?.realm_id) return null

  try {
    creds.access_token = decryptToken(creds.access_token)
    creds.refresh_token = decryptToken(creds.refresh_token)
  } catch {
    console.error('Failed to decrypt QuickBooks tokens')
    return null
  }

  return creds
}

export async function saveQBCredentials(creds: QuickBooksCredentials): Promise<void> {
  const supabase = createServiceClient()

  const encrypted: QuickBooksCredentials = {
    ...creds,
    access_token: encryptToken(creds.access_token),
    refresh_token: encryptToken(creds.refresh_token),
  }

  const { error } = await supabase
    .from('system_settings')
    .upsert(
      {
        category: 'integrations',
        setting_key: 'quickbooks_credentials',
        setting_value: encrypted as unknown,
        description: 'QuickBooks Online OAuth credentials',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'category,setting_key' }
    )

  if (error) throw new Error(`Failed to save QB credentials: ${error.message}`)

  cachedToken = null
}

export async function deleteQBCredentials(): Promise<void> {
  const supabase = createServiceClient()

  await supabase
    .from('system_settings')
    .delete()
    .eq('category', 'integrations')
    .eq('setting_key', 'quickbooks_credentials')

  cachedToken = null
}

// ── OAuth Helpers ────────────────────────────────────────

export function getAuthUrl(): string {
  return QB_AUTH_URL
}

export function getTokenUrl(): string {
  return QB_TOKEN_URL
}

export function getRevokeUrl(): string {
  return QB_REVOKE_URL
}

// ── Token Management ─────────────────────────────────────

export async function getAccessToken(creds: QuickBooksCredentials): Promise<string> {
  // Return cached token if still valid (60s buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token
  }

  const expiresAt = new Date(creds.token_expires_at).getTime()

  // If current token is still valid, cache and return
  if (expiresAt > Date.now() + 60_000) {
    cachedToken = { token: creds.access_token, expiresAt }
    return creds.access_token
  }

  // Token expired — refresh it
  return refreshAccessToken(creds)
}

export async function refreshAccessToken(creds: QuickBooksCredentials): Promise<string> {
  const appCreds = await getQBAppCredentials()
  if (!appCreds) {
    throw new Error('QuickBooks app credentials not configured — go to Settings > System')
  }
  const clientId = appCreds.client_id
  const clientSecret = appCreds.client_secret

  const response = await fetch(QB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: creds.refresh_token,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`QB token refresh failed (${response.status}): ${body}`)
  }

  const data = await response.json()

  const now = new Date()
  const tokenExpiresAt = new Date(now.getTime() + (data.expires_in || 3600) * 1000)
  // QB refresh tokens last ~100 days
  const refreshExpiresAt = new Date(now.getTime() + (data.x_refresh_token_expires_in || 8640000) * 1000)

  const updatedCreds: QuickBooksCredentials = {
    ...creds,
    access_token: data.access_token,
    refresh_token: data.refresh_token || creds.refresh_token,
    token_expires_at: tokenExpiresAt.toISOString(),
    refresh_token_expires_at: refreshExpiresAt.toISOString(),
  }

  await saveQBCredentials(updatedCreds)

  cachedToken = {
    token: data.access_token,
    expiresAt: tokenExpiresAt.getTime(),
  }

  return data.access_token
}

// ── Generic API Request ──────────────────────────────────

export async function qbApiRequest<T = Record<string, unknown>>(
  method: 'GET' | 'POST',
  endpoint: string,
  body?: Record<string, unknown>
): Promise<T> {
  const creds = await getQBCredentials()
  if (!creds) throw new Error('QuickBooks is not connected')

  const token = await getAccessToken(creds)
  const baseUrl = QB_API_URLS[creds.environment]
  const url = `${baseUrl}/v3/company/${creds.realm_id}/${endpoint}`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  }

  if (body) {
    headers['Content-Type'] = 'application/json'
  }

  let response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  // Auto-retry on 401 with refreshed token
  if (response.status === 401) {
    const newToken = await refreshAccessToken(creds)
    headers.Authorization = `Bearer ${newToken}`
    response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`QB API error (${response.status}): ${errorBody}`)
  }

  return response.json() as Promise<T>
}

// ── Entity Mapping ───────────────────────────────────────

export async function getMapping(
  entityType: QBEntityMap['entity_type'],
  imsEntityId: string
): Promise<QBEntityMap | null> {
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('qb_entity_map')
    .select('*')
    .eq('entity_type', entityType)
    .eq('ims_entity_id', imsEntityId)
    .single()

  return data as QBEntityMap | null
}

export async function getMappingByQBId(
  entityType: QBEntityMap['entity_type'],
  qbEntityId: string
): Promise<QBEntityMap | null> {
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('qb_entity_map')
    .select('*')
    .eq('entity_type', entityType)
    .eq('qb_entity_id', qbEntityId)
    .single()

  return data as QBEntityMap | null
}

export async function upsertMapping(
  entityType: QBEntityMap['entity_type'],
  imsEntityId: string,
  qbEntityId: string,
  syncToken?: string
): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('qb_entity_map')
    .upsert(
      {
        entity_type: entityType,
        ims_entity_id: imsEntityId,
        qb_entity_id: qbEntityId,
        qb_sync_token: syncToken || null,
        last_synced_at: new Date().toISOString(),
        sync_status: 'synced',
        sync_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'entity_type,ims_entity_id' }
    )

  if (error) throw new Error(`Failed to upsert mapping: ${error.message}`)
}

async function markMappingError(
  entityType: QBEntityMap['entity_type'],
  imsEntityId: string,
  errorMsg: string
): Promise<void> {
  const supabase = createServiceClient()

  await supabase
    .from('qb_entity_map')
    .update({
      sync_status: 'error',
      sync_error: errorMsg,
      updated_at: new Date().toISOString(),
    })
    .eq('entity_type', entityType)
    .eq('ims_entity_id', imsEntityId)
}

// ── Account Mappings ─────────────────────────────────────

export interface QBAccountMappings {
  income_account_id: string | null
  income_account_name: string | null
  expense_account_id: string | null
  expense_account_name: string | null
  shipping_expense_account_id: string | null
  shipping_expense_account_name: string | null
  bank_account_id: string | null
  bank_account_name: string | null
}

export async function getAccountMappings(): Promise<QBAccountMappings> {
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('category', 'integrations')
    .eq('setting_key', 'quickbooks_account_mappings')
    .single()

  if (!data) {
    return {
      income_account_id: null,
      income_account_name: null,
      expense_account_id: null,
      expense_account_name: null,
      shipping_expense_account_id: null,
      shipping_expense_account_name: null,
      bank_account_id: null,
      bank_account_name: null,
    }
  }

  return data.setting_value as QBAccountMappings
}

export async function saveAccountMappings(mappings: QBAccountMappings): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('system_settings')
    .upsert(
      {
        category: 'integrations',
        setting_key: 'quickbooks_account_mappings',
        setting_value: mappings as unknown,
        description: 'QuickBooks account mappings for income/expense',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'category,setting_key' }
    )

  if (error) throw new Error(`Failed to save account mappings: ${error.message}`)
}

// ── Client → QB Customer Sync ────────────────────────────

export async function syncClientToQB(clientId: string): Promise<{ qbCustomerId: string }> {
  const supabase = createServiceClient()

  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()

  if (error || !client) throw new Error('Client not found')

  // Check for existing mapping
  const existing = await getMapping('customer', clientId)

  // Split contact name into first/last
  const nameParts = (client.contact_name || '').split(' ')
  const givenName = nameParts[0] || client.company_name
  const familyName = nameParts.slice(1).join(' ') || ''

  const customerData: Record<string, unknown> = {
    CompanyName: client.company_name,
    DisplayName: client.company_name,
    GivenName: givenName.slice(0, 25), // QB max 25 chars
    FamilyName: familyName.slice(0, 25),
    PrimaryEmailAddr: client.email ? { Address: client.email } : undefined,
    PrimaryPhone: client.phone ? { FreeFormNumber: client.phone } : undefined,
    BillAddr: client.address_line1
      ? {
          Line1: client.address_line1,
          Line2: client.address_line2 || undefined,
          City: client.city || undefined,
          CountrySubDivisionCode: client.state || undefined,
          PostalCode: client.zip || undefined,
          Country: 'US',
        }
      : undefined,
  }

  let result: Record<string, unknown>

  if (existing) {
    // Update existing customer
    customerData.Id = existing.qb_entity_id
    customerData.SyncToken = existing.qb_sync_token || '0'
    customerData.sparse = true

    const response = await qbApiRequest<Record<string, unknown>>('POST', 'customer', customerData)
    result = (response as Record<string, Record<string, unknown>>).Customer as Record<string, unknown>
  } else {
    // Create new customer
    const response = await qbApiRequest<Record<string, unknown>>('POST', 'customer', customerData)
    result = (response as Record<string, Record<string, unknown>>).Customer as Record<string, unknown>
  }

  const qbCustomerId = String(result.Id)
  const syncToken = String(result.SyncToken || '0')

  await upsertMapping('customer', clientId, qbCustomerId, syncToken)

  // Update client record with QB ID
  await supabase
    .from('clients')
    .update({ qb_customer_id: qbCustomerId })
    .eq('id', clientId)

  return { qbCustomerId }
}

// ── Rate Card → QB Item Sync ─────────────────────────────

export async function syncRateCardToQB(rateCardId: string): Promise<{ qbItemId: string }> {
  const supabase = createServiceClient()

  const { data: rate, error } = await supabase
    .from('client_rate_cards')
    .select('*')
    .eq('id', rateCardId)
    .single()

  if (error || !rate) throw new Error('Rate card not found')

  const accountMappings = await getAccountMappings()
  const existing = await getMapping('item', rateCardId)

  const itemData: Record<string, unknown> = {
    Name: rate.rate_name.slice(0, 100), // QB max 100 chars
    Description: rate.description || `${rate.rate_category} - ${rate.rate_code}`,
    UnitPrice: rate.unit_price,
    Type: 'Service',
    IncomeAccountRef: accountMappings.income_account_id
      ? { value: accountMappings.income_account_id, name: accountMappings.income_account_name }
      : { value: '1', name: 'Services' },
  }

  if (existing) {
    itemData.Id = existing.qb_entity_id
    itemData.SyncToken = existing.qb_sync_token || '0'
    itemData.sparse = true
  }

  const response = await qbApiRequest<Record<string, unknown>>('POST', 'item', itemData)
  const result = (response as Record<string, Record<string, unknown>>).Item as Record<string, unknown>

  const qbItemId = String(result.Id)
  await upsertMapping('item', rateCardId, qbItemId, String(result.SyncToken || '0'))

  return { qbItemId }
}

// ── Service → QB Item Sync ───────────────────────────────

export async function syncServiceToQB(serviceId: string): Promise<{ qbItemId: string }> {
  const supabase = createServiceClient()

  const { data: service, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', serviceId)
    .single()

  if (error || !service) throw new Error('Service not found')

  const accountMappings = await getAccountMappings()
  const existing = await getMapping('item', `service-${serviceId}`)

  const itemData: Record<string, unknown> = {
    Name: service.name.slice(0, 100),
    Description: service.description || service.name,
    UnitPrice: service.base_price || 0,
    Type: 'Service',
    IncomeAccountRef: accountMappings.income_account_id
      ? { value: accountMappings.income_account_id, name: accountMappings.income_account_name }
      : { value: '1', name: 'Services' },
  }

  if (existing) {
    itemData.Id = existing.qb_entity_id
    itemData.SyncToken = existing.qb_sync_token || '0'
    itemData.sparse = true
  }

  const response = await qbApiRequest<Record<string, unknown>>('POST', 'item', itemData)
  const result = (response as Record<string, Record<string, unknown>>).Item as Record<string, unknown>

  const qbItemId = String(result.Id)
  await upsertMapping('item', `service-${serviceId}`, qbItemId, String(result.SyncToken || '0'))

  return { qbItemId }
}

// ── Invoice → QB Invoice Sync ────────────────────────────

export async function syncInvoiceToQB(invoiceId: string): Promise<{ qbInvoiceId: string }> {
  const supabase = createServiceClient()

  // Fetch invoice with items and client
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*, client:clients(*), items:invoice_items(*)')
    .eq('id', invoiceId)
    .single()

  if (error || !invoice) throw new Error('Invoice not found')

  // Ensure client is synced to QB
  let qbCustomerId = invoice.client?.qb_customer_id
  if (!qbCustomerId) {
    const customerResult = await syncClientToQB(invoice.client_id)
    qbCustomerId = customerResult.qbCustomerId
  }

  // Build line items
  const lines: Record<string, unknown>[] = []
  const items = (invoice.items || []) as Array<{
    id: string
    description: string
    quantity: number
    unit_price: number
    total: number
    service_id: string | null
  }>

  for (const item of items) {
    const line: Record<string, unknown> = {
      Amount: item.total,
      DetailType: 'SalesItemLineDetail',
      Description: item.description,
      SalesItemLineDetail: {
        Qty: item.quantity,
        UnitPrice: item.unit_price,
      },
    }

    // Try to link to a QB Item if the invoice item references a service/rate card
    if (item.service_id) {
      const itemMapping = await getMapping('item', `service-${item.service_id}`)
      if (itemMapping) {
        (line.SalesItemLineDetail as Record<string, unknown>).ItemRef = {
          value: itemMapping.qb_entity_id,
        }
      }
    }

    lines.push(line)
  }

  const existing = await getMapping('invoice', invoiceId)

  const invoiceData: Record<string, unknown> = {
    CustomerRef: { value: qbCustomerId },
    DocNumber: invoice.invoice_number,
    DueDate: invoice.due_date?.split('T')[0] || undefined,
    TxnDate: invoice.sent_at?.split('T')[0] || invoice.period_start?.split('T')[0] || undefined,
    Line: lines,
    CustomerMemo: invoice.notes ? { value: invoice.notes } : undefined,
  }

  // Add tax if present
  if (invoice.tax_amount && invoice.tax_amount > 0) {
    invoiceData.TxnTaxDetail = {
      TotalTax: invoice.tax_amount,
    }
  }

  if (existing) {
    invoiceData.Id = existing.qb_entity_id
    invoiceData.SyncToken = existing.qb_sync_token || '0'
    invoiceData.sparse = true
  }

  try {
    const response = await qbApiRequest<Record<string, unknown>>('POST', 'invoice', invoiceData)
    const result = (response as Record<string, Record<string, unknown>>).Invoice as Record<string, unknown>

    const qbInvoiceId = String(result.Id)
    await upsertMapping('invoice', invoiceId, qbInvoiceId, String(result.SyncToken || '0'))

    // Update invoice record
    await supabase
      .from('invoices')
      .update({
        qb_invoice_id: qbInvoiceId,
        qb_synced_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)

    return { qbInvoiceId }
  } catch (err) {
    await markMappingError('invoice', invoiceId, err instanceof Error ? err.message : 'Unknown error')
    throw err
  }
}

// ── Shipping Cost → QB Expense ───────────────────────────

export async function syncShippingExpense(orderId: string): Promise<{ qbExpenseId: string }> {
  const supabase = createServiceClient()

  const { data: order, error } = await supabase
    .from('outbound_orders')
    .select('id, order_number, shipping_cost, client_id, shipped_date, carrier, tracking_number, client:clients(company_name, qb_customer_id)')
    .eq('id', orderId)
    .single()

  if (error || !order) throw new Error('Order not found')
  if (!order.shipping_cost || order.shipping_cost <= 0) {
    throw new Error('No shipping cost to sync')
  }

  const accountMappings = await getAccountMappings()
  const existing = await getMapping('expense', `shipping-${orderId}`)

  const expenseData: Record<string, unknown> = {
    PaymentType: 'Cash',
    TxnDate: order.shipped_date?.split('T')[0] || new Date().toISOString().split('T')[0],
    PrivateNote: `Shipping cost for order ${order.order_number} - ${order.carrier || 'FedEx'} ${order.tracking_number || ''}`.trim(),
    Line: [
      {
        Amount: order.shipping_cost,
        DetailType: 'AccountBasedExpenseLineDetail',
        AccountBasedExpenseLineDetail: {
          AccountRef: accountMappings.shipping_expense_account_id
            ? { value: accountMappings.shipping_expense_account_id, name: accountMappings.shipping_expense_account_name }
            : { value: '1', name: 'Shipping Expense' },
        },
      },
    ],
    AccountRef: accountMappings.bank_account_id
      ? { value: accountMappings.bank_account_id, name: accountMappings.bank_account_name }
      : { value: '1', name: 'Checking' },
  }

  if (existing) {
    expenseData.Id = existing.qb_entity_id
    expenseData.SyncToken = existing.qb_sync_token || '0'
    expenseData.sparse = true
  }

  const response = await qbApiRequest<Record<string, unknown>>('POST', 'purchase', expenseData)
  const result = (response as Record<string, Record<string, unknown>>).Purchase as Record<string, unknown>

  const qbExpenseId = String(result.Id)
  await upsertMapping('expense', `shipping-${orderId}`, qbExpenseId, String(result.SyncToken || '0'))

  return { qbExpenseId }
}

// ── Supply Cost → QB Expense ─────────────────────────────

export async function syncSupplyExpense(orderId: string): Promise<{ qbExpenseId: string }> {
  const supabase = createServiceClient()

  // Get supply usage for this order (using internal cost, not billing rate)
  const { data: usages, error } = await supabase
    .from('supply_usage')
    .select('id, quantity, supply_id, supply:supplies(name, cost)')
    .eq('order_id', orderId)

  if (error || !usages || usages.length === 0) {
    throw new Error('No supply usage found for this order')
  }

  // Get the order for context
  const { data: order } = await supabase
    .from('outbound_orders')
    .select('order_number, shipped_date')
    .eq('id', orderId)
    .single()

  const accountMappings = await getAccountMappings()
  const existing = await getMapping('expense', `supply-${orderId}`)

  // Build line items from supply usage
  const lines: Record<string, unknown>[] = []
  let totalCost = 0

  for (const usage of usages) {
    const supply = usage.supply as unknown as { name: string; cost: number } | null
    const cost = (supply?.cost || 0) * usage.quantity
    totalCost += cost

    lines.push({
      Amount: cost,
      DetailType: 'AccountBasedExpenseLineDetail',
      Description: `${supply?.name || 'Supply'} x${usage.quantity}`,
      AccountBasedExpenseLineDetail: {
        AccountRef: accountMappings.expense_account_id
          ? { value: accountMappings.expense_account_id, name: accountMappings.expense_account_name }
          : { value: '1', name: 'Cost of Goods Sold' },
      },
    })
  }

  if (totalCost <= 0) {
    throw new Error('Supply costs total to zero')
  }

  const expenseData: Record<string, unknown> = {
    PaymentType: 'Cash',
    TxnDate: order?.shipped_date?.split('T')[0] || new Date().toISOString().split('T')[0],
    PrivateNote: `Supply costs for order ${order?.order_number || orderId}`,
    Line: lines,
    AccountRef: accountMappings.bank_account_id
      ? { value: accountMappings.bank_account_id, name: accountMappings.bank_account_name }
      : { value: '1', name: 'Checking' },
  }

  if (existing) {
    expenseData.Id = existing.qb_entity_id
    expenseData.SyncToken = existing.qb_sync_token || '0'
    expenseData.sparse = true
  }

  const response = await qbApiRequest<Record<string, unknown>>('POST', 'purchase', expenseData)
  const result = (response as Record<string, Record<string, unknown>>).Purchase as Record<string, unknown>

  const qbExpenseId = String(result.Id)
  await upsertMapping('expense', `supply-${orderId}`, qbExpenseId, String(result.SyncToken || '0'))

  return { qbExpenseId }
}
