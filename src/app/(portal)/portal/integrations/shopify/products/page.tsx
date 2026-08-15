'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import { useClient } from '@/lib/client-auth'
import { getClientIntegrations } from '@/lib/api/integrations'
import {
  getProductMappings,
  createProductMapping,
  deleteProductMapping,
  hasUsableShopifySku,
  ProductMapping,
} from '@/lib/api/product-mappings'
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

function matchesSearch(
  searchTerm: string,
  fields: Array<string | null | undefined>,
): boolean {
  const q = searchTerm.toLowerCase().trim()
  if (!q) return true
  return fields.some((f) => (f || '').toLowerCase().includes(q))
}

function ProductRow({
  product,
  imsProducts,
  isSaving,
  onMap,
}: {
  product: ShopifyProduct
  imsProducts: ProductWithCategory[]
  isSaving: boolean
  onMap: (product: ShopifyProduct, imsProductId: string) => void
}) {
  return (
    <div className="p-4 flex items-center gap-4">
      {product.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
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
            onMap(product, e.target.value)
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
  )
}

function MappingRow({
  mapping,
  onRemove,
}: {
  mapping: ProductMapping
  onRemove: (id: string) => void
}) {
  const isNoSku = !hasUsableShopifySku(mapping.external_sku)
  return (
    <div className="p-4 flex items-center gap-4">
      {mapping.external_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mapping.external_image_url}
          alt=""
          className="w-12 h-12 object-cover rounded"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate flex items-center gap-2">
          <span className="truncate">{mapping.external_title}</span>
          {isNoSku && (
            <span className="shrink-0 px-1.5 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
              No SKU
            </span>
          )}
        </div>
        <div className="text-sm text-gray-500">
          SKU: {mapping.external_sku || 'N/A'} &rarr; IMS:{' '}
          {mapping.product?.sku || 'Unknown'}
          {isNoSku && !mapping.sync_inventory ? ' · inventory sync off' : ''}
        </div>
      </div>
      <div className="text-sm text-gray-600">{mapping.product?.name}</div>
      <button
        onClick={() => onRemove(mapping.id)}
        className="text-red-600 hover:text-red-800 text-sm"
      >
        Remove
      </button>
    </div>
  )
}

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

  useEffect(() => {
    async function loadData() {
      if (!client?.id) return

      setIsLoading(true)
      setError(null)

      try {
        const integrations = await getClientIntegrations(client.id)
        const shopifyInt = integrations.find(
          (i) => i.platform === 'shopify' && i.status === 'active',
        )

        if (!shopifyInt) {
          setError('No active Shopify integration found')
          setIsLoading(false)
          return
        }

        setIntegration(shopifyInt)

        const [mappingsData, productsData, shopifyData] = await Promise.all([
          getProductMappings(shopifyInt.id, client.id),
          getProducts(client.id),
          fetch(`/api/integrations/shopify/${shopifyInt.id}/products`).then((r) =>
            r.json(),
          ),
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

  const unmappedWithSku = shopifyProducts.filter(
    (p) => !mappedVariantIds.has(p.variantId) && hasUsableShopifySku(p.sku),
  )
  const unmappedNoSku = shopifyProducts.filter(
    (p) => !mappedVariantIds.has(p.variantId) && !hasUsableShopifySku(p.sku),
  )

  const mappedWithSku = mappings.filter((m) => hasUsableShopifySku(m.external_sku))
  const mappedNoSku = mappings.filter((m) => !hasUsableShopifySku(m.external_sku))

  const filteredUnmappedWithSku = unmappedWithSku.filter((p) =>
    matchesSearch(searchTerm, [p.title, p.sku, p.variantTitle]),
  )
  const filteredUnmappedNoSku = unmappedNoSku.filter((p) =>
    matchesSearch(searchTerm, [p.title, p.sku, p.variantTitle]),
  )
  const filteredMappedWithSku = mappedWithSku.filter((m) =>
    matchesSearch(searchTerm, [
      m.external_title,
      m.external_sku,
      m.product?.sku,
      m.product?.name,
    ]),
  )
  const filteredMappedNoSku = mappedNoSku.filter((m) =>
    matchesSearch(searchTerm, [
      m.external_title,
      m.external_sku,
      m.product?.sku,
      m.product?.name,
    ]),
  )

  const handleCreateMapping = async (
    shopifyProduct: ShopifyProduct,
    imsProductId: string,
  ) => {
    if (!integration || !client) return

    const isNoSkuMapping = !hasUsableShopifySku(shopifyProduct.sku)

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
          external_title:
            shopifyProduct.title +
            (shopifyProduct.variantTitle ? ` - ${shopifyProduct.variantTitle}` : ''),
          external_image_url: shopifyProduct.imageUrl || undefined,
          sync_inventory: isNoSkuMapping ? false : true,
          allowMissingSku: isNoSkuMapping,
        },
        client.id,
      )
      setMappings([...mappings, newMapping])
    } catch (err) {
      alert(
        'Failed to create mapping: ' +
          (err instanceof Error ? err.message : 'Unknown error'),
      )
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
      alert(
        'Failed to delete mapping: ' +
          (err instanceof Error ? err.message : 'Unknown error'),
      )
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

  const unmappedTotal = filteredUnmappedWithSku.length + filteredUnmappedNoSku.length
  const mappedTotal = filteredMappedWithSku.length + filteredMappedNoSku.length

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <button
            onClick={() => router.push('/portal/integrations')}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            &larr; Back to Integrations
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Product Mapping</h1>
          <p className="text-gray-600 mt-1">
            Map Shopify products to IMS products for order import. Products are grouped by
            SKU and No SKU.
          </p>
        </div>
        <div className="text-right text-sm text-gray-500 shrink-0">
          <div>{mappings.length} mapped</div>
          <div>{unmappedWithSku.length + unmappedNoSku.length} unmapped</div>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm w-full max-w-sm"
        />
      </div>

      {/* Mapped */}
      <Card className="mb-6">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Mapped Products ({mappedTotal})</h2>
        </div>
        {mappedTotal === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {mappings.length === 0
              ? 'No products mapped yet. Map products below to enable order line item import.'
              : 'No mapped products match your search'}
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto">
            {filteredMappedWithSku.length > 0 && (
              <div>
                <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 bg-slate-50 border-b">
                  SKU ({filteredMappedWithSku.length})
                </div>
                <div className="divide-y">
                  {filteredMappedWithSku.map((mapping) => (
                    <MappingRow
                      key={mapping.id}
                      mapping={mapping}
                      onRemove={handleDeleteMapping}
                    />
                  ))}
                </div>
              </div>
            )}
            {filteredMappedNoSku.length > 0 && (
              <div>
                <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 bg-slate-50 border-b border-t">
                  No SKU ({filteredMappedNoSku.length})
                </div>
                <div className="divide-y">
                  {filteredMappedNoSku.map((mapping) => (
                    <MappingRow
                      key={mapping.id}
                      mapping={mapping}
                      onRemove={handleDeleteMapping}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Unmapped — single list, grouped */}
      <Card>
        <div className="p-4 border-b">
          <h2 className="font-semibold">Unmapped Products ({unmappedTotal})</h2>
        </div>
        {unmappedTotal === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {unmappedWithSku.length + unmappedNoSku.length === 0
              ? 'All Shopify products are mapped.'
              : 'No unmapped products match your search'}
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            {filteredUnmappedWithSku.length > 0 && (
              <div>
                <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 bg-slate-50 border-b">
                  SKU ({filteredUnmappedWithSku.length})
                </div>
                <div className="divide-y">
                  {filteredUnmappedWithSku.map((product) => (
                    <ProductRow
                      key={product.variantId}
                      product={product}
                      imsProducts={imsProducts}
                      isSaving={isSaving}
                      onMap={handleCreateMapping}
                    />
                  ))}
                </div>
              </div>
            )}
            {filteredUnmappedNoSku.length > 0 && (
              <div>
                <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 bg-slate-50 border-b border-t">
                  No SKU ({filteredUnmappedNoSku.length})
                </div>
                <div className="divide-y">
                  {filteredUnmappedNoSku.map((product) => (
                    <ProductRow
                      key={product.variantId}
                      product={product}
                      imsProducts={imsProducts}
                      isSaving={isSaving}
                      onMap={handleCreateMapping}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
