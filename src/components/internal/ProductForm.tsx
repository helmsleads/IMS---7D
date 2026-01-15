"use client";

import { useState } from "react";
import { Product } from "@/lib/api/products";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

interface ProductFormProps {
  product?: Product;
  onSave: (data: Partial<Product>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

const categoryOptions = [
  { value: "Gin", label: "Gin" },
  { value: "Vodka", label: "Vodka" },
  { value: "Whiskey", label: "Whiskey" },
  { value: "Tequila", label: "Tequila" },
  { value: "Rum", label: "Rum" },
  { value: "Other", label: "Other" },
];

export default function ProductForm({
  product,
  onSave,
  onCancel,
  onDelete,
}: ProductFormProps) {
  const [sku, setSku] = useState(product?.sku || "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [name, setName] = useState(product?.name || "");
  const [description, setDescription] = useState(product?.description || "");
  const [category, setCategory] = useState(product?.category || "");
  const [unitCost, setUnitCost] = useState(product?.unit_cost || 0);
  const [basePrice, setBasePrice] = useState(product?.base_price || 0);
  const [reorderPoint, setReorderPoint] = useState(product?.reorder_point || 0);
  const [barcode, setBarcode] = useState(product?.barcode || "");
  const [imageUrl, setImageUrl] = useState(product?.image_url || "");
  const [active, setActive] = useState(product?.active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!sku.trim()) {
      newErrors.sku = "SKU is required";
    }

    if (!name.trim()) {
      newErrors.name = "Name is required";
    }

    if (isNaN(unitCost) || unitCost < 0) {
      newErrors.unit_cost = "Unit cost must be a valid number >= 0";
    }

    if (isNaN(basePrice) || basePrice < 0) {
      newErrors.base_price = "Base price must be a valid number >= 0";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const productData: Partial<Product> = {
      sku,
      name,
      description: description || null,
      category: category || null,
      unit_cost: unitCost,
      base_price: basePrice,
      reorder_point: reorderPoint,
      barcode: barcode || null,
      image_url: imageUrl || null,
      active,
    };

    onSave(productData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="SKU"
        name="sku"
        value={sku}
        onChange={(e) => setSku(e.target.value)}
        error={errors.sku}
        required
      />
      <Input
        label="Name"
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        required
      />
      <div className="w-full">
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <Select
        label="Category"
        name="category"
        options={categoryOptions}
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Select a category"
      />

      <div className="pt-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Pricing</h3>
        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Unit Cost"
            name="unit_cost"
            type="number"
            value={unitCost}
            onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
            error={errors.unit_cost}
            required
            min={0}
            step={0.01}
          />
          <Input
            label="Base Price"
            name="base_price"
            type="number"
            value={basePrice}
            onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
            error={errors.base_price}
            required
            min={0}
            step={0.01}
          />
          <Input
            label="Reorder Point"
            name="reorder_point"
            type="number"
            value={reorderPoint}
            onChange={(e) => setReorderPoint(parseInt(e.target.value) || 0)}
            min={0}
          />
        </div>
      </div>

      <div className="pt-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Identification</h3>
        <div className="space-y-4">
          <Input
            label="Barcode"
            name="barcode"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
          />
          <Input
            label="Image URL"
            name="image_url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              name="active"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="active" className="text-sm font-medium text-gray-700">
              Active
            </label>
          </div>
        </div>
      </div>

      <div className="pt-6 flex items-center justify-between border-t border-gray-200">
        <div>
          {product && onDelete && (
            <Button
              type="button"
              variant="danger"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete
            </Button>
          )}
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">
            {product ? "Update" : "Create"}
          </Button>
        </div>
      </div>

      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Product"
        size="sm"
      >
        <p className="text-gray-600 mb-4">
          Are you sure you want to delete this product? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => setShowDeleteConfirm(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setShowDeleteConfirm(false);
              onDelete?.();
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </form>
  );
}
