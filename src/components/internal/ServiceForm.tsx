"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Service, ServiceStatus } from "@/types/database";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

interface ServiceFormProps {
  service?: Service;
  onSave: (data: Partial<Service>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

const priceUnitOptions = [
  { value: "per_month", label: "Per Month" },
  { value: "per_pallet", label: "Per Pallet" },
  { value: "per_case", label: "Per Case" },
  { value: "per_order", label: "Per Order" },
  { value: "per_item", label: "Per Item" },
  { value: "per_case_month", label: "Per Case/Month" },
  { value: "per_pallet_month", label: "Per Pallet/Month" },
  { value: "flat", label: "Flat Rate" },
];

const iconOptions = [
  { value: "Briefcase", label: "Briefcase" },
  { value: "Package", label: "Package" },
  { value: "Truck", label: "Truck" },
  { value: "Warehouse", label: "Warehouse" },
  { value: "Box", label: "Box" },
  { value: "ClipboardList", label: "Clipboard List" },
  { value: "Settings", label: "Settings" },
  { value: "Shield", label: "Shield" },
  { value: "Zap", label: "Zap" },
  { value: "Users", label: "Users" },
  { value: "Archive", label: "Archive" },
  { value: "BarChart", label: "Bar Chart" },
  { value: "Calendar", label: "Calendar" },
  { value: "Clock", label: "Clock" },
  { value: "Database", label: "Database" },
  { value: "FileText", label: "File Text" },
  { value: "Globe", label: "Globe" },
  { value: "Home", label: "Home" },
  { value: "Layers", label: "Layers" },
  { value: "Map", label: "Map" },
  { value: "Send", label: "Send" },
  { value: "ShoppingCart", label: "Shopping Cart" },
  { value: "Tag", label: "Tag" },
  { value: "Target", label: "Target" },
];

const statusOptions: { value: ServiceStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

export default function ServiceForm({
  service,
  onSave,
  onCancel,
  onDelete,
}: ServiceFormProps) {
  const [name, setName] = useState(service?.name || "");
  const [slug, setSlug] = useState(service?.slug || "");
  const [description, setDescription] = useState(service?.description || "");
  const [fullDescription, setFullDescription] = useState(service?.full_description || "");
  const [icon, setIcon] = useState(service?.icon || "Briefcase");
  const [features, setFeatures] = useState<string[]>(service?.features || []);
  const [newFeature, setNewFeature] = useState("");
  const [basePrice, setBasePrice] = useState(service?.base_price ?? 0);
  const [priceUnit, setPriceUnit] = useState(service?.price_unit || "per_month");
  const [status, setStatus] = useState<ServiceStatus>(service?.status || "active");
  const [sortOrder, setSortOrder] = useState(service?.sort_order || 0);
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
    if (!service) {
      setSlug(generateSlug(value));
    }
  };

  const handleAddFeature = () => {
    const trimmed = newFeature.trim();
    if (trimmed && !features.includes(trimmed)) {
      setFeatures([...features, trimmed]);
      setNewFeature("");
    }
  };

  const handleRemoveFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index));
  };

  const handleFeatureKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddFeature();
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

    if (basePrice !== null && (isNaN(basePrice) || basePrice < 0)) {
      newErrors.base_price = "Base price must be a valid number >= 0";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const serviceData: Partial<Service> = {
      name,
      slug,
      description: description || null,
      full_description: fullDescription || null,
      icon: icon || null,
      features,
      base_price: basePrice || null,
      price_unit: priceUnit || null,
      status,
      sort_order: sortOrder,
    };

    onSave(serviceData);
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
          Short Description
        </label>
        <textarea
          id="description"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Brief description for listings"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="w-full">
        <label
          htmlFor="full_description"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Full Description (Portal Display)
        </label>
        <textarea
          id="full_description"
          name="full_description"
          value={fullDescription}
          onChange={(e) => setFullDescription(e.target.value)}
          rows={4}
          placeholder="Detailed description shown on the client portal"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Icon"
          name="icon"
          options={iconOptions}
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
        />
        <Select
          label="Status"
          name="status"
          options={statusOptions}
          value={status}
          onChange={(e) => setStatus(e.target.value as ServiceStatus)}
        />
      </div>

      <div className="pt-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Pricing</h3>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Base Price"
            name="base_price"
            type="number"
            value={basePrice}
            onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
            error={errors.base_price}
            min={0}
            step={0.01}
          />
          <Select
            label="Price Unit"
            name="price_unit"
            options={priceUnitOptions}
            value={priceUnit}
            onChange={(e) => setPriceUnit(e.target.value)}
          />
        </div>
      </div>

      <div className="pt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Features
        </label>
        <div className="space-y-2">
          {features.map((feature, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 bg-gray-50 rounded-md"
            >
              <span className="flex-1 text-sm text-gray-700">{feature}</span>
              <button
                type="button"
                onClick={() => handleRemoveFeature(index)}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              value={newFeature}
              onChange={(e) => setNewFeature(e.target.value)}
              onKeyDown={handleFeatureKeyDown}
              placeholder="Add a feature..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAddFeature}
              disabled={!newFeature.trim()}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <Input
        label="Sort Order"
        name="sort_order"
        type="number"
        value={sortOrder}
        onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
        min={0}
      />

      <div className="pt-6 flex items-center justify-between border-t border-gray-200">
        <div>
          {service && onDelete && (
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
            {service ? "Update Service" : "Create Service"}
          </Button>
        </div>
      </div>

      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Service"
        size="sm"
      >
        <p className="text-gray-600 mb-4">
          Are you sure you want to delete this service? This action cannot be undone.
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
