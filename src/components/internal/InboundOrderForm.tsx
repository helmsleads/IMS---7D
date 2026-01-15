"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { Product } from "@/lib/api/products";
import { CreateInboundOrderData, CreateInboundItemData } from "@/lib/api/inbound";

interface InboundOrderFormProps {
  products: Product[];
  onSave: (data: CreateInboundOrderData, items: CreateInboundItemData[]) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

interface OrderItem {
  id: string;
  product_id: string;
  qty_expected: number;
}

export default function InboundOrderForm({
  products,
  onSave,
  onCancel,
  saving = false,
}: InboundOrderFormProps) {
  const [supplier, setSupplier] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const availableProducts = products.filter(
    (p) => !items.some((item) => item.product_id === p.id)
  );

  const productOptions = availableProducts.map((p) => ({
    value: p.id,
    label: `${p.sku} - ${p.name}`,
  }));

  const addItem = () => {
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        product_id: "",
        qty_expected: 1,
      },
    ]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof OrderItem, value: string | number) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!supplier.trim()) {
      newErrors.supplier = "Supplier is required";
    }

    if (items.length === 0) {
      newErrors.items = "At least one item is required";
    }

    const invalidItems = items.filter(
      (item) => !item.product_id || item.qty_expected < 1
    );
    if (invalidItems.length > 0) {
      newErrors.items = "All items must have a product and quantity of at least 1";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const orderData: CreateInboundOrderData = {
      supplier: supplier.trim(),
      expected_date: expectedDate || null,
      notes: notes.trim() || null,
    };

    const itemsData: CreateInboundItemData[] = items.map((item) => ({
      product_id: item.product_id,
      qty_expected: item.qty_expected,
    }));

    await onSave(orderData, itemsData);
  };

  const getProductInfo = (productId: string) => {
    return products.find((p) => p.id === productId);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Order Details */}
      <div className="space-y-4">
        <Input
          label="Supplier"
          name="supplier"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          error={errors.supplier}
          required
          placeholder="e.g., ABC Distributors"
        />

        <Input
          label="Expected Date"
          name="expected_date"
          type="date"
          value={expectedDate}
          onChange={(e) => setExpectedDate(e.target.value)}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Optional notes about this order"
          />
        </div>
      </div>

      {/* Order Items */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-700">
            Order Items
          </label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addItem}
            disabled={availableProducts.length === 0}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Item
          </Button>
        </div>

        {errors.items && (
          <p className="text-sm text-red-600 mb-2">{errors.items}</p>
        )}

        {items.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center">
            <p className="text-gray-500 text-sm">
              No items added yet. Click &quot;Add Item&quot; to add products to this order.
            </p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    Quantity
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
                          value={item.qty_expected}
                          onChange={(e) =>
                            updateItem(
                              item.id,
                              "qty_expected",
                              parseInt(e.target.value) || 0
                            )
                          }
                        />
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
      </div>

      {/* Summary */}
      {items.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total Items:</span>
            <span className="font-medium text-gray-900">{items.length}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-600">Total Units:</span>
            <span className="font-medium text-gray-900">
              {items.reduce((sum, item) => sum + item.qty_expected, 0)}
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving} disabled={saving}>
          Create Purchase Order
        </Button>
      </div>
    </form>
  );
}
