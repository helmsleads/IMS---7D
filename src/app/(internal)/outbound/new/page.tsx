"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import SearchSelect from "@/components/ui/SearchSelect";
import Alert from "@/components/ui/Alert";
import { getProducts, ProductWithCategory } from "@/lib/api/products";
import { getClients, Client } from "@/lib/api/clients";
import { createClient } from "@/lib/supabase";
import {
  createOutboundOrder,
  CreateOutboundOrderData,
  CreateOutboundItemData,
} from "@/lib/api/outbound";
import { getContainerBadge, getUnitLabel } from "@/lib/labels";
import { formatStreetAddress, formatCity, formatState, formatName, formatZip } from "@/lib/format-address";
interface OrderItem {
  id: string;
  product_id: string;
  qty_requested: number;
  unit_price: number;
}

export default function NewOutboundOrderPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [recipientName, setRecipientName] = useState("");
  const [requestor, setRequestor] = useState("");
  const [shipToAddress, setShipToAddress] = useState("");
  const [shipToAddress2, setShipToAddress2] = useState("");
  const [shipToCity, setShipToCity] = useState("");
  const [shipToState, setShipToState] = useState("");
  const [shipToZip, setShipToZip] = useState("");
  const [shippingMethod, setShippingMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [requiresRepack, setRequiresRepack] = useState(true);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Stock levels: product_id → total qty_on_hand across all locations
  const [stockMap, setStockMap] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient();
        const [productsData, clientsData, inventoryData] = await Promise.all([
          getProducts(),
          getClients(),
          supabase
            .from("inventory")
            .select("product_id, qty_on_hand")
            .gt("qty_on_hand", 0),
        ]);
        setProducts(productsData.filter((p) => p.active));
        setClients(clientsData.filter((c) => c.active));

        // Aggregate stock across all locations per product
        const map = new Map<string, number>();
        for (const row of inventoryData.data || []) {
          map.set(row.product_id, (map.get(row.product_id) || 0) + (row.qty_on_hand || 0));
        }
        setStockMap(map);
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // First selected brand is the "primary client" for address prefill and order.client_id
  const primaryClientId = selectedBrandIds[0] || "";

  // Brands not yet selected (available in the "add brand" dropdown)
  const availableBrands = clients.filter((c) => !selectedBrandIds.includes(c.id));

  // Add a brand to the order
  const handleAddBrand = (brandId: string) => {
    if (!brandId || selectedBrandIds.includes(brandId)) return;
    const next = [...selectedBrandIds, brandId];
    setSelectedBrandIds(next);

    // Prefill address from the first brand
    if (next.length === 1) {
      const firstClient = clients.find((c) => c.id === brandId);
      if (firstClient) {
        setShipToAddress(firstClient.address_line1 || "");
        setShipToAddress2(firstClient.address_line2 || "");
        setShipToCity(firstClient.city || "");
        setShipToState(firstClient.state || "");
        setShipToZip(firstClient.zip || "");
      }
    }
  };

  // Remove a brand from the order
  const handleRemoveBrand = (brandId: string) => {
    const next = selectedBrandIds.filter((id) => id !== brandId);
    setSelectedBrandIds(next);

    // Clear items that belong to the removed brand
    setItems((currentItems) =>
      currentItems.filter((item) => {
        if (!item.product_id) return true;
        const product = products.find((p) => p.id === item.product_id);
        return product?.client_id !== brandId;
      })
    );

    // Re-prefill address from new first brand (or clear)
    const firstId = next[0];
    if (firstId) {
      const firstClient = clients.find((c) => c.id === firstId);
      if (firstClient) {
        setShipToAddress(firstClient.address_line1 || "");
        setShipToAddress2(firstClient.address_line2 || "");
        setShipToCity(firstClient.city || "");
        setShipToState(firstClient.state || "");
        setShipToZip(firstClient.zip || "");
      }
    } else {
      setShipToAddress("");
      setShipToAddress2("");
      setShipToCity("");
      setShipToState("");
      setShipToZip("");
    }
  };

  const availableProducts = products.filter(
    (p) =>
      !items.some((item) => item.product_id === p.id) &&
      selectedBrandIds.length > 0 &&
      p.client_id &&
      selectedBrandIds.includes(p.client_id)
  );

  // Helper: get stock level for a product
  const getStock = (productId: string): number => stockMap.get(productId) || 0;

  // Helper: check if product is at/below reorder point
  const isLowStock = (product: ProductWithCategory): boolean => {
    const stock = getStock(product.id);
    return stock > 0 && stock <= product.reorder_point;
  };

  const productOptions = availableProducts.map((p) => {
    const stock = getStock(p.id);
    const brandLabel = p.client?.company_name ? ` [${p.client.company_name}]` : "";
    const stockLabel = stock === 0
      ? " (OUT OF STOCK)"
      : isLowStock(p)
        ? ` (${stock} left)`
        : "";
    return {
      value: p.id,
      label: `${p.sku} - ${p.name}${brandLabel}${stockLabel}`,
    };
  });

  const addItem = () => {
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        product_id: "",
        qty_requested: 1,
        unit_price: 0,
      },
    ]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof OrderItem, value: string | number) => {
    setItems(
      items.map((item) => {
        if (item.id !== id) return item;

        // If changing product, auto-fill the unit price from product's base_price
        if (field === "product_id" && typeof value === "string") {
          const product = products.find((p) => p.id === value);
          return {
            ...item,
            product_id: value,
            unit_price: product?.base_price || 0,
          };
        }

        return { ...item, [field]: value };
      })
    );
  };

  const getProductInfo = (productId: string) => {
    return products.find((p) => p.id === productId);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (selectedBrandIds.length === 0) {
      newErrors.client = "At least one brand is required";
    }

    if (items.length === 0) {
      newErrors.items = "At least one item is required";
    }

    const invalidItems = items.filter(
      (item) => !item.product_id || item.qty_requested < 1
    );
    if (invalidItems.length > 0) {
      newErrors.items = "All items must have a product and quantity of at least 1";
    }

    // Check for out-of-stock items
    const outOfStockItems = items.filter(
      (item) => item.product_id && getStock(item.product_id) === 0
    );
    if (outOfStockItems.length > 0) {
      const names = outOfStockItems
        .map((item) => products.find((p) => p.id === item.product_id)?.name || "Unknown")
        .join(", ");
      newErrors.items = `Cannot submit: ${names} ${outOfStockItems.length === 1 ? "is" : "are"} out of stock`;
    }

    // Check for items exceeding available stock
    if (!newErrors.items) {
      const overStockItems = items.filter(
        (item) => item.product_id && item.qty_requested > getStock(item.product_id) && getStock(item.product_id) > 0
      );
      if (overStockItems.length > 0) {
        const details = overStockItems
          .map((item) => {
            const name = products.find((p) => p.id === item.product_id)?.name || "Unknown";
            return `${name} (${getStock(item.product_id)} available, ${item.qty_requested} requested)`;
          })
          .join("; ");
        newErrors.items = `Requested quantity exceeds available stock: ${details}`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!validate()) return;

    setSaving(true);
    try {
      const orderData: CreateOutboundOrderData = {
        client_id: primaryClientId || null,
        recipient_name: recipientName.trim() || null,
        requestor: requestor.trim() || null,
        ship_to_address: shipToAddress.trim() || null,
        ship_to_address2: shipToAddress2.trim() || null,
        ship_to_city: shipToCity.trim() || null,
        ship_to_state: shipToState.trim() || null,
        ship_to_zip: shipToZip.trim() || null,
        preferred_carrier: shippingMethod || null,
        notes: notes.trim() || null,
        status: "confirmed",
        source: "internal",
        requires_repack: requiresRepack,
        is_multi_client: isMultiClient,
      };

      const itemsData: CreateOutboundItemData[] = items.map((item) => ({
        product_id: item.product_id,
        qty_requested: item.qty_requested,
        unit_price: item.unit_price,
      }));

      const createdOrder = await createOutboundOrder(orderData, itemsData);

      setSuccess(`Order ${createdOrder.order_number} created successfully!`);

      setTimeout(() => {
        router.push(`/outbound/${createdOrder.id}`);
      }, 1000);
    } catch (err) {
      console.error("Failed to create order:", err);
      setError(err instanceof Error ? err.message : "Failed to create order");
      setSaving(false);
    }
  };

  const totalUnits = items.reduce((sum, item) => sum + item.qty_requested, 0);
  const totalValue = items.reduce(
    (sum, item) => sum + item.qty_requested * item.unit_price,
    0
  );

  // Compute per-client breakdown for multi-client summary
  const clientBreakdown = (() => {
    const map = new Map<string, { name: string; units: number }>();
    for (const item of items) {
      if (!item.product_id) continue;
      const product = products.find((p) => p.id === item.product_id);
      const cId = product?.client_id || "unassigned";
      const cName = product?.client?.company_name || "Unassigned";
      const existing = map.get(cId) || { name: cName, units: 0 };
      existing.units += item.qty_requested;
      map.set(cId, existing);
    }
    return Array.from(map.entries()).map(([id, data]) => ({
      clientId: id,
      clientName: data.name,
      units: data.units,
      percent: totalUnits > 0 ? Math.round((data.units / totalUnits) * 100) : 0,
    }));
  })();

  const isMultiClient = clientBreakdown.length > 1;

  const backLink = (
    <Link
      href="/outbound"
      className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to Outbound Orders
    </Link>
  );

  return (
    <AppShell
      title="Create Shipment Order"
      subtitle="Create a new outbound order for a client"
      actions={backLink}
    >
      {error && (
        <div className="mb-4">
          <Alert type="error" message={error} onClose={() => setError("")} />
        </div>
      )}

      {success && (
        <div className="mb-4">
          <Alert type="success" message={success} />
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Details */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Order Details
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Brand <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <select
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) handleAddBrand(e.target.value);
                        }}
                      >
                        <option value="">
                          {selectedBrandIds.length === 0
                            ? "Select brand..."
                            : "Add another brand..."}
                        </option>
                        {availableBrands.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.company_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* Selected brand tags */}
                    {selectedBrandIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {selectedBrandIds.map((id, idx) => {
                          const brand = clients.find((c) => c.id === id);
                          return (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 border border-indigo-200 text-indigo-700"
                            >
                              {brand?.company_name}
                              {idx === 0 && selectedBrandIds.length > 1 && (
                                <span className="text-[9px] uppercase tracking-wider text-indigo-400 ml-0.5">
                                  primary
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveBrand(id)}
                                className="ml-0.5 hover:text-indigo-900 transition-colors"
                              >
                                &times;
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {errors.client && (
                      <p className="text-sm text-red-600 mt-1">{errors.client}</p>
                    )}
                  </div>
                  <Input
                    label="Date"
                    name="order_date"
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Recipient Name"
                    name="recipient_name"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    onBlur={() => setRecipientName(formatName(recipientName))}
                    placeholder="Who is this being shipped to?"
                  />
                  <Input
                    label="Requestor"
                    name="requestor"
                    value={requestor}
                    onChange={(e) => setRequestor(e.target.value)}
                    placeholder="Who requested this order?"
                  />
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">Shipping Address</p>
                  <div className="space-y-3">
                    <Input
                      label="Address"
                      name="ship_to_address"
                      value={shipToAddress}
                      onChange={(e) => setShipToAddress(e.target.value)}
                      onBlur={() => setShipToAddress(formatStreetAddress(shipToAddress))}
                      placeholder="Street address"
                    />
                    <Input
                      name="ship_to_address2"
                      value={shipToAddress2}
                      onChange={(e) => setShipToAddress2(e.target.value)}
                      onBlur={() => setShipToAddress2(formatStreetAddress(shipToAddress2))}
                      placeholder="Apt, suite, unit, etc. (optional)"
                    />
                    <div className="grid grid-cols-6 gap-3">
                      <div className="col-span-3">
                        <Input
                          label="City"
                          name="ship_to_city"
                          value={shipToCity}
                          onChange={(e) => setShipToCity(e.target.value)}
                          onBlur={() => setShipToCity(formatCity(shipToCity))}
                          placeholder="City"
                        />
                      </div>
                      <div className="col-span-1">
                        <Input
                          label="State"
                          name="ship_to_state"
                          value={shipToState}
                          onChange={(e) => setShipToState(e.target.value)}
                          onBlur={() => setShipToState(formatState(shipToState))}
                          placeholder="ST"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          label="Zip Code"
                          name="ship_to_zip"
                          value={shipToZip}
                          onChange={(e) => setShipToZip(e.target.value)}
                          onBlur={() => setShipToZip(formatZip(shipToZip))}
                          placeholder="Zip code"
                        />
                      </div>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Auto-populated from primary brand. Edit if shipping to a different address.
                  </p>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <Select
                    label="Shipping Method"
                    name="shipping_method"
                    options={[
                      { value: "ground", label: "Ground" },
                      { value: "2day", label: "2-Day" },
                      { value: "overnight", label: "Overnight" },
                      { value: "freight", label: "Freight / LTL" },
                      { value: "pickup", label: "Customer Pickup" },
                      { value: "other", label: "Other" },
                    ]}
                    value={shippingMethod}
                    onChange={(e) => setShippingMethod(e.target.value)}
                    placeholder="Select shipping method"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Optional notes (add 'rush' or 'urgent' for priority orders)"
                  />
                </div>

                {/* Repack Option */}
                <div className="pt-4 border-t border-gray-200">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requiresRepack}
                      onChange={(e) => setRequiresRepack(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        Requires repacking
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {requiresRepack
                          ? "Items will be packed into shipping boxes (box fees apply)"
                          : "Ship in original cases/packaging (no box fees)"
                        }
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </Card>

            {/* Line Items */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Line Items
                </h2>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addItem}
                  disabled={availableProducts.length === 0 || loading}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Product
                </Button>
              </div>

              {errors.items && (
                <p className="text-sm text-red-600 mb-3">{errors.items}</p>
              )}

              {items.length === 0 ? (
                <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <p className="text-gray-500 mb-3">
                    No products added yet. Click &quot;Add Product&quot; to add items to this order.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={addItem}
                    disabled={availableProducts.length === 0 || loading}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Product
                  </Button>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-44">
                          Quantity
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                          Unit Price
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                          Subtotal
                        </th>
                        <th className="px-4 py-3 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {items.map((item) => {
                        const product = getProductInfo(item.product_id);
                        const itemProductOptions = item.product_id
                          ? [
                              {
                                value: item.product_id,
                                label: product
                                  ? `${product.sku} - ${product.name}`
                                  : "",
                              },
                              ...productOptions,
                            ]
                          : productOptions;

                        const subtotal = item.qty_requested * item.unit_price;
                        const stock = item.product_id ? getStock(item.product_id) : null;
                        const outOfStock = stock !== null && stock === 0;
                        const lowStock = product && stock !== null && stock > 0 && isLowStock(product);
                        const overRequested = stock !== null && stock > 0 && item.qty_requested > stock;

                        return (
                          <tr key={item.id} className={outOfStock ? "bg-red-50" : ""}>
                            <td className="px-4 py-3">
                              <SearchSelect
                                name={`product-${item.id}`}
                                options={itemProductOptions}
                                value={item.product_id}
                                onChange={(val) =>
                                  updateItem(item.id, "product_id", val)
                                }
                                placeholder="Type SKU or name..."
                              />
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                {product?.container_type && (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getContainerBadge(product.container_type).color}`}>
                                    {getContainerBadge(product.container_type).label}
                                  </span>
                                )}
                                {product?.client && (
                                  <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-50 text-indigo-700">
                                    {product.client.company_name}
                                  </span>
                                )}
                                {outOfStock && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                                    <AlertTriangle className="w-3 h-3" />
                                    Out of stock
                                  </span>
                                )}
                                {lowStock && !overRequested && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                                    <AlertTriangle className="w-3 h-3" />
                                    Low stock — {stock} available
                                  </span>
                                )}
                                {overRequested && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                                    <AlertTriangle className="w-3 h-3" />
                                    Only {stock} available
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Input
                                  name={`qty-${item.id}`}
                                  type="number"
                                  min={1}
                                  value={item.qty_requested}
                                  className="w-20"
                                  onChange={(e) =>
                                    updateItem(
                                      item.id,
                                      "qty_requested",
                                      parseInt(e.target.value) || 0
                                    )
                                  }
                                />
                                <span className="text-xs text-slate-500 whitespace-nowrap">
                                  {getUnitLabel(product?.container_type)}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Input
                                name={`price-${item.id}`}
                                type="number"
                                min={0}
                                step={0.01}
                                value={item.unit_price}
                                onChange={(e) =>
                                  updateItem(
                                    item.id,
                                    "unit_price",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm font-medium text-gray-900">
                                ${subtotal.toFixed(2)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Summary */}
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Summary
              </h2>
              <div className="space-y-3">
                <div className="text-sm">
                  <span className="text-gray-600">Brands</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selectedBrandIds.length === 0 ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      selectedBrandIds.map((id) => (
                        <span
                          key={id}
                          className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-50 text-indigo-700"
                        >
                          {clients.find((c) => c.id === id)?.company_name}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                {isMultiClient && items.length > 0 && (
                  <div className="border-t border-gray-200 pt-3">
                    <p className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1.5 rounded mb-2">
                      Multi-brand order — costs split proportionally
                    </p>
                    <div className="space-y-1">
                      {clientBreakdown.map((cb) => (
                        <div key={cb.clientId} className="flex justify-between text-xs">
                          <span className="text-gray-600">{cb.clientName}</span>
                          <span className="font-medium text-gray-900">
                            {cb.units} units ({cb.percent}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Items</span>
                    <span className="font-medium text-gray-900">
                      {items.length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-600">Total Units</span>
                    <span className="font-medium text-gray-900">
                      {totalUnits.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between text-base">
                    <span className="font-medium text-gray-700">Total Value</span>
                    <span className="font-semibold text-gray-900">
                      ${totalValue.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Actions */}
            <Card>
              <div className="space-y-3">
                <Button
                  type="submit"
                  className="w-full"
                  loading={saving}
                  disabled={saving}
                >
                  Create Order
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => router.push("/outbound")}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </form>
    </AppShell>
  );
}
