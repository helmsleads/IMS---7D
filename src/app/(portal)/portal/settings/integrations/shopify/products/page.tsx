'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import { useClient } from '@/lib/client-auth'
import { getClientIntegrations } from '@/lib/api/integrations'
import { getProductMappings, createProductMapping, deleteProductMapping, ProductMapping } from '@/lib/api/product-mappings'
import { getProducts } from '@/lib/api/products'
import type { ClientIntegration, Product } from '@/types/database'

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

export default function ProductMappingPage() {
  const router = useRouter()
  const { client } = useClient()
  const [integration, setIntegration] = useState<ClientIntegration | null>(null)
  const [mappings, setMappings] = useState<ProductMapping[]>([])
  const [shopifyProducts, setShopifyProducts] = useState<ShopifyProduct[]>([])
  const [imsProducts, setImsProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

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
          getProductMappings(shopifyInt.id),
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

  // Get unmapped Shopify products
  const mappedVariantIds = new Set(mappings.map((m) => m.external_variant_id))
  const unmappedProducts = shopifyProducts.filter((p) => !mappedVariantIds.has(p.variantId))

  // Filter by search
  const filteredUnmapped = unmappedProducts.filter(
    (p) =>
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleCreateMapping = async (shopifyProduct: ShopifyProduct, imsProductId: string) => {
    if (!integration) return

    setIsSaving(true)
    try {
      const newMapping = await createProductMapping({
        integration_id: integration.id,
        product_id: imsProductId,
        external_product_id: shopifyProduct.productId,
        external_variant_id: shopifyProduct.variantId,
        external_sku: shopifyProduct.sku || undefined,
        external_title: shopifyProduct.title + (shopifyProduct.variantTitle ? ` - ${shopifyProduct.variantTitle}` : ''),
        external_image_url: shopifyProduct.imageUrl || undefined,
        sync_inventory: true,
      })
      setMappings([...mappings, newMapping])
    } catch (err) {
      alert('Failed to create mapping: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
    setIsSaving(false)
  }

  const handleDeleteMapping = async (mappingId: string) => {
    if (!confirm('Remove this product mapping?')) return

    try {
      await deleteProductMapping(mappingId)
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
          onClick={() => router.push('/portal/settings/integrations')}
          className="mt-4 text-blue-600 hover:underline"
        >
          ← Back to Integrations
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push('/portal/settings/integrations')}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            ← Back to Integrations
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Product Mapping</h1>
          <p className="text-gray-600 mt-1">
            Map your Shopify products to IMS products for order import
          </p>
        </div>
        <div className="text-right text-sm text-gray-500">
          <div>{mappings.length} mapped</div>
          <div>{unmappedProducts.length} unmapped</div>
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
            {mappings.map((mapping) => (
              <div key={mapping.id} className="p-4 flex items-center gap-4">
                {mapping.external_image_url && (
                  <img
                    src={mapping.external_image_url}
                    alt=""
                    className="w-12 h-12 object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{mapping.external_title}</div>
                  <div className="text-sm text-gray-500">
                    SKU: {mapping.external_sku || 'N/A'} → IMS: {mapping.product?.sku || 'Unknown'}
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
        )}
      </Card>

      {/* Unmapped Products */}
      <Card>
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Unmapped Shopify Products ({unmappedProducts.length})</h2>
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm w-64"
          />
        </div>
        {filteredUnmapped.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {unmappedProducts.length === 0
              ? 'All Shopify products are mapped!'
              : 'No products match your search'}
          </div>
        ) : (
          <div className="divide-y max-h-[500px] overflow-y-auto">
            {filteredUnmapped.slice(0, 50).map((product) => (
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
                      handleCreateMapping(product, e.target.value)
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
            {filteredUnmapped.length > 50 && (
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
