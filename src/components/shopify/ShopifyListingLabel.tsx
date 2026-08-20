export function ShopifyListingLabel({
  title,
}: {
  title: string | null | undefined
}) {
  const value = title?.trim()
  if (!value) return null

  return (
    <p className="text-xs text-slate-500 mt-1 line-clamp-2" title={value}>
      <span className="text-slate-400">Shopify:</span> {value}
    </p>
  )
}
