"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Alert from "@/components/ui/Alert";
import { getProducts, Product } from "@/lib/api/products";
import { getClients, Client } from "@/lib/api/clients";
import {
  createOutboundOrder,
  CreateOutboundOrderData,
  CreateOutboundItemData,
} from "@/lib/api/outbound";

interface OrderItem {
  id: string;
  product_id: string;
  qty_requested: number;
  unit_price: number;
}

function formatClientAddress(client: Client): string {
  const parts: string[] = [];

  if (client.address_line1) {
    parts.push(client.address_line1);
  }
  if (client.address_line2) {
    parts.push(client.address_line2);
  }

  const cityStateZip: string[] = [];
  if (client.city) cityStateZip.push(client.city);
  if (client.state) cityStateZip.push(client.state);
  if (client.zip) cityStateZip.push(client.zip);

  if (cityStateZip.length > 0) {
    parts.push(cityStateZip.join(", "));
  }

  return parts.join("\n");
}

export default function NewOutboundOrderPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [clientId, setClientId] = useState("");
  const [shipToAddress, setShipToAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsData, clientsData] = await Promise.all([
          getProducts(),
          getClients(),
        ]);
        setProducts(productsData.filter((p) => p.active));
        setClients(clientsData.filter((c) => c.active));
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Populate address when client changes
  const handleClientChange = (newClientId: string) => {
    setClientId(newClientId);

    if (newClientId) {
      const selectedClient = clients.find((c) => c.id === newClientId);
      if (selectedClient) {
        setShipToAddress(formatClientAddress(selectedClient));
      }
    } else {
      setShipToAddress("");
    }
  };

  const availableProducts = products.filter(
    (p) => !items.some((item) => item.product_id === p.id)
  );

  const productOptions = availableProducts.map((p) => ({
    value: p.id,
    label: `${p.sku} - ${p.name}`,
  }));

  const clientOptions = clients.map((c) => ({
    value: c.id,
    label: c.company_name,
  }));

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

    if (!clientId) {
      newErrors.client = "Client is required";
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
        client_id: clientId || null,
        ship_to_address: shipToAddress.trim() || null,
        notes: notes.trim() || null,
        status: "confirmed", // Skip pending since internal order
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
                <Select
                  label="Client"
                  name="client_id"
                  options={clientOptions}
                  value={clientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                  placeholder="Select client"
                  error={errors.client}
                  required
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ship To Address
                  </label>
                  <textarea
                    name="ship_to_address"
                    value={shipToAddress}
                    onChange={(e) => setShipToAddress(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Shipping address"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Auto-populated from client. Edit if shipping to a different address.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Optional notes (add 'rush' or 'urgent' for priority orders)"
                  />
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
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
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

                        return (
                          <tr key={item.id}>
                            <td className="px-4 py-3">
                              <Select
                                name={`product-${item.id}`}
                                options={itemProductOptions}
                                value={item.product_id}
                                onChange={(e) =>
                                  updateItem(item.id, "product_id", e.target.value)
                                }
                                placeholder="Select product"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <Input
                                name={`qty-${item.id}`}
                                type="number"
                                min={1}
                                value={item.qty_requested}
                                onChange={(e) =>
                                  updateItem(
                                    item.id,
                                    "qty_requested",
                                    parseInt(e.target.value) || 0
                                  )
                                }
                              />
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
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Client</span>
                  <span className="font-medium text-gray-900">
                    {clientId
                      ? clients.find((c) => c.id === clientId)?.company_name || "—"
                      : "—"}
                  </span>
                </div>
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
