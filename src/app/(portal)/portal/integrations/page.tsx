'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Card from '@/components/ui/Card'
import Toggle from '@/components/ui/Toggle'
import { useClient } from '@/lib/client-auth'
import { getClientIntegrations, updateIntegrationSettings } from '@/lib/api/integrations'
import type { ClientIntegration, IntegrationSyncLog } from '@/types/database'

export default function IntegrationsHubPage() {
  const { client } = useClient()
  const searchParams = useSearchParams()
  const [integrations, setIntegrations] = useState<ClientIntegration[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Check for success/error messages from OAuth callback
  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')

    if (success === 'shopify_connected') {
      setMessage({ type: 'success', text: 'Shopify store connected successfully!' })
    } else if (error) {
      const errorMessages: Record<string, string> = {
        missing_params: 'OAuth failed: Missing required parameters',
        invalid_hmac: 'OAuth failed: Invalid signature',
        invalid_state: 'OAuth failed: Invalid state (try again)',
        token_exchange_failed: 'OAuth failed: Could not get access token',
        save_failed: 'OAuth failed: Could not save integration',
      }
      setMessage({ type: 'error', text: errorMessages[error] || `OAuth failed: ${error}` })
    }
  }, [searchParams])

  // Load integrations
  useEffect(() => {
    async function loadIntegrations() {
      if (!client?.id) return

      setIsLoading(true)
      try {
        const data = await getClientIntegrations(client.id)
        setIntegrations(data)
      } catch (error) {
        console.error('Failed to load integrations:', error)
      }
      setIsLoading(false)
    }

    loadIntegrations()
  }, [client?.id])

  const shopifyIntegration = integrations.find((i) => i.platform === 'shopify')

  const handleRefresh = async () => {
    if (!client?.id) return
    setIsLoading(true)
    try {
      const data = await getClientIntegrations(client.id)
      setIntegrations(data)
    } catch (error) {
      console.error('Failed to refresh:', error)
    }
    setIsLoading(false)
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
        <p className="text-slate-500 mt-1">
          Connect your sales channels to automatically sync orders and inventory
        </p>
      </div>

      {/* Status Messages */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <span>{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            className="text-sm font-medium underline underline-offset-2 hover:no-underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-16 text-slate-500">Loading integrations...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Shopify Card */}
          <ShopifyCard
            integration={shopifyIntegration}
            clientId={client?.id}
            onRefresh={handleRefresh}
          />

          {/* Amazon Coming Soon */}
          <ComingSoonCard
            name="Amazon"
            description="Connect your Amazon Seller Central account"
            iconBg="bg-orange-100"
            iconColor="text-orange-600"
            icon={<AmazonIcon />}
          />

          {/* TikTok Shop Coming Soon */}
          <ComingSoonCard
            name="TikTok Shop"
            description="Sync with your TikTok Shop storefront"
            iconBg="bg-slate-900"
            iconColor="text-white"
            icon={<TikTokIcon />}
          />

          {/* eBay Coming Soon */}
          <ComingSoonCard
            name="eBay"
            description="Connect your eBay seller account"
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
            icon={<EbayIcon />}
          />

          {/* WooCommerce Coming Soon */}
          <ComingSoonCard
            name="WooCommerce"
            description="Sync with your WooCommerce store"
            iconBg="bg-purple-100"
            iconColor="text-purple-600"
            icon={<WooCommerceIcon />}
          />
        </div>
      )}
    </div>
  )
}

/* ─── Shopify Card ─── */

function ShopifyCard({
  integration,
  clientId,
  onRefresh,
}: {
  integration: ClientIntegration | undefined
  clientId: string | undefined
  onRefresh: () => void
}) {
  const isConnected = integration?.status === 'active'

  return (
    <Card padding="none" className="lg:col-span-2">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <ShopifyIcon className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Shopify</h3>
              <p className="text-sm text-slate-500">
                Sync orders and inventory with your Shopify store
              </p>
            </div>
          </div>
          {isConnected ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-50 text-cyan-700">
              Available
            </span>
          )}
        </div>

        <div className="mt-6">
          {isConnected && integration ? (
            <ShopifyConnectedStatus integration={integration} onRefresh={onRefresh} />
          ) : (
            <ShopifyConnectForm clientId={clientId} />
          )}
        </div>
      </div>
    </Card>
  )
}

/* ─── Shopify Connect Form ─── */

