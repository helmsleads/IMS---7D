"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Package, Search, ChevronDown, LayoutGrid, List, RefreshCw, Truck, X, Plus, Minus, ShoppingCart, Trash2, DollarSign, Settings2, Eye, EyeOff, Pencil } from "lucide-react";
import { ProductImageCard, ProductThumbnail } from "@/components/ui/ProductImage";
import { useClient } from "@/lib/client-auth";
import { createClient } from "@/lib/supabase";
import { getMyProductValues, updateMyProductValue, ProductValue } from "@/lib/api/portal-profitability";

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

interface CartItem {
  inventory_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  qty_to_ship: number;
  qty_available: number;
  image_url: string | null;
}

type StockStatusFilter = "all" | "in_stock" | "low_stock" | "out_of_stock";
type ViewMode = "grid" | "list";

export default function PortalInventoryPage() {
  const { client } = useClient();
  const router = useRouter();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StockStatusFilter>("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Quick Add to Shipment Modal
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [quickAddQty, setQuickAddQty] = useState(1);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCartModal, setShowCartModal] = useState(false);

  // Optional Columns & Product Values
  const [showSalePrice, setShowSalePrice] = useState(false);
  const [showCost, setShowCost] = useState(false);
  const [showMargin, setShowMargin] = useState(false);
  const [productValues, setProductValues] = useState<Map<string, ProductValue>>(new Map());
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [editingValueId, setEditingValueId] = useState<string | null>(null);
  const [editSalePrice, setEditSalePrice] = useState<string>("");
  const [editCost, setEditCost] = useState<string>("");
  const [savingValue, setSavingValue] = useState(false);

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

  const fetchProductValues = async () => {
    if (!client) return;

    try {
      const values = await getMyProductValues(client.id);
      const valueMap = new Map(values.map((v) => [v.productId, v]));
      setProductValues(valueMap);
    } catch (error) {
      console.error("Failed to fetch product values:", error);
    }
  };

  useEffect(() => {
    fetchInventory();
    fetchProductValues();
  }, [client]);

  // Get product value helpers
  const getProductValue = (productId: string): ProductValue | undefined => {
    return productValues.get(productId);
  };

  const getSalePrice = (productId: string): number | null => {
    return getProductValue(productId)?.salePrice ?? null;
  };

  const getCost = (productId: string): number | null => {
    const value = getProductValue(productId);
    return value?.cost ?? value?.defaultUnitCost ?? null;
  };

  const getMargin = (productId: string): { value: number; percent: number } | null => {
    const salePrice = getSalePrice(productId);
    const cost = getCost(productId);
    if (salePrice === null || cost === null || salePrice === 0) return null;
    const margin = salePrice - cost;
    const percent = (margin / salePrice) * 100;
    return { value: margin, percent };
  };

  const formatCurrency = (value: number | null): string => {
    if (value === null) return "—";
    return `$${value.toFixed(2)}`;
  };

  const startEditingValue = (item: InventoryItem) => {
    const value = getProductValue(item.product_id);
    setEditingValueId(item.product_id);
    setEditSalePrice(value?.salePrice?.toString() || "");
    setEditCost(value?.cost?.toString() || value?.defaultUnitCost?.toString() || "");
  };

  const cancelEditingValue = () => {
    setEditingValueId(null);
    setEditSalePrice("");
    setEditCost("");
  };

  const saveProductValue = async (productId: string) => {
    if (!client) return;

    setSavingValue(true);
    try {
      const salePrice = editSalePrice ? parseFloat(editSalePrice) : null;
      const cost = editCost ? parseFloat(editCost) : null;

      const updated = await updateMyProductValue(client.id, productId, salePrice, cost);
      setProductValues((prev) => {
        const newMap = new Map(prev);
        newMap.set(productId, updated);
        return newMap;
      });
      cancelEditingValue();
    } catch (error) {
      console.error("Failed to save product value:", error);
      alert("Failed to save. Please try again.");
    } finally {
      setSavingValue(false);
    }
  };

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

  const openQuickAddModal = (item: InventoryItem) => {
    setSelectedItem(item);
    // Check if item is already in cart and set quantity accordingly
    const existingCartItem = cart.find((c) => c.product_id === item.product_id);
    setQuickAddQty(existingCartItem ? existingCartItem.qty_to_ship : 1);
    setShowQuickAddModal(true);
  };

  const closeQuickAddModal = () => {
    setShowQuickAddModal(false);
    setSelectedItem(null);
    setQuickAddQty(1);
  };

  const addToCart = (continueShoping: boolean) => {
    if (!selectedItem) return;

    const cartItem: CartItem = {
      inventory_id: selectedItem.id,
      product_id: selectedItem.product_id,
      product_name: selectedItem.product_name,
      sku: selectedItem.sku,
      qty_to_ship: quickAddQty,
      qty_available: selectedItem.qty_on_hand,
      image_url: selectedItem.image_url,
    };

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.product_id === selectedItem.product_id);
      if (existingIndex >= 0) {
        // Update quantity
        const newCart = [...prevCart];
        newCart[existingIndex] = { ...newCart[existingIndex], qty_to_ship: quickAddQty };
        return newCart;
      } else {
        return [...prevCart, cartItem];
      }
    });

    closeQuickAddModal();

    if (!continueShoping) {
      // Go to checkout
      handleCheckout();
    }
  };

  const updateCartItemQty = (productId: string, newQty: number) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.product_id === productId
          ? { ...item, qty_to_ship: Math.min(Math.max(1, newQty), item.qty_available) }
          : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.product_id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setShowCartModal(false);
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;

    // Store cart in localStorage for request-shipment page
    const shipmentItems = cart.map((item) => ({
      inventory_id: item.inventory_id,
      product_id: item.product_id,
      product_name: item.product_name,
      sku: item.sku,
      qty_to_ship: item.qty_to_ship,
      qty_available: item.qty_available,
    }));

    localStorage.setItem("shipment_cart", JSON.stringify(shipmentItems));
    router.push("/portal/request-shipment");
  };

  const cartItemCount = cart.reduce((total, item) => total + item.qty_to_ship, 0);
  const cartProductCount = cart.length;

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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your Inventory</h1>
          <p className="text-gray-500 mt-1">Products stored at 7 Degrees</p>
        </div>

        {/* Cart Button */}
        <button
          onClick={() => setShowCartModal(true)}
          className="relative flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="font-medium">View Cart</span>
          {cartProductCount > 0 && (
            <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {cartProductCount > 9 ? "9+" : cartProductCount}
            </span>
          )}
        </button>
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

        {/* Column Settings */}
        <div className="relative">
          <button
            onClick={() => setShowColumnSettings(!showColumnSettings)}
            className={`flex items-center gap-2 px-4 py-3 border rounded-xl transition-colors ${
              showColumnSettings || showSalePrice || showCost || showMargin
                ? "border-blue-500 bg-blue-50 text-blue-600"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Settings2 className="w-4 h-4" />
            <span className="hidden sm:inline">Columns</span>
            {(showSalePrice || showCost || showMargin) && (
              <span className="w-5 h-5 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {[showSalePrice, showCost, showMargin].filter(Boolean).length}
              </span>
            )}
          </button>

          {/* Column Settings Dropdown */}
          {showColumnSettings && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowColumnSettings(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-20 p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Value Columns
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-gray-700">Sale Price</span>
                    <button
                      onClick={() => setShowSalePrice(!showSalePrice)}
                      className={`w-10 h-6 rounded-full transition-colors ${
                        showSalePrice ? "bg-blue-600" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`block w-4 h-4 bg-white rounded-full transform transition-transform ${
                          showSalePrice ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-gray-700">Cost</span>
                    <button
                      onClick={() => setShowCost(!showCost)}
                      className={`w-10 h-6 rounded-full transition-colors ${
                        showCost ? "bg-blue-600" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`block w-4 h-4 bg-white rounded-full transform transition-transform ${
                          showCost ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-gray-700">Margin</span>
                    <button
                      onClick={() => setShowMargin(!showMargin)}
                      className={`w-10 h-6 rounded-full transition-colors ${
                        showMargin ? "bg-blue-600" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`block w-4 h-4 bg-white rounded-full transform transition-transform ${
                          showMargin ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </label>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <Link
                    href="/portal/profitability"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit all values in Profitability
                  </Link>
                </div>
              </div>
            </>
          )}
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
                    <Link
                      href={`/portal/inventory/${item.product_id}`}
                      className="font-semibold text-gray-900 truncate block hover:text-blue-600 transition-colors"
                      title={item.product_name}
                    >
                      {item.product_name}
                    </Link>
                    <p className="text-sm text-gray-500 font-mono mt-1">{item.sku}</p>

                    {/* Quantity */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Available</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {item.qty_on_hand.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400">units</p>
                    </div>

                    {/* Value Columns (when enabled) */}
                    {(showSalePrice || showCost || showMargin) && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        {editingValueId === item.product_id ? (
                          // Inline Edit Mode
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-gray-500">Sale Price</label>
                                <div className="relative">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editSalePrice}
                                    onChange={(e) => setEditSalePrice(e.target.value)}
                                    className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                    placeholder="0.00"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="text-xs text-gray-500">Cost</label>
                                <div className="relative">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editCost}
                                    onChange={(e) => setEditCost(e.target.value)}
                                    className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                    placeholder="0.00"
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveProductValue(item.product_id)}
                                disabled={savingValue}
                                className="flex-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                              >
                                {savingValue ? "Saving..." : "Save"}
                              </button>
                              <button
                                onClick={cancelEditingValue}
                                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          // Display Mode
                          <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-2 text-sm">
                              {showSalePrice && (
                                <div>
                                  <p className="text-xs text-gray-500">Sale</p>
                                  <p className="font-semibold text-gray-900">
                                    {formatCurrency(getSalePrice(item.product_id))}
                                  </p>
                                </div>
                              )}
                              {showCost && (
                                <div>
                                  <p className="text-xs text-gray-500">Cost</p>
                                  <p className="font-semibold text-gray-900">
                                    {formatCurrency(getCost(item.product_id))}
                                  </p>
                                </div>
                              )}
                              {showMargin && (
                                <div>
                                  <p className="text-xs text-gray-500">Margin</p>
                                  {getMargin(item.product_id) ? (
                                    <p className={`font-semibold ${getMargin(item.product_id)!.value >= 0 ? "text-green-600" : "text-red-600"}`}>
                                      {getMargin(item.product_id)!.percent.toFixed(1)}%
                                    </p>
                                  ) : (
                                    <p className="text-gray-400">—</p>
                                  )}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => startEditingValue(item)}
                              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                            >
                              <Pencil className="w-3 h-3" />
                              Edit Values
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Add to Shipment Button */}
                    <button
                      onClick={() => openQuickAddModal(item)}
                      disabled={item.qty_on_hand === 0}
                      className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      <Truck className="w-4 h-4" />
                      Add to Shipment
                    </button>
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
                    {showSalePrice && (
                      <th className="text-right py-4 px-4 text-sm font-semibold text-gray-600">
                        Sale Price
                      </th>
                    )}
                    {showCost && (
                      <th className="text-right py-4 px-4 text-sm font-semibold text-gray-600">
                        Cost
                      </th>
                    )}
                    {showMargin && (
                      <th className="text-right py-4 px-4 text-sm font-semibold text-gray-600">
                        Margin
                      </th>
                    )}
                    <th className="text-center py-4 px-4 text-sm font-semibold text-gray-600">
                      Status
                    </th>
                    <th className="text-center py-4 px-4 text-sm font-semibold text-gray-600">
                      Action
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
                          <Link
                            href={`/portal/inventory/${item.product_id}`}
                            className="flex items-center gap-3 group"
                          >
                            <ProductThumbnail
                              src={item.image_url}
                              alt={item.product_name}
                              size="md"
                            />
                            <span className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                              {item.product_name}
                            </span>
                          </Link>
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
                        {showSalePrice && (
                          <td className="py-4 px-4 text-right">
                            {editingValueId === item.product_id ? (
                              <div className="relative inline-block">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editSalePrice}
                                  onChange={(e) => setEditSalePrice(e.target.value)}
                                  className="w-20 pl-5 pr-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                  placeholder="0.00"
                                />
                              </div>
                            ) : (
                              <span className="font-medium text-gray-900">
                                {formatCurrency(getSalePrice(item.product_id))}
                              </span>
                            )}
                          </td>
                        )}
                        {showCost && (
                          <td className="py-4 px-4 text-right">
                            {editingValueId === item.product_id ? (
                              <div className="relative inline-block">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editCost}
                                  onChange={(e) => setEditCost(e.target.value)}
                                  className="w-20 pl-5 pr-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                  placeholder="0.00"
                                />
                              </div>
                            ) : (
                              <span className="font-medium text-gray-900">
                                {formatCurrency(getCost(item.product_id))}
                              </span>
                            )}
                          </td>
                        )}
                        {showMargin && (
                          <td className="py-4 px-4 text-right">
                            {getMargin(item.product_id) ? (
                              <span className={`font-medium ${getMargin(item.product_id)!.value >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {getMargin(item.product_id)!.percent.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        )}
                        <td className="py-4 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-center gap-2">
                            {(showSalePrice || showCost || showMargin) && (
                              editingValueId === item.product_id ? (
                                <>
                                  <button
                                    onClick={() => saveProductValue(item.product_id)}
                                    disabled={savingValue}
                                    className="px-2.5 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                                  >
                                    {savingValue ? "..." : "Save"}
                                  </button>
                                  <button
                                    onClick={cancelEditingValue}
                                    className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => startEditingValue(item)}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit Values"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              )
                            )}
                            <button
                              onClick={() => openQuickAddModal(item)}
                              disabled={item.qty_on_hand === 0}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              Add
                            </button>
                          </div>
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

      {/* Quick Add to Shipment Modal */}
      {showQuickAddModal && selectedItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={closeQuickAddModal}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Add to Shipment
                </h2>
                <button
                  onClick={closeQuickAddModal}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                {/* Product Info */}
                <div className="flex items-center gap-4 mb-6">
                  <ProductThumbnail
                    src={selectedItem.image_url}
                    alt={selectedItem.product_name}
                    size="lg"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {selectedItem.product_name}
                    </h3>
                    <p className="text-sm text-gray-500 font-mono">{selectedItem.sku}</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {selectedItem.qty_on_hand.toLocaleString()} available
                    </p>
                  </div>
                </div>

                {/* Quantity Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity to Ship
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuickAddQty(Math.max(1, quickAddQty - 1))}
                      disabled={quickAddQty <= 1}
                      className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={selectedItem.qty_on_hand}
                      value={quickAddQty}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        setQuickAddQty(Math.min(Math.max(1, val), selectedItem.qty_on_hand));
                      }}
                      className="w-24 text-center px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={() => setQuickAddQty(Math.min(selectedItem.qty_on_hand, quickAddQty + 1))}
                      disabled={quickAddQty >= selectedItem.qty_on_hand}
                      className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {quickAddQty > selectedItem.qty_on_hand && (
                    <p className="text-sm text-red-500 mt-2">
                      Cannot exceed available quantity
                    </p>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex flex-col gap-3 p-6 border-t border-gray-200">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => addToCart(true)}
                    disabled={quickAddQty < 1 || quickAddQty > selectedItem.qty_on_hand}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Add & Continue Shopping
                  </button>
                  <button
                    onClick={() => addToCart(false)}
                    disabled={quickAddQty < 1 || quickAddQty > selectedItem.qty_on_hand}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    <Truck className="w-4 h-4" />
                    Add & Checkout
                  </button>
                </div>
                <button
                  onClick={closeQuickAddModal}
                  className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart Summary Modal */}
      {showCartModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={() => setShowCartModal(false)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Shipment Cart
                  </h2>
                  <p className="text-sm text-gray-500">
                    {cartProductCount} {cartProductCount === 1 ? "product" : "products"}, {cartItemCount} {cartItemCount === 1 ? "unit" : "units"} total
                  </p>
                </div>
                <button
                  onClick={() => setShowCartModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 max-h-[400px] overflow-y-auto">
                {cart.length > 0 ? (
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div
                        key={item.product_id}
                        className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                      >
                        <ProductThumbnail
                          src={item.image_url}
                          alt={item.product_name}
                          size="md"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">
                            {item.product_name}
                          </h4>
                          <p className="text-xs text-gray-500 font-mono">{item.sku}</p>
                          <p className="text-xs text-gray-400">
                            {item.qty_available.toLocaleString()} available
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateCartItemQty(item.product_id, item.qty_to_ship - 1)}
                            disabled={item.qty_to_ship <= 1}
                            className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-10 text-center font-medium text-gray-900">
                            {item.qty_to_ship}
                          </span>
                          <button
                            onClick={() => updateCartItemQty(item.product_id, item.qty_to_ship + 1)}
                            disabled={item.qty_to_ship >= item.qty_available}
                            className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.product_id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">Your cart is empty</p>
                    <p className="text-sm mt-1">
                      Add products from your inventory to request a shipment
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex flex-col gap-3 p-6 border-t border-gray-200">
                {cart.length > 0 && (
                  <>
                    <button
                      onClick={handleCheckout}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      <Truck className="w-5 h-5" />
                      Checkout ({cartProductCount} {cartProductCount === 1 ? "product" : "products"})
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowCartModal(false)}
                        className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Continue Shopping
                      </button>
                      <button
                        onClick={clearCart}
                        className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        Clear Cart
                      </button>
                    </div>
                  </>
                )}
                {cart.length === 0 && (
                  <button
                    onClick={() => setShowCartModal(false)}
                    className="w-full px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Continue Browsing
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
