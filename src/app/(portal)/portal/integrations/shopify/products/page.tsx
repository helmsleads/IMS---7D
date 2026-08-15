'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import { useClient } from '@/lib/client-auth'
import { getClientIntegrations } from '@/lib/api/integrations'
import { getProductMappings, createProductMapping, deleteProductMapping, hasUsableShopifySku, ProductMapping } from '@/lib/api/product-mappings'
import { getProducts, type ProductWithCategory } from '@/lib/api/products'
import type { ClientIntegration } from '@/types/database'

interface ShopifyProduct {
  productId: string
  variantId: string
  title: string
  variantTitle: string | null
  sku: string | null
  barcode: string | null
  inventoryItemId: string
  imageUrl: string | null
}

type MappingTab = 'unmapped' | 'test'

export default function ProductMappingPage() {
  const router = useRouter()
  const { client } = useClient()
  const [integration, setIntegration] = useState<ClientIntegration | null>(null)
  const [mappings, setMappings] = useState<ProductMapping[]>([])
  const [shopifyProducts, setShopifyProducts] = useState<ShopifyProduct[]>([])
  const [imsProducts, setImsProducts] = useState<ProductWithCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<MappingTab>('unmapped')

  // Load data
  useEffect(() => {
    async function loadData() {
      if (!client?.id) return

      setIsLoading(true)
      setError(null)

      try {
        // Get Shopify integration
        const integrations = await getClientIntegrations(client.id)
        const shopifyInt = integrations.find((i) => i.platform === 'shopify' && i.status === 'active')

        if (!shopifyInt) {
          setError('No active Shopify integration found')
          setIsLoading(false)
          return
        }

        setIntegration(shopifyInt)

        // Load in parallel
        const [mappingsData, productsData, shopifyData] = await Promise.all([
          getProductMappings(shopifyInt.id, client.id),
          getProducts(client.id),
          fetch(`/api/integrations/shopify/${shopifyInt.id}/products`).then((r) => r.json()),
        ])

        setMappings(mappingsData)
        setImsProducts(productsData)
        setShopifyProducts(shopifyData.products || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      }

      setIsLoading(false)
    }

    loadData()
  }, [client?.id])

  const mappedVariantIds = new Set(mappings.map((m) => m.external_variant_id))
  const unmappedProducts = shopifyProducts.filter(
    (p) => !mappedVariantIds.has(p.variantId) && hasUsableShopifySku(p.sku)
  )
  // Unmapped Shopify listings with blank / N/A SKU (Test tab — real products, not test orders)
  const testProductsUnmapped = shopifyProducts.filter(
    (p) => !mappedVariantIds.has(p.variantId) && !hasUsableShopifySku(p.sku)
  )
  // Already-mapped no-SKU connections (still listed under Test tab)
  const testMappings = mappings.filter((m) => !hasUsableShopifySku(m.external_sku))
  const testTabCount = testProductsUnmapped.length + testMappings.length

  const listForTab = activeTab === 'unmapped' ? unmappedProducts : testProductsUnmapped
  const filteredList = listForTab.filter(
    (p) =>
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.variantTitle?.toLowerCase().includes(searchTerm.toLowerCase())
  )
  const filteredTestMappings = testMappings.filter(
    (m) =>
      (m.external_title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.external_sku || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.product?.sku || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.product?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleCreateMapping = async (
    shopifyProduct: ShopifyProduct,
    imsProductId: string,
    options?: { allowMissingSku?: boolean }
  ) => {
    if (!integration || !client) return

    const isNoSkuMapping = Boolean(options?.allowMissingSku) || !hasUsableShopifySku(shopifyProduct.sku)
    if (!hasUsableShopifySku(shopifyProduct.sku) && !options?.allowMissingSku) {
      alert('This Shopify product has no SKU. Map it from the Test tab.')
      return
    }

    setIsSaving(true)
    try {
      const newMapping = await createProductMapping(
        {
          integration_id: integration.id,
          product_id: imsProductId,
          external_product_id: shopifyProduct.productId,
          external_variant_id: shopifyProduct.variantId,
          external_inventory_item_id: shopifyProduct.inventoryItemId,
          external_sku: shopifyProduct.sku || undefined,
          external_title: shopifyProduct.title + (shopifyProduct.variantTitle ? ` - ${shopifyProduct.variantTitle}` : ''),
          external_image_url: shopifyProduct.imageUrl || undefined,
          sync_inventory: isNoSkuMapping ? false : true,
          allowMissingSku: isNoSkuMapping,
        },
        client.id
      )
      setMappings([...mappings, newMapping])
    } catch (err) {
      alert('Failed to create mapping: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
    setIsSaving(false)
  }

  const handleDeleteMapping = async (mappingId: string) => {
    if (!client) return
    if (!confirm('Remove this product mapping?')) return

    try {
      await deleteProductMapping(mappingId, client.id)
      setMappings(mappings.filter((m) => m.id !== mappingId))
    } catch (err) {
      alert('Failed to delete mapping: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12 text-gray-500">Loading product data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-red-50 text-red-800 p-4 rounded-lg">{error}</div>
        <button
          onClick={() => router.push('/portal/integrations')}
          className="mt-4 text-blue-600 hover:underline"
        >
          &larr; Back to Integrations
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push('/portal/integrations')}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            &larr; Back to Integrations
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Product Mapping</h1>
          <p className="text-gray-600 mt-1">
            Map Shopify products to IMS products for order import. Use the Test tab for
            real listings that have no SKU (shown as N/A) — they are not test orders.
          </p>
        </div>
        <div className="text-right text-sm text-gray-500">
          <div>{mappings.length} mapped</div>
          <div>{unmappedProducts.length} unmapped</div>
          <div>{testTabCount} no SKU</div>
        </div>
      </div>

      {/* Current Mappings */}
      <Card className="mb-6">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Mapped Products ({mappings.length})</h2>
        </div>
        {mappings.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No products mapped yet. Map products below to enable order line item import.
          </div>
        ) : (
          <div className="divide-y">
            {mappings.map((mapping) => {
              const isNoSkuMapping = !hasUsableShopifySku(mapping.external_sku)
              return (
                <div key={mapping.id} className="p-4 flex items-center gap-4">
                  {mapping.external_image_url && (
                    <img
                      src={mapping.external_image_url}
                      alt=""
                      className="w-12 h-12 object-cover rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      <span className="truncate">{mapping.external_title}</span>
                      {isNoSkuMapping && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                          No SKU
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      SKU: {mapping.external_sku || 'N/A'} &rarr; IMS: {mapping.product?.sku || 'Unknown'}
                      {isNoSkuMapping && !mapping.sync_inventory ? ' · inventory sync off' : ''}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">{mapping.product?.name}</div>
                  <button
                    onClick={() => handleDeleteMapping(mapping.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Unmapped / Test Products */}
      <Card>
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('unmapped')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  activeTab === 'unmapped'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Unmapped ({unmappedProducts.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('test')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  activeTab === 'test'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Test ({testTabCount})
              </button>
            </div>
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm w-64"
            />
          </div>
          {activeTab === 'test' && (
            <p className="text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
              Real Shopify products with no SKU (shown as N/A). Map by variant ID. Inventory
              sync stays off for these mappings. Orders using them are not marked as test.
            </p>
          )}
        </div>
        {activeTab === 'test' && filteredTestMappings.length > 0 && (
          <div className="border-b">
            <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 bg-slate-50">
              Mapped no-SKU products ({filteredTestMappings.length})
            </div>
            <div className="divide-y">
              {filteredTestMappings.map((mapping) => (
                <div key={mapping.id} className="p-4 flex items-center gap-4">
                  {mapping.external_image_url && (
                    <img
                      src={mapping.external_image_url}
                      alt=""
                      className="w-12 h-12 object-cover rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      <span className="truncate">{mapping.external_title}</span>
                      <span className="shrink-0 px-1.5 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                        No SKU
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      SKU: {mapping.external_sku || 'N/A'} &rarr; IMS: {mapping.product?.sku || 'Unknown'}
                      {!mapping.sync_inventory ? ' · inventory sync off' : ''}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">{mapping.product?.name}</div>
                  <button
                    onClick={() => handleDeleteMapping(mapping.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {filteredList.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {listForTab.length === 0
              ? activeTab === 'test'
                ? filteredTestMappings.length > 0
                  ? 'No additional N/A Shopify products left to map.'
                  : 'No Shopify products with missing SKU.'
                : 'All Shopify products with a SKU are mapped!'
              : 'No products match your search'}
          </div>
        ) : (
          <div className="divide-y max-h-[500px] overflow-y-auto">
            {activeTab === 'test' && (
              <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 bg-slate-50">
                Unmapped N/A products ({filteredList.length})
              </div>
            )}
            {filteredList.slice(0, 50).map((product) => (
              <div key={product.variantId} className="p-4 flex items-center gap-4">
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt=""
                    className="w-12 h-12 object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {product.title}
                    {product.variantTitle && (
                      <span className="text-gray-500"> - {product.variantTitle}</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">SKU: {product.sku || 'N/A'}</div>
                </div>
                <select
                  className="px-3 py-1.5 border rounded-lg text-sm"
                  defaultValue=""
                  disabled={isSaving}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleCreateMapping(product, e.target.value, {
                        allowMissingSku: activeTab === 'test',
                      })
                      e.target.value = ''
                    }
                  }}
                >
                  <option value="">Map to IMS product...</option>
                  {imsProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} - {p.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {filteredList.length > 50 && (
              <div className="p-4 text-center text-gray-500 text-sm">
                Showing first 50 products. Use search to find specific products.
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
