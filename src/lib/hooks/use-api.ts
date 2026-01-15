import useSWR, { SWRConfiguration, mutate } from "swr";
import useSWRMutation from "swr/mutation";

// API imports
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  Product,
} from "@/lib/api/products";
import {
  getInventory,
  getInventoryByLocation,
  getInventoryByProduct,
  getLowStockItems,
  adjustStock,
  StockAdjustmentParams,
  InventoryWithDetails,
} from "@/lib/api/inventory";
import {
  getClients,
  getClient,
  createClientRecord,
  updateClient,
  deleteClient,
  getClientInventory,
  getClientOrders,
  Client,
  ClientWithSummary,
  ClientInventoryItem,
  ClientOrder,
} from "@/lib/api/clients";
import { getLocations, Location } from "@/lib/api/locations";
import {
  getInboundOrders,
  getInboundOrder,
  InboundOrder,
  InboundOrderWithItems,
} from "@/lib/api/inbound";
import {
  getOutboundOrders,
  getOutboundOrder,
  OutboundOrderWithClient,
  OutboundOrderWithItems,
} from "@/lib/api/outbound";
import { getDashboardStats, DashboardData } from "@/lib/api/dashboard";

// ============================================
// Cache Keys
// ============================================

export const cacheKeys = {
  // Products
  products: "products",
  product: (id: string) => `product-${id}`,

  // Inventory
  inventory: "inventory",
  inventoryByLocation: (locationId: string) => `inventory-location-${locationId}`,
  inventoryByProduct: (productId: string) => `inventory-product-${productId}`,
  lowStock: "low-stock",

  // Clients
  clients: "clients",
  client: (id: string) => `client-${id}`,
  clientInventory: (id: string) => `client-inventory-${id}`,
  clientOrders: (id: string) => `client-orders-${id}`,

  // Locations
  locations: "locations",

  // Orders
  inboundOrders: "inbound-orders",
  inboundOrder: (id: string) => `inbound-order-${id}`,
  outboundOrders: "outbound-orders",
  outboundOrder: (id: string) => `outbound-order-${id}`,

  // Dashboard
  dashboard: "dashboard",
};

// ============================================
// SWR Options
// ============================================

const defaultOptions: SWRConfiguration = {
  revalidateOnFocus: true,
  revalidateIfStale: true,
  dedupingInterval: 2000,
};

// ============================================
// Products Hooks
// ============================================

export function useProducts(options?: SWRConfiguration) {
  return useSWR<Product[], Error>(
    cacheKeys.products,
    () => getProducts(),
    { ...defaultOptions, ...options }
  );
}

export function useProduct(id: string | null, options?: SWRConfiguration) {
  return useSWR<Product | null, Error>(
    id ? cacheKeys.product(id) : null,
    () => (id ? getProduct(id) : null),
    { ...defaultOptions, ...options }
  );
}

export function useCreateProduct() {
  return useSWRMutation(
    cacheKeys.products,
    async (_key: string, { arg }: { arg: Partial<Product> }) => {
      const result = await createProduct(arg);
      // Revalidate products list
      mutate(cacheKeys.products);
      return result;
    }
  );
}

export function useUpdateProduct() {
  return useSWRMutation(
    "update-product",
    async (_key: string, { arg }: { arg: { id: string; data: Partial<Product> } }) => {
      const result = await updateProduct(arg.id, arg.data);
      // Revalidate both list and detail
      mutate(cacheKeys.products);
      mutate(cacheKeys.product(arg.id));
      return result;
    }
  );
}

export function useDeleteProduct() {
  return useSWRMutation(
    "delete-product",
    async (_key: string, { arg }: { arg: string }) => {
      await deleteProduct(arg);
      // Revalidate products list
      mutate(cacheKeys.products);
      // Remove from cache
      mutate(cacheKeys.product(arg), undefined, { revalidate: false });
    }
  );
}

// ============================================
// Inventory Hooks
// ============================================

export function useInventory(options?: SWRConfiguration) {
  return useSWR<InventoryWithDetails[], Error>(
    cacheKeys.inventory,
    () => getInventory(),
    { ...defaultOptions, ...options }
  );
}

export function useInventoryByLocation(locationId: string | null, options?: SWRConfiguration) {
  return useSWR<InventoryWithDetails[], Error>(
    locationId ? cacheKeys.inventoryByLocation(locationId) : null,
    () => (locationId ? getInventoryByLocation(locationId) : []),
    { ...defaultOptions, ...options }
  );
}

export function useInventoryByProduct(productId: string | null, options?: SWRConfiguration) {
  return useSWR<InventoryWithDetails[], Error>(
    productId ? cacheKeys.inventoryByProduct(productId) : null,
    () => (productId ? getInventoryByProduct(productId) : []),
    { ...defaultOptions, ...options }
  );
}

export function useLowStockItems(options?: SWRConfiguration) {
  return useSWR<InventoryWithDetails[], Error>(
    cacheKeys.lowStock,
    () => getLowStockItems(),
    { ...defaultOptions, ...options }
  );
}

export function useAdjustStock() {
  return useSWRMutation(
    "adjust-stock",
    async (_key: string, { arg }: { arg: StockAdjustmentParams }) => {
      const result = await adjustStock(arg);
      // Revalidate inventory data
      mutate(cacheKeys.inventory);
      mutate(cacheKeys.inventoryByLocation(arg.locationId));
      mutate(cacheKeys.inventoryByProduct(arg.productId));
      mutate(cacheKeys.lowStock);
      mutate(cacheKeys.dashboard);
      return result;
    }
  );
}

