'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Card from '@/components/ui/Card'
import { useClient } from '@/lib/client-auth'
import { getClientIntegrations } from '@/lib/api/integrations'
import type { ClientIntegration } from '@/types/database'

export default function IntegrationsSettingsPage() {
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
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-600 mt-1">
          Connect your sales channels to automatically sync orders and inventory
        </p>
      </div>

      {/* Status Messages */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
          <button
            onClick={() => setMessage(null)}
            className="float-right text-sm underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading integrations...</div>
      ) : (
        <div className="space-y-6">
          {/* Shopify Card */}
          <Card>
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <ShopifyIcon className="w-8 h-8 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Shopify</h3>
                    <p className="text-sm text-gray-500">
                      Sync orders and inventory with your Shopify store
                    </p>
                  </div>
                </div>

                {shopifyIntegration?.status === 'active' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Connected
                  </span>
                )}
              </div>

              <div className="mt-6">
                {shopifyIntegration?.status === 'active' ? (
                  <ShopifyConnectedStatus
                    integration={shopifyIntegration}
                    onRefresh={handleRefresh}
                  />
                ) : (
                  <ShopifyConnectForm clientId={client?.id} />
                )}
              </div>
            </div>
          </Card>

          {/* Coming Soon: Other Integrations */}
          <Card>
            <div className="p-6 opacity-60">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">📦</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">More Integrations</h3>
                  <p className="text-sm text-gray-500">
                    TikTok Shop, Amazon, eBay, WooCommerce coming soon
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function ShopifyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.337 3.415c-.182-.04-.364.062-.437.226-.073.164-1.09 2.108-1.09 2.108s-.71-.49-1.56-.347c-2.51.416-3.093 3.174-3.093 3.174l-3.51 1.072s-.255.073-.328.255c-.073.182.037.364.164.473l7.565 5.565c.073.055.164.091.255.091.055 0 .109-.018.164-.036l6.51-3.4c.2-.109.291-.364.2-.582l-4.34-8.6z" />
    </svg>
  )
}

function ShopifyConnectForm({ clientId }: { clientId: string | undefined }) {
  const [shopDomain, setShopDomain] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const handleConnect = () => {
    if (!shopDomain || !clientId) return

    setIsConnecting(true)

    // Clean up shop domain
    let cleanDomain = shopDomain
      .replace('https://', '')
      .replace('http://', '')
      .replace('.myshopify.com', '')
      .replace(/\//g, '')
      .trim()

    // Create state with client ID
    const state = btoa(JSON.stringify({ clientId, timestamp: Date.now() }))

    // Redirect to OAuth
    window.location.href = `/api/integrations/shopify/auth?shop=${cleanDomain}&state=${state}`
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
      >
        Connect Shopify Store
      </button>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Shopify Store URL
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={shopDomain}
            onChange={(e) => setShopDomain(e.target.value)}
            placeholder="your-store-name"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={isConnecting}
          />
          <span className="text-gray-500">.myshopify.com</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Enter your store name without the .myshopify.com part
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleConnect}
          disabled={!shopDomain || isConnecting}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConnecting ? 'Connecting...' : 'Connect'}
        </button>
        <button
          onClick={() => {
            setShowForm(false)
            setShopDomain('')
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          disabled={isConnecting}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function ShopifyConnectedStatus({
  integration,
  onRefresh,
}: {
  integration: ClientIntegration
  onRefresh: () => void
}) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

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
    setIsSyncing(true)
    try {
      const response = await fetch(`/api/integrations/shopify/${integration.id}/sync-orders`, {
        method: 'POST',
      })
      const result = await response.json()
      alert(`Synced ${result.imported} orders, ${result.skipped} skipped, ${result.failed} failed`)
      onRefresh()
    } catch (error) {
      alert('Sync failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
    setIsSyncing(false)
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

  return (
    <div className="space-y-4">
      {/* Store Info */}
      <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
        <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center">
          <span className="text-green-700">✓</span>
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
              href={`/portal/settings/integrations/shopify/location`}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
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

      {/* Sync Status */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <p className="text-sm text-gray-500">Last Order Sync</p>
          <p className="font-medium">{formatDate(integration.last_order_sync_at)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Last Inventory Sync</p>
          <p className="font-medium">{formatDate(integration.last_inventory_sync_at)}</p>
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
          disabled={isSyncing}
          className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
        >
          {isSyncing ? 'Syncing...' : 'Sync Orders Now'}
        </button>
        <a
          href="/portal/settings/integrations/shopify/products"
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Manage Product Mapping
        </a>
        <button
          onClick={handleDisconnect}
          disabled={isDisconnecting}
          className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
        >
          {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
        </button>
      </div>

      {/* Settings */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900">
          Advanced Settings
        </summary>
        <div className="mt-3 p-4 bg-gray-50 rounded-lg space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              defaultChecked={integration.settings?.auto_import_orders}
              className="rounded"
            />
            <span className="text-sm">Auto-import new orders</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              defaultChecked={integration.settings?.auto_sync_inventory}
              className="rounded"
            />
            <span className="text-sm">Auto-sync inventory to Shopify</span>
          </label>
        </div>
      </details>
    </div>
  )
}
