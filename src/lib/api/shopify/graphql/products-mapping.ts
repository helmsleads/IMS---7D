import type { ShopifyClient } from '../client'

const PRODUCTS_MAPPING_QUERY = `#graphql
  query ProductsForMapping($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          legacyResourceId
          title
          featuredImage {
            url
          }
          variants(first: 100) {
            edges {
              node {
                legacyResourceId
                title
                sku
                barcode
                inventoryQuantity
                inventoryItem {
                  legacyResourceId
                }
              }
            }
          }
        }
      }
    }
  }
`

interface ProductsMappingData {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
    edges: Array<{
      node: {
        legacyResourceId: string
        title: string
        featuredImage?: { url: string } | null
        variants: {
          edges: Array<{
            node: {
              legacyResourceId: string
              title: string
              sku?: string | null
              barcode?: string | null
              inventoryQuantity: number
              inventoryItem?: { legacyResourceId: string } | null
            }
          }>
        }
      }
    }>
  }
}

export type ProductMappingRow = {
  productId: string
  variantId: string
  title: string
  variantTitle: string | null
  sku: string | null
  barcode: string | null
  inventoryItemId: string
  imageUrl: string | null
}

/**
 * List products + variants for portal mapping UI (replaces REST products.json pagination).
 */
export async function fetchProductsForIntegrationMapping(
  client: ShopifyClient
): Promise<ProductMappingRow[]> {
  const rows: ProductMappingRow[] = []
  const pageSize = 50
  let after: string | null = null
  let hasNext = true

  while (hasNext) {
    const data: ProductsMappingData = await client.graphql<ProductsMappingData>(
      PRODUCTS_MAPPING_QUERY,
      {
        first: pageSize,
        after,
      }
    )

    const conn = data.products
    for (const { node: product } of conn.edges) {
      const imageUrl = product.featuredImage?.url ?? null
      const productId = String(product.legacyResourceId)

      for (const { node: variant } of product.variants.edges) {
        const invId = variant.inventoryItem?.legacyResourceId
        if (!invId) continue

        rows.push({
          productId,
          variantId: String(variant.legacyResourceId),
          title: product.title,
          variantTitle: variant.title !== 'Default Title' ? variant.title : null,
          sku: variant.sku || null,
          barcode: variant.barcode || null,
          inventoryItemId: String(invId),
          imageUrl,
        })
      }
    }

    hasNext = conn.pageInfo.hasNextPage
    after = conn.pageInfo.endCursor ?? null
  }

  return rows
}

export type InventoryProductVariantRow = {
  product_id: string
  variant_id: string
  title: string
  variant_title: string
  sku: string
  inventory_item_id: string
  inventory_quantity: number
}

/**
 * Product variants with inventory quantities (replaces REST for inventory sync helpers).
 */
export async function fetchProductVariantsForInventorySync(
  client: ShopifyClient
): Promise<InventoryProductVariantRow[]> {
  const rows: InventoryProductVariantRow[] = []
  const pageSize = 50
  let after: string | null = null
  let hasNext = true

  while (hasNext) {
    const data: ProductsMappingData = await client.graphql<ProductsMappingData>(
      PRODUCTS_MAPPING_QUERY,
      {
        first: pageSize,
        after,
      }
    )

    const conn = data.products
    for (const { node: product } of conn.edges) {
      const productId = String(product.legacyResourceId)

      for (const { node: variant } of product.variants.edges) {
        const invId = variant.inventoryItem?.legacyResourceId
        if (!invId) continue

        rows.push({
          product_id: productId,
          variant_id: String(variant.legacyResourceId),
          title: product.title,
          variant_title: variant.title,
          sku: variant.sku || '',
          inventory_item_id: String(invId),
          inventory_quantity: variant.inventoryQuantity ?? 0,
        })
      }
    }

    hasNext = conn.pageInfo.hasNextPage
    after = conn.pageInfo.endCursor ?? null
  }

  return rows
}

const VARIANTS_INVENTORY_NODES_QUERY = `#graphql
  query VariantsInventoryNodes($ids: [ID!]!) {
    nodes(ids: $ids) {
      __typename
      ... on ProductVariant {
        legacyResourceId
        inventoryItem {
          legacyResourceId
        }
      }
    }
  }
`

interface VariantsInventoryNodesData {
  nodes: Array<
    | null
    | {
        __typename: string
        legacyResourceId?: string
        inventoryItem?: { legacyResourceId: string } | null
      }
  >
}

/** Normalize Shopify variant id (numeric or GID) to numeric string for maps / GID building. */
export function variantIdToNumericString(externalVariantId: string): string {
  const t = externalVariantId.trim()
  if (t.startsWith('gid://')) {
    return t.split('/').pop() ?? t
  }
  return t
}

/**
 * Resolve inventory item legacy ids for variant legacy ids (batch GraphQL).
 * Used when product_mappings have external_variant_id but missing external_inventory_item_id.
 */
export async function fetchInventoryItemLegacyIdsByVariantIds(
  client: ShopifyClient,
  variantLegacyIds: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const unique = [...new Set(variantLegacyIds.map((id) => variantIdToNumericString(id)).filter(Boolean))]
  const chunkSize = 50

  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const ids = chunk.map((n) => `gid://shopify/ProductVariant/${n}`)
    const data = await client.graphql<VariantsInventoryNodesData>(VARIANTS_INVENTORY_NODES_QUERY, { ids })

    for (const node of data.nodes || []) {
      if (!node || node.__typename !== 'ProductVariant') continue
      const vid = node.legacyResourceId != null ? String(node.legacyResourceId) : null
      const inv = node.inventoryItem?.legacyResourceId
      if (vid && inv != null) {
        out.set(vid, String(inv))
      }
    }
  }

  return out
}
