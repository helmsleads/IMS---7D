"use client";

import { useState } from "react";
import { ServiceAddon, ServiceStatus } from "@/types/database";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

interface ServiceAddonFormProps {
  addon?: ServiceAddon;
  serviceId: string;
  onSave: (data: Partial<ServiceAddon>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

const priceUnitOptions = [
  { value: "per_month", label: "Per Month" },
  { value: "per_pallet", label: "Per Pallet" },
  { value: "per_case", label: "Per Case" },
  { value: "per_order", label: "Per Order" },
  { value: "per_item", label: "Per Item" },
  { value: "one_time", label: "One Time" },
  { value: "flat", label: "Flat Rate" },
];

const statusOptions: { value: ServiceStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

export default function ServiceAddonForm({
  addon,
  serviceId,
  onSave,
  onCancel,
  onDelete,
}: ServiceAddonFormProps) {
  const [name, setName] = useState(addon?.name || "");
  const [slug, setSlug] = useState(addon?.slug || "");
  const [description, setDescription] = useState(addon?.description || "");
  const [price, setPrice] = useState(addon?.price ?? 0);
  const [priceUnit, setPriceUnit] = useState(addon?.price_unit || "per_month");
  const [status, setStatus] = useState<ServiceStatus>(addon?.status || "active");
  const [sortOrder, setSortOrder] = useState(addon?.sort_order || 0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!addon) {
      setSlug(generateSlug(value));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!slug.trim()) {
      newErrors.slug = "Slug is required";
    }

    if (price === null || price === undefined || isNaN(price) || price < 0) {
      newErrors.price = "Price is required and must be >= 0";
    }

    if (!priceUnit) {
      newErrors.price_unit = "Price unit is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const addonData: Partial<ServiceAddon> = {
      service_id: serviceId,
      name,
      slug,
      description: description || null,
      price: price || null,
      price_unit: priceUnit || null,
      status,
      sort_order: sortOrder,
    };

    onSave(addonData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Name"
          name="name"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          error={errors.name}
          required
        />
        <Input
          label="Slug"
          name="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          error={errors.slug}
          required
          placeholder="url-friendly-identifier"
        />
      </div>

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
          placeholder="Describe this add-on"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Price"
          name="price"
          type="number"
          value={price}
          onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
          error={errors.price}
          required
          min={0}
          step={0.01}
        />
        <div className="w-full">
          <label
            htmlFor="price_unit"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Price Unit <span className="text-red-500">*</span>
          </label>
          <select
            id="price_unit"
            name="price_unit"
            value={priceUnit}
            onChange={(e) => setPriceUnit(e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.price_unit ? "border-red-500" : "border-gray-300"
            }`}
          >
            {priceUnitOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.price_unit && (
            <p className="mt-1 text-sm text-red-500">{errors.price_unit}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Status"
          name="status"
          options={statusOptions}
          value={status}
          onChange={(e) => setStatus(e.target.value as ServiceStatus)}
        />
        <Input
          label="Sort Order"
          name="sort_order"
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
          min={0}
        />
      </div>

      <div className="pt-6 flex items-center justify-between border-t border-gray-200">
        <div>
          {addon && onDelete && (
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
            {addon ? "Update Add-On" : "Create Add-On"}
          </Button>
        </div>
      </div>

      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Add-On"
        size="sm"
      >
        <p className="text-gray-600 mb-4">
          Are you sure you want to delete this add-on? This action cannot be undone.
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