function ShopifyConnectForm({ clientId }: { clientId: string | undefined }) {
  const [shopDomain, setShopDomain] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const handleConnect = () => {
    if (!shopDomain || !clientId) return

    setIsConnecting(true)

    let cleanDomain = shopDomain
      .replace('https://', '')
      .replace('http://', '')
      .replace('.myshopify.com', '')
      .replace(/\//g, '')
      .trim()

    const state = btoa(JSON.stringify({ clientId, timestamp: Date.now() }))

    window.location.href = `/api/integrations/shopify/auth?shop=${cleanDomain}&state=${state}`
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-green-700 shadow-sm hover:shadow transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
      >
        Connect Shopify Store
      </button>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Shopify Store URL
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={shopDomain}
            onChange={(e) => setShopDomain(e.target.value)}
            placeholder="your-store-name"
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
            disabled={isConnecting}
          />
          <span className="text-sm text-slate-500">.myshopify.com</span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Enter your store name without the .myshopify.com part
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleConnect}
          disabled={!shopDomain || isConnecting}
          className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-green-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
        >
          {isConnecting ? 'Connecting...' : 'Connect'}
        </button>
        <button
          onClick={() => {
            setShowForm(false)
            setShopDomain('')
          }}
          className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          disabled={isConnecting}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

/* ─── Shopify Connected Status ─── */

function ShopifyConnectedStatus({
  integration,
  onRefresh,
}: {
  integration: ClientIntegration
  onRefresh: () => void
}) {
  const [isSyncingOrders, setIsSyncingOrders] = useState(false)
  const [isSyncingInventory, setIsSyncingInventory] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [autoImportOrders, setAutoImportOrders] = useState(
    integration.settings?.auto_import_orders ?? false
  )
  const [autoSyncInventory, setAutoSyncInventory] = useState(
    integration.settings?.auto_sync_inventory ?? false
  )
  const [autoSyncPrices, setAutoSyncPrices] = useState(
    integration.settings?.auto_sync_prices ?? false
  )
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [syncLogs, setSyncLogs] = useState<IntegrationSyncLog[]>([])
  const [syncLogsTotal, setSyncLogsTotal] = useState(0)
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [showActivity, setShowActivity] = useState(false)
  const [logsOffset, setLogsOffset] = useState(0)

  const fetchSyncLogs = useCallback(async (offset = 0, append = false) => {
    setIsLoadingLogs(true)
    try {
      const res = await fetch(
        `/api/integrations/shopify/${integration.id}/sync-logs?limit=10&offset=${offset}`
      )
      if (res.ok) {
        const data = await res.json()
        setSyncLogs((prev) => (append ? [...prev, ...data.logs] : data.logs))
        setSyncLogsTotal(data.total)
        setLogsOffset(offset + data.logs.length)
      }
    } catch (err) {
      console.error('Failed to fetch sync logs:', err)
    }
    setIsLoadingLogs(false)
  }, [integration.id])

  useEffect(() => {
    fetchSyncLogs()
  }, [fetchSyncLogs])

  const handleSettingChange = async (
    key: 'auto_import_orders' | 'auto_sync_inventory' | 'auto_sync_prices',
    value: boolean
  ) => {
    const prev = key === 'auto_import_orders' ? autoImportOrders
      : key === 'auto_sync_inventory' ? autoSyncInventory
      : autoSyncPrices

    if (key === 'auto_import_orders') setAutoImportOrders(value)
    else if (key === 'auto_sync_inventory') setAutoSyncInventory(value)
    else setAutoSyncPrices(value)

    setIsSavingSettings(true)
    try {
      await updateIntegrationSettings(integration.id, { [key]: value })
    } catch (error) {
      if (key === 'auto_import_orders') setAutoImportOrders(prev)
      else if (key === 'auto_sync_inventory') setAutoSyncInventory(prev)
      else setAutoSyncPrices(prev)
      console.error('Failed to save setting:', error)
    }
    setIsSavingSettings(false)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`
    return date.toLocaleDateString()
  }

  const handleSyncOrders = async () => {
    setIsSyncingOrders(true)
    try {
      const response = await fetch(`/api/integrations/shopify/${integration.id}/sync-orders`, {
        method: 'POST',
      })
      const result = await response.json()
      alert(`Synced ${result.imported} orders, ${result.skipped} skipped, ${result.failed} failed`)
      onRefresh()
      fetchSyncLogs()
    } catch (error) {
      alert('Sync failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
    setIsSyncingOrders(false)
  }

  const handleSyncInventory = async () => {
    setIsSyncingInventory(true)
    try {
      const response = await fetch(`/api/integrations/shopify/${integration.id}/sync-inventory`, {
        method: 'POST',
      })
      const result = await response.json()
      if (response.ok) {
        alert(`Inventory synced: ${result.updated} updated, ${result.failed} failed`)
      } else {
        alert('Sync failed: ' + (result.error || 'Unknown error'))
      }
      onRefresh()
      fetchSyncLogs()
    } catch (error) {
      alert('Sync failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
    setIsSyncingInventory(false)
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect this Shopify store? Product mappings will be preserved.')) {
      return
    }

    setIsDisconnecting(true)
    try {
      const response = await fetch(`/api/integrations/shopify/${integration.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to disconnect')
      }
      onRefresh()
    } catch (error) {
      alert('Failed to disconnect: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
    setIsDisconnecting(false)
  }

  // Compute health metrics from sync logs
  const now = Date.now()
  const last24h = syncLogs.filter(
    (l) => now - new Date(l.created_at).getTime() < 24 * 60 * 60 * 1000
  )
  const successCount24h = last24h.filter((l) => l.status === 'success').length
  const totalCount24h = last24h.length
  const successRate24h = totalCount24h > 0 ? Math.round((successCount24h / totalCount24h) * 100) : null

  const lastSuccessfulInventorySync = syncLogs.find(
    (l) => l.sync_type === 'inventory' && l.direction === 'outbound' && l.status === 'success'
  )
  const lastSuccessfulOrderSync = syncLogs.find(
    (l) => l.sync_type === 'orders' && l.status === 'success'
  )

  const getSyncHealthColor = (dateString: string | null | undefined) => {
    if (!dateString) return 'bg-slate-300'
    const ageMs = now - new Date(dateString).getTime()
    const ageHours = ageMs / (60 * 60 * 1000)
    if (ageHours < 2) return 'bg-green-500'
    if (ageHours < 6) return 'bg-amber-500'
    return 'bg-red-500'
  }

  return (
    <div className="space-y-4">
      {/* Store Info */}
      <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
        <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="font-medium text-green-900">{integration.shop_name}</p>
          <p className="text-sm text-green-700">{integration.shop_domain}</p>
        </div>
      </div>

      {/* Location Info */}
      {integration.shopify_location_id ? (
        <div className="p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div>
                <p className="font-medium text-blue-900">
                  Inventory Location: {integration.shopify_location_name || '7 Degrees Co'}
                </p>
                <p className="text-sm text-blue-700">
                  Only inventory at this location is synced to Shopify
                </p>
              </div>
            </div>
            <a
              href="/portal/integrations/shopify/location"
              className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              Change
            </a>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-medium text-yellow-800">Location not configured</p>
              <p className="text-sm text-yellow-700">
                Reconnect your store to set up multi-location inventory sync
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Health Metrics */}
      <div className="grid grid-cols-4 gap-3 p-4 bg-slate-50 rounded-lg">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`w-2 h-2 rounded-full ${getSyncHealthColor(lastSuccessfulOrderSync?.created_at)}`} />
            <p className="text-xs text-slate-500">Last Order Sync</p>
          </div>
          <p className="text-sm font-medium text-slate-900">
            {formatDate(lastSuccessfulOrderSync?.created_at ?? integration.last_order_sync_at)}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`w-2 h-2 rounded-full ${getSyncHealthColor(lastSuccessfulInventorySync?.created_at)}`} />
            <p className="text-xs text-slate-500">Last Inventory Sync</p>
          </div>
          <p className="text-sm font-medium text-slate-900">
            {formatDate(lastSuccessfulInventorySync?.created_at ?? integration.last_inventory_sync_at)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">24h Success Rate</p>
          <p className="text-sm font-medium text-slate-900">
            {successRate24h !== null ? `${successRate24h}%` : 'No data'}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">24h Syncs</p>
          <p className="text-sm font-medium text-slate-900">
            {totalCount24h > 0
              ? `${successCount24h}/${totalCount24h}`
              : 'None'}
          </p>
        </div>
      </div>

      {/* Error Display */}
      {integration.last_error_message && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-800">Last Error</p>
          <p className="text-sm text-red-600">{integration.last_error_message}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleSyncOrders}
          disabled={isSyncingOrders}
          className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-lg hover:from-slate-900 hover:to-slate-950 shadow-sm transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
        >
          {isSyncingOrders ? 'Syncing...' : 'Sync Orders'}
        </button>
        <button
          onClick={handleSyncInventory}
          disabled={isSyncingInventory}
          className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-cyan-500 to-teal-600 text-white rounded-lg hover:from-cyan-600 hover:to-teal-700 shadow-sm transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
        >
          {isSyncingInventory ? 'Syncing...' : 'Sync Inventory'}
        </button>
        <a
          href="/portal/integrations/shopify/products"
          className="inline-flex items-center px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          Manage Products
        </a>
        <a
          href="/portal/integrations/shopify/location"
          className="inline-flex items-center px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          Change Location
        </a>
        <button
          onClick={handleDisconnect}
          disabled={isDisconnecting}
          className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
        >
          {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
        </button>
      </div>

      {/* Sync Activity Log */}
      <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowActivity(!showActivity)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
        >
          <span className="text-sm font-semibold text-slate-700">Recent Sync Activity</span>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${showActivity ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showActivity && (
          <div className="divide-y divide-slate-100">
            {syncLogs.length === 0 && !isLoadingLogs && (
              <p className="px-4 py-6 text-sm text-slate-400 text-center">No sync activity yet</p>
            )}
            {syncLogs.map((log) => (
              <SyncLogEntry key={log.id} log={log} />
            ))}
            {isLoadingLogs && (
              <p className="px-4 py-3 text-sm text-slate-400 text-center">Loading...</p>
            )}
            {!isLoadingLogs && syncLogs.length < syncLogsTotal && (
              <button
                onClick={() => fetchSyncLogs(logsOffset, true)}
                className="w-full px-4 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-50 transition-colors"
              >
                Show more
              </button>
            )}
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="mt-2 p-4 bg-slate-50 rounded-lg space-y-4">
        <h4 className="text-sm font-semibold text-slate-700">Sync Settings</h4>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">Auto-import new orders</p>
            <p className="text-xs text-slate-400">Automatically import orders when they arrive</p>
          </div>
          <Toggle
            checked={autoImportOrders}
            onChange={(val) => handleSettingChange('auto_import_orders', val)}
            disabled={isSavingSettings}
            loading={isSavingSettings}
            size="sm"
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">Auto-sync inventory to Shopify</p>
            <p className="text-xs text-slate-400">Keep Shopify inventory levels in sync automatically</p>
          </div>
          <Toggle
            checked={autoSyncInventory}
            onChange={(val) => handleSettingChange('auto_sync_inventory', val)}
            disabled={isSavingSettings}
            loading={isSavingSettings}
            size="sm"
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">Auto-sync prices to Shopify</p>
            <p className="text-xs text-slate-400">Update Shopify variant prices when inventory syncs</p>
          </div>
          <Toggle
            checked={autoSyncPrices}
            onChange={(val) => handleSettingChange('auto_sync_prices', val)}
            disabled={isSavingSettings}
            loading={isSavingSettings}
            size="sm"
          />
        </div>
      </div>
    </div>
  )
}

/* ─── Sync Log Entry ─── */

const syncTypeIcons: Record<string, string> = {
  inventory: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  orders: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  fulfillment: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8',
  return: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6',
  incoming: 'M19 14l-7 7m0 0l-7-7m7 7V3',
  price: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
}

const triggerLabels: Record<string, string> = {
  cron: 'Scheduled',
  event: 'Auto',
  manual: 'Manual',
  webhook: 'Webhook',
}

function SyncLogEntry({ log }: { log: IntegrationSyncLog }) {
  const isExternalChange =
    log.direction === 'inbound' && log.sync_type === 'inventory' && log.triggered_by === 'webhook'
  const warningMessage = isExternalChange
    ? (log.metadata as Record<string, unknown>)?.warning as string | undefined
    : undefined

  const statusColors = {
    success: 'bg-green-100 text-green-700',
    partial: 'bg-amber-100 text-amber-700',
    failed: 'bg-red-100 text-red-700',
  }

  const formatRelative = (dateString: string) => {
    const diffMs = Date.now() - new Date(dateString).getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <div className={`px-4 py-3 flex items-center gap-3 ${isExternalChange ? 'bg-amber-50' : ''}`}>
      <svg
        className={`w-4 h-4 flex-shrink-0 ${isExternalChange ? 'text-amber-500' : 'text-slate-400'}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={syncTypeIcons[log.sync_type] || syncTypeIcons.inventory}
        />
      </svg>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900 capitalize">
            {log.sync_type}
          </span>
          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColors[log.status]}`}>
            {log.status}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            {triggerLabels[log.triggered_by] || log.triggered_by}
          </span>
        </div>
        {isExternalChange && warningMessage ? (
          <p className="text-xs text-amber-600 mt-0.5">{warningMessage}</p>
        ) : (
          <p className="text-xs text-slate-500 mt-0.5">
            {log.items_processed} processed
            {log.items_failed > 0 && `, ${log.items_failed} failed`}
            {log.duration_ms != null && ` in ${(log.duration_ms / 1000).toFixed(1)}s`}
          </p>
        )}
      </div>
      <span className="text-xs text-slate-400 flex-shrink-0">
        {formatRelative(log.created_at)}
      </span>
    </div>
  )
}

/* ─── Coming Soon Card ─── */

function ComingSoonCard({
  name,
  description,
  iconBg,
  iconColor,
  icon,
}: {
  name: string
  description: string
  iconBg: string
  iconColor: string
  icon: React.ReactNode
}) {
  return (
    <Card padding="none">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center`}>
              <span className={iconColor}>{icon}</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{name}</h3>
              <p className="text-sm text-slate-500">{description}</p>
            </div>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
            Coming Soon
          </span>
        </div>
        <div className="mt-6">
          <button
            disabled
            className="px-4 py-2 text-sm font-medium bg-slate-100 text-slate-400 rounded-lg cursor-not-allowed"
          >
            Connect {name}
          </button>
        </div>
      </div>
    </Card>
  )
}

/* ─── Platform Icons ─── */

function ShopifyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.337 3.415c-.182-.04-.364.062-.437.226-.073.164-1.09 2.108-1.09 2.108s-.71-.49-1.56-.347c-2.51.416-3.093 3.174-3.093 3.174l-3.51 1.072s-.255.073-.328.255c-.073.182.037.364.164.473l7.565 5.565c.073.055.164.091.255.091.055 0 .109-.018.164-.036l6.51-3.4c.2-.109.291-.364.2-.582l-4.34-8.6z" />
    </svg>
  )
}

function AmazonIcon() {
  return (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.958 10.09c0 1.232.029 2.256-.591 3.351-.502.891-1.301 1.44-2.186 1.44-1.214 0-1.922-.924-1.922-2.292 0-2.692 2.415-3.182 4.7-3.182v.683zm3.186 7.705a.66.66 0 01-.753.077c-1.06-.876-1.248-1.282-1.829-2.117-1.749 1.784-2.987 2.317-5.253 2.317-2.683 0-4.771-1.655-4.771-4.967 0-2.587 1.401-4.348 3.394-5.209 1.727-.753 4.139-.886 5.982-1.098v-.41c0-.753.058-1.642-.384-2.292-.384-.576-1.117-.814-1.764-.814-1.199 0-2.266.615-2.527 1.89a.512.512 0 01-.441.442l-2.455-.264a.432.432 0 01-.365-.512C6.637 2.107 9.261 1 11.598 1c1.193 0 2.751.317 3.692 1.222 1.193 1.117 1.079 2.607 1.079 4.229v3.83c0 1.152.478 1.657.927 2.28.16.222.195.487-.01.652-.512.428-1.423 1.222-1.923 1.667l-.22-.086z" />
      <path d="M21.543 18.756c-2.44 1.8-5.98 2.757-9.025 2.757-4.27 0-8.114-1.578-11.022-4.204-.228-.206-.024-.487.25-.327 3.138 1.826 7.016 2.925 11.022 2.925 2.703 0 5.675-.56 8.412-1.72.413-.177.758.271.363.569z" />
    </svg>
  )
}

function TikTokIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.3 0 .59.04.86.12V9.01a6.33 6.33 0 00-.86-.06 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.55a8.18 8.18 0 004.77 1.53V6.63a4.84 4.84 0 01-1-.06v.12z" />
    </svg>
  )
}

function EbayIcon() {
  return (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none">
      <text x="2" y="17" fontSize="12" fontWeight="bold" fontFamily="system-ui" fill="currentColor">eB</text>
    </svg>
  )
}

function WooCommerceIcon() {
  return (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.227 4.857A3.612 3.612 0 000 8.197v7.063c0 1.352.76 2.606 1.97 3.24l6.4 3.457c.67.342 1.45.514 2.23.514.78 0 1.56-.172 2.23-.514l6.4-3.457A3.612 3.612 0 0021.2 15.26V8.197a3.612 3.612 0 00-2.227-3.34L12.573 1.4a4.243 4.243 0 00-4.146 0L2.227 4.857zM7.2 9.5c-.8 0-1.5.7-1.5 1.5 0 2.2 1.2 4 2.7 4s2.7-1.8 2.7-4c0-.8-.7-1.5-1.5-1.5s-1.5.7-1.5 1.5c0 .4.4.8.7 1-.2.7-.5 1.3-.9 1.3s-.9-.6-.9-1.3c0-.8.7-1.5 1.5-1.5-.8 0-1.3-.2-1.3-1z" />
    </svg>
  )
}
