"use client";

import { useEffect, useState } from "react";
import { Package, Search, ChevronDown, LayoutGrid, List, RefreshCw } from "lucide-react";
import { ProductImageCard, ProductThumbnail } from "@/components/ui/ProductImage";
import { useClient } from "@/lib/client-auth";
import { createClient } from "@/lib/supabase";

interface InventoryItem {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  qty_on_hand: number;
  reorder_point: number;
  image_url: string | null;
  category: string | null;
}

type StockStatusFilter = "all" | "in_stock" | "low_stock" | "out_of_stock";
type ViewMode = "grid" | "list";

export default function PortalInventoryPage() {
  const { client } = useClient();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StockStatusFilter>("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInventory = async (isRefresh = false) => {
    if (!client) return;

    if (isRefresh) {
      setRefreshing(true);
    }

    const supabase = createClient();

    const { data } = await supabase
      .from("inventory")
      .select(`
        id,
        qty_on_hand,
        product:products!inner (
          id,
          name,
          sku,
          image_url,
          reorder_point,
          category,
          client_id
        )
      `)
      .eq("product.client_id", client.id)
      .order("qty_on_hand", { ascending: false });

    const inventoryItems = (data || []).map((item) => {
      const product = Array.isArray(item.product) ? item.product[0] : item.product;

      return {
        id: item.id,
        product_id: product?.id || "",
        product_name: product?.name || "Unknown",
        sku: product?.sku || "",
        qty_on_hand: item.qty_on_hand,
        reorder_point: product?.reorder_point || 0,
        image_url: product?.image_url || null,
        category: product?.category || null,
      };
    });

    setInventory(inventoryItems);

    // Extract unique categories
    const uniqueCategories = Array.from(
      new Set(inventoryItems.map((item) => item.category).filter(Boolean))
    ) as string[];
    setCategories(uniqueCategories.sort());

    setLastUpdated(new Date());
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchInventory();
  }, [client]);

  const getItemStockStatus = (qty: number, reorderPoint: number): StockStatusFilter => {
    if (qty === 0) return "out_of_stock";
    if (qty <= reorderPoint) return "low_stock";
    return "in_stock";
  };

  const filteredInventory = inventory.filter((item) => {
    // Search filter
    const matchesSearch =
      item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase());

    // Category filter
    const matchesCategory =
      categoryFilter === "all" || item.category === categoryFilter;

    // Status filter
    const itemStatus = getItemStockStatus(item.qty_on_hand, item.reorder_point);
    const matchesStatus = statusFilter === "all" || itemStatus === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getStockStatus = (qty: number, reorderPoint: number) => {
    if (qty === 0) {
      return { label: "Out of Stock", color: "bg-red-100 text-red-700" };
    }
    if (qty <= reorderPoint) {
      return { label: "Low Stock", color: "bg-yellow-100 text-yellow-700" };
    }
    return { label: "In Stock", color: "bg-green-100 text-green-700" };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Your Inventory</h1>
        <p className="text-gray-500 mt-1">Products stored at 7 Degrees</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by product name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Category Filter */}
        <div className="relative">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="appearance-none w-full sm:w-48 px-4 py-3 pr-10 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StockStatusFilter)}
            className="appearance-none w-full sm:w-44 px-4 py-3 pr-10 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        </div>

        {/* View Toggle */}
        <div className="flex border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setViewMode("grid")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              viewMode === "grid"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden sm:inline">Grid</span>
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-l border-gray-200 ${
              viewMode === "list"
                ? "bg-blue-600 text-white border-l-blue-600"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">List</span>
          </button>
        </div>
      </div>

      {/* Inventory Display */}
      {filteredInventory.length > 0 ? (
        viewMode === "grid" ? (
          // Grid View
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredInventory.map((item) => {
              const status = getStockStatus(item.qty_on_hand, item.reorder_point);

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {/* Product Image */}
                  <div className="relative">
                    <ProductImageCard
                      src={item.image_url}
                      alt={item.product_name}
                      aspectRatio="square"
                    />
                    {/* Status Badge */}
                    <span
                      className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  {/* Product Details */}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 truncate" title={item.product_name}>
                      {item.product_name}
                    </h3>
                    <p className="text-sm text-gray-500 font-mono mt-1">{item.sku}</p>

                    {/* Quantity */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Available</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {item.qty_on_hand.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400">units</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // List View
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-4 px-4 text-sm font-semibold text-gray-600">
                      Product
                    </th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-gray-600">
                      SKU
                    </th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-gray-600">
                      Category
                    </th>
                    <th className="text-right py-4 px-4 text-sm font-semibold text-gray-600">
                      Available
                    </th>
                    <th className="text-center py-4 px-4 text-sm font-semibold text-gray-600">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((item) => {
                    const status = getStockStatus(item.qty_on_hand, item.reorder_point);

                    return (
                      <tr
                        key={item.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <ProductThumbnail
                              src={item.image_url}
                              alt={item.product_name}
                              size="md"
                            />
                            <span className="font-medium text-gray-900">{item.product_name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm text-gray-500 font-mono">{item.sku}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm text-gray-600">
                            {item.category || "—"}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className="font-semibold text-gray-900">
                            {item.qty_on_hand.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}
                          >
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          {searchQuery || categoryFilter !== "all" || statusFilter !== "all" ? (
            <>
              <p className="text-lg">No products match your filters</p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setCategoryFilter("all");
                  setStatusFilter("all");
                }}
                className="text-blue-600 hover:underline mt-2"
              >
                Clear all filters
              </button>
            </>
          ) : (
            <p className="text-lg">No inventory items yet</p>
          )}
        </div>
      )}

      {/* Summary & Last Updated */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
        <div>
          {filteredInventory.length > 0 && (
            <span>Showing {filteredInventory.length} of {inventory.length} products</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span>
              Last updated: {lastUpdated.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </span>
          )}
          <button
            onClick={() => fetchInventory(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>
    </div>
  );
}
