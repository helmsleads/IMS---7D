"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, PackageOpen } from "lucide-react";
import Link from "next/link";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import SearchSelect from "@/components/ui/SearchSelect";
import Alert from "@/components/ui/Alert";
import { getProducts, Product } from "@/lib/api/products";
import { getClients, Client } from "@/lib/api/clients";
import {
  createOutboundOrder,
  CreateOutboundOrderData,
  CreateOutboundItemData,
} from "@/lib/api/outbound";
import {
  suggestBoxesForOrder,
  BOX_TYPES,
  PACKING_MATERIALS,
} from "@/lib/api/box-usage";

interface OrderItem {
  id: string;
  product_id: string;
  qty_requested: number;
  unit_price: number;
}

interface SupplyLine {
  id: string;
  code: string;
  name: string;
  qty: number;
  unitPrice: number;
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
  const [supplyLines, setSupplyLines] = useState<SupplyLine[]>([]);
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

  // Populate address when client changes and clear items (products are client-specific)
  const handleClientChange = (newClientId: string) => {
    setClientId(newClientId);
    setItems([]);
    setSupplyLines([]);

    if (newClientId) {
      const selectedClient = clients.find((c) => c.id === newClientId);
      if (selectedClient) {
        setShipToAddress(selectedClient.address_line1 || "");
        setShipToAddress2(selectedClient.address_line2 || "");
        setShipToCity(selectedClient.city || "");
        setShipToState(selectedClient.state || "");
        setShipToZip(selectedClient.zip || "");
      }
    } else {
      setShipToAddress("");
      setShipToAddress2("");
      setShipToCity("");
      setShipToState("");
      setShipToZip("");
    }
  };

  // Auto-recalculate supplies when items or repack setting changes
  useEffect(() => {
    if (!requiresRepack || items.length === 0 || items.every((i) => !i.product_id)) {
      setSupplyLines([]);
      return;
    }

    const orderItems = items
      .filter((item) => item.product_id)
      .map((item) => {
        const product = products.find((p) => p.id === item.product_id);
        return {
          qty: item.qty_requested,
          containerType: (product?.container_type || "bottle") as "bottle" | "can" | "keg" | "bag_in_box" | "other",
        };
      });

    if (orderItems.length === 0) {
      setSupplyLines([]);
      return;
    }

    const boxResult = suggestBoxesForOrder(orderItems);
    const newLines: SupplyLine[] = [];

    for (const box of [...boxResult.bottles, ...boxResult.cans]) {
      newLines.push({
        id: crypto.randomUUID(),
        code: box.code,
        name: box.name,
        qty: box.qty,
        unitPrice: box.price,
      });
    }

    // Add inserts for bottles
    if (boxResult.totalBottles > 0) {
      const insertMaterial = PACKING_MATERIALS.find((m) => m.code === "INSERT");
      if (insertMaterial) {
        newLines.push({
          id: crypto.randomUUID(),
          code: insertMaterial.code,
          name: insertMaterial.name,
          qty: boxResult.totalBottles,
          unitPrice: insertMaterial.price,
        });
      }
    }

    setSupplyLines(newLines);
  }, [items, requiresRepack, products]);

