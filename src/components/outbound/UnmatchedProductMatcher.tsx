'use client'

import { useEffect, useMemo, useState } from 'react'
import { Link2, Loader2 } from 'lucide-react'
import SearchSelect from '@/components/ui/SearchSelect'
import { getProducts, type ProductWithCategory } from '@/lib/api/products'

interface UnmatchedProductMatcherProps {
  orderId: string
  itemId: string
  clientId: string
  externalSku?: string | null
  externalTitle?: string | null
  onMatched?: () => void
  /** Compact inline layout for table rows */
  variant?: 'inline' | 'stacked'
}

export default function UnmatchedProductMatcher({
  orderId,
  itemId,
  clientId,
  externalSku,
  externalTitle,
  onMatched,
  variant = 'stacked',
}: UnmatchedProductMatcherProps) {
  const [products, setProducts] = useState<ProductWithCategory[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [matching, setMatching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoadingProducts(true)
      try {
        const rows = await getProducts(clientId)
        if (!cancelled) {
          setProducts(rows.filter((p) => p.active))
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load products')
        }
      } finally {
        if (!cancelled) setLoadingProducts(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [clientId])

  const options = useMemo(
    () =>
      products.map((p) => ({
        value: p.id,
        label: `${p.sku} — ${p.name}`,
      })),
    [products]
  )

  const suggestedProductId = useMemo(() => {
    const sku = String(externalSku || '').trim().toLowerCase()
    if (!sku || sku === 'n/a' || sku === 'na') return ''
    const bySku = products.find((p) => p.sku.toLowerCase() === sku)
    return bySku?.id || ''
  }, [products, externalSku])

  useEffect(() => {
    if (suggestedProductId && !selectedProductId) {
      setSelectedProductId(suggestedProductId)
    }
  }, [suggestedProductId, selectedProductId])

  const handleMatch = async () => {
    if (!selectedProductId) return
    setMatching(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/outbound/${orderId}/items/${itemId}/match`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_id: selectedProductId }),
        }
      )
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        throw new Error(data.error || 'Failed to match product')
      }
      onMatched?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to match product')
    } finally {
      setMatching(false)
    }
  }

  const label =
    externalTitle ||
    (externalSku ? `SKU ${externalSku}` : 'Unmatched Shopify product')

  if (variant === 'inline') {
    return (
      <div className="flex flex-col gap-2 min-w-[220px]">
        <p className="text-xs text-rose-700 truncate" title={label}>
          {label}
        </p>
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <SearchSelect
              options={options}
              value={selectedProductId}
              onChange={setSelectedProductId}
              placeholder={loadingProducts ? 'Loading…' : 'Select IMS product…'}
              disabled={loadingProducts || matching || options.length === 0}
            />
          </div>
          <button
            type="button"
            onClick={handleMatch}
            disabled={!selectedProductId || matching || loadingProducts}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {matching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Link2 className="w-3.5 h-3.5" />
            )}
            Match
          </button>
        </div>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="mt-2 p-3 rounded-lg border border-rose-200 bg-rose-50/80 space-y-2">
      <p className="text-xs font-medium text-rose-800">
        Match to an IMS product
      </p>
      <p className="text-xs text-rose-700 truncate" title={label}>
        Shopify: {label}
      </p>
      <SearchSelect
        options={options}
        value={selectedProductId}
        onChange={setSelectedProductId}
        placeholder={loadingProducts ? 'Loading products…' : 'Search IMS products…'}
        disabled={loadingProducts || matching || options.length === 0}
      />
      <button
        type="button"
        onClick={handleMatch}
        disabled={!selectedProductId || matching || loadingProducts}
        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {matching ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Matching…
          </>
        ) : (
          <>
            <Link2 className="w-4 h-4" />
            Match product
          </>
        )}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
