/**
 * Shopify Integration Module
 *
 * This module provides all Shopify-related functionality:
 * - OAuth and authentication
 * - Order sync (import from Shopify)
 * - Fulfillment sync (send tracking to Shopify)
 * - Inventory sync (push stock levels to Shopify)
 */

export { ShopifyClient, createShopifyClient, ShopifyApiError } from './client'
export { processShopifyOrder, syncShopifyOrders } from './order-sync'
export { syncFulfillmentToShopify } from './fulfillment-sync'
export { syncInventoryToShopify, fetchShopifyProducts } from './inventory-sync'