  const availableProducts = products.filter(
    (p) =>
      !items.some((item) => item.product_id === p.id) &&
      (!clientId || !p.client_id || p.client_id === clientId)
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

  // Supply line helpers
  const allSupplyOptions = [
    ...BOX_TYPES.map((b) => ({ value: b.code, label: b.name, unitPrice: b.price })),
    ...PACKING_MATERIALS.map((m) => ({ value: m.code, label: m.name, unitPrice: m.price })),
  ];

  const addSupplyLine = () => {
    setSupplyLines([
      ...supplyLines,
      { id: crypto.randomUUID(), code: "", name: "", qty: 1, unitPrice: 0 },
    ]);
  };

  const removeSupplyLine = (id: string) => {
    setSupplyLines(supplyLines.filter((s) => s.id !== id));
  };

  const updateSupplyLine = (id: string, field: string, value: string | number) => {
    setSupplyLines(
      supplyLines.map((line) => {
        if (line.id !== id) return line;
        if (field === "code") {
          const option = allSupplyOptions.find((o) => o.value === value);
          return {
            ...line,
            code: value as string,
            name: option?.label || "",
            unitPrice: option?.unitPrice || 0,
          };
        }
        return { ...line, [field]: value };
      })
    );
  };

  const suppliesTotal = supplyLines.reduce((sum, s) => sum + s.qty * s.unitPrice, 0);

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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      placeholder="Street address"
                    />
                    <Input
                      name="ship_to_address2"
                      value={shipToAddress2}
                      onChange={(e) => setShipToAddress2(e.target.value)}
                      placeholder="Apt, suite, unit, etc. (optional)"
                    />
                    <div className="grid grid-cols-6 gap-3">
                      <div className="col-span-3">
                        <Input
                          label="City"
                          name="ship_to_city"
                          value={shipToCity}
                          onChange={(e) => setShipToCity(e.target.value)}
                          placeholder="City"
                        />
                      </div>
                      <div className="col-span-1">
                        <Input
                          label="State"
                          name="ship_to_state"
                          value={shipToState}
                          onChange={(e) => setShipToState(e.target.value)}
                          placeholder="ST"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          label="Zip Code"
                          name="ship_to_zip"
                          value={shipToZip}
                          onChange={(e) => setShipToZip(e.target.value)}
                          placeholder="Zip code"
                        />
                      </div>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Auto-populated from client. Edit if shipping to a different address.
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
                              <SearchSelect
                                name={`product-${item.id}`}
                                options={itemProductOptions}
                                value={item.product_id}
                                onChange={(val) =>
                                  updateItem(item.id, "product_id", val)
                                }
                                placeholder="Type SKU or name..."
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

            {/* Shipment Supplies */}
            {requiresRepack && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <PackageOpen className="w-5 h-5 text-indigo-500" />
                    <h2 className="text-lg font-semibold text-gray-900">
                      Shipment Supplies
                    </h2>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={addSupplyLine}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Supply
                  </Button>
                </div>

                {supplyLines.length === 0 ? (
                  <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <p className="text-gray-500 text-sm">
                      Add products above to auto-suggest supplies, or add manually.
                    </p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Supply
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                            Qty
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                            Unit Price
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                            Total
                          </th>
                          <th className="px-4 py-2.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {supplyLines.map((line) => {
                          const lineTotal = line.qty * line.unitPrice;
                          return (
                            <tr key={line.id}>
                              <td className="px-4 py-2.5">
                                <select
                                  value={line.code}
                                  onChange={(e) =>
                                    updateSupplyLine(line.id, "code", e.target.value)
                                  }
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                  <option value="">Select supply</option>
                                  <optgroup label="Boxes">
                                    {BOX_TYPES.map((b) => (
                                      <option key={b.code} value={b.code}>
                                        {b.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                  <optgroup label="Packing Materials">
                                    {PACKING_MATERIALS.map((m) => (
                                      <option key={m.code} value={m.code}>
                                        {m.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                </select>
                              </td>
                              <td className="px-4 py-2.5">
                                <input
                                  type="number"
                                  min={1}
                                  value={line.qty}
                                  onChange={(e) =>
                                    updateSupplyLine(
                                      line.id,
                                      "qty",
                                      parseInt(e.target.value) || 0
                                    )
                                  }
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="text-sm text-gray-600">
                                  ${line.unitPrice.toFixed(2)}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <span className="text-sm font-medium text-gray-900">
                                  ${lineTotal.toFixed(2)}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                <button
                                  type="button"
                                  onClick={() => removeSupplyLine(line.id)}
                                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td
                            colSpan={3}
                            className="px-4 py-2.5 text-sm font-medium text-gray-700 text-right"
                          >
                            Supplies Total
                          </td>
                          <td className="px-4 py-2.5 text-right text-sm font-semibold text-gray-900">
                            ${suppliesTotal.toFixed(2)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  Auto-suggested from products. Adjust quantities or add more as needed.
                </p>
              </Card>
            )}
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
                {supplyLines.length > 0 && (
                  <div className="border-t border-gray-200 pt-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Supplies ({supplyLines.length})</span>
                      <span className="font-medium text-gray-900">
                        ${suppliesTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
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
