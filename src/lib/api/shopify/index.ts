/**
 * Shopify Integration Module
 *
 * This module provides all Shopify-related functionality:
 * - OAuth and authentication
 * - Order sync (import from Shopify)
 * - Fulfillment sync (send tracking to Shopify)
 * - Inventory sync (push stock levels to Shopify)
 * - Returns sync (push refunds to Shopify)
 * - Incoming inventory sync (push incoming qty as metafields)
 * - Event-driven sync (real-time inventory updates)
 */

export { ShopifyClient, createShopifyClient, ShopifyApiError } from './client'
export { processShopifyOrder, syncShopifyOrders } from './order-sync'
export { syncFulfillmentToShopify } from './fulfillment-sync'
export { syncInventoryToShopify, fetchShopifyProducts } from './inventory-sync'
export { syncReturnToShopify } from './returns-sync'
export { calculateIncomingInventory, syncIncomingToShopify } from './incoming-sync'
export { triggerInventorySync, triggerImmediateInventorySync } from './event-sync'
