/**
 * Shopify Admin API version (REST and GraphQL).
 * Override with SHOPIFY_ADMIN_API_VERSION if needed.
 *
 * @see https://shopify.dev/docs/api/usage/versioning
 */
export const SHOPIFY_ADMIN_API_VERSION =
  process.env.SHOPIFY_ADMIN_API_VERSION?.trim() || '2024-01'