// ============================================
// Clients Hooks
// ============================================

export function useClients(options?: SWRConfiguration) {
  return useSWR<Client[], Error>(
    cacheKeys.clients,
    () => getClients(),
    { ...defaultOptions, ...options }
  );
}

export function useClient(id: string | null, options?: SWRConfiguration) {
  return useSWR<ClientWithSummary | null, Error>(
    id ? cacheKeys.client(id) : null,
    () => (id ? getClient(id) : null),
    { ...defaultOptions, ...options }
  );
}

export function useClientInventory(clientId: string | null, options?: SWRConfiguration) {
  return useSWR<ClientInventoryItem[], Error>(
    clientId ? cacheKeys.clientInventory(clientId) : null,
    () => (clientId ? getClientInventory(clientId) : []),
    { ...defaultOptions, ...options }
  );
}

export function useClientOrders(clientId: string | null, options?: SWRConfiguration) {
  return useSWR<ClientOrder[], Error>(
    clientId ? cacheKeys.clientOrders(clientId) : null,
    () => (clientId ? getClientOrders(clientId) : []),
    { ...defaultOptions, ...options }
  );
}

export function useCreateClient() {
  return useSWRMutation(
    cacheKeys.clients,
    async (_key: string, { arg }: { arg: Omit<Client, "id" | "auth_id" | "created_at"> }) => {
      const result = await createClientRecord(arg);
      mutate(cacheKeys.clients);
      return result;
    }
  );
}

export function useUpdateClient() {
  return useSWRMutation(
    "update-client",
    async (_key: string, { arg }: { arg: { id: string; data: Partial<Client> } }) => {
      const result = await updateClient(arg.id, arg.data);
      mutate(cacheKeys.clients);
      mutate(cacheKeys.client(arg.id));
      return result;
    }
  );
}

export function useDeleteClient() {
  return useSWRMutation(
    "delete-client",
    async (_key: string, { arg }: { arg: string }) => {
      await deleteClient(arg);
      mutate(cacheKeys.clients);
      mutate(cacheKeys.client(arg), undefined, { revalidate: false });
    }
  );
}

// ============================================
// Locations Hooks
// ============================================

export function useLocations(options?: SWRConfiguration) {
  return useSWR<Location[], Error>(
    cacheKeys.locations,
    () => getLocations(),
    { ...defaultOptions, ...options }
  );
}

// ============================================
// Inbound Orders Hooks
// ============================================

export function useInboundOrders(options?: SWRConfiguration) {
  return useSWR<InboundOrder[], Error>(
    cacheKeys.inboundOrders,
    () => getInboundOrders(),
    { ...defaultOptions, ...options }
  );
}

export function useInboundOrder(id: string | null, options?: SWRConfiguration) {
  return useSWR<InboundOrderWithItems | null, Error>(
    id ? cacheKeys.inboundOrder(id) : null,
    () => (id ? getInboundOrder(id) : null),
    { ...defaultOptions, ...options }
  );
}

// ============================================
// Outbound Orders Hooks
// ============================================

export function useOutboundOrders(options?: SWRConfiguration) {
  return useSWR<OutboundOrderWithClient[], Error>(
    cacheKeys.outboundOrders,
    () => getOutboundOrders(),
    { ...defaultOptions, ...options }
  );
}

export function useOutboundOrder(id: string | null, options?: SWRConfiguration) {
  return useSWR<OutboundOrderWithItems | null, Error>(
    id ? cacheKeys.outboundOrder(id) : null,
    () => (id ? getOutboundOrder(id) : null),
    { ...defaultOptions, ...options }
  );
}

// ============================================
// Dashboard Hooks
// ============================================

export function useDashboard(options?: SWRConfiguration) {
  return useSWR<DashboardData, Error>(
    cacheKeys.dashboard,
    () => getDashboardStats(),
    {
      ...defaultOptions,
      // Refresh dashboard every 30 seconds
      refreshInterval: 30000,
      ...options,
    }
  );
}

// ============================================
// Cache Invalidation Helpers
// ============================================

/**
 * Invalidate all cached data
 */
export async function invalidateAll() {
  await mutate(() => true, undefined, { revalidate: true });
}

/**
 * Invalidate specific cache keys
 */
export async function invalidateCache(...keys: string[]) {
  await Promise.all(keys.map((key) => mutate(key)));
}

/**
 * Invalidate inventory-related caches
 */
export async function invalidateInventory() {
  await Promise.all([
    mutate(cacheKeys.inventory),
    mutate(cacheKeys.lowStock),
    mutate(cacheKeys.dashboard),
  ]);
}

/**
 * Invalidate order-related caches
 */
export async function invalidateOrders() {
  await Promise.all([
    mutate(cacheKeys.inboundOrders),
    mutate(cacheKeys.outboundOrders),
    mutate(cacheKeys.dashboard),
  ]);
}

// ============================================
// Prefetch Helpers
// ============================================

/**
 * Prefetch products data
 */
export async function prefetchProducts() {
  await mutate(cacheKeys.products, getProducts());
}

/**
 * Prefetch dashboard data
 */
export async function prefetchDashboard() {
  await mutate(cacheKeys.dashboard, getDashboardStats());
}

/**
 * Prefetch common data on app load
 */
export async function prefetchCommonData() {
  await Promise.all([
    prefetchProducts(),
    prefetchDashboard(),
    mutate(cacheKeys.locations, getLocations()),
    mutate(cacheKeys.clients, getClients()),
  ]);
}
