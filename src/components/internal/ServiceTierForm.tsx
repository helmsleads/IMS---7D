"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { ServiceTier, ServiceStatus } from "@/types/database";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

interface ServiceTierFormProps {
  tier?: ServiceTier;
  onSave: (data: Partial<ServiceTier>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

const statusOptions: { value: ServiceStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

export default function ServiceTierForm({
  tier,
  onSave,
  onCancel,
  onDelete,
}: ServiceTierFormProps) {
  const [name, setName] = useState(tier?.name || "");
  const [slug, setSlug] = useState(tier?.slug || "");
  const [description, setDescription] = useState(tier?.description || "");
  const [minVolume, setMinVolume] = useState<number | "">(tier?.min_volume ?? "");
  const [maxVolume, setMaxVolume] = useState<number | "">(tier?.max_volume ?? "");
  const [features, setFeatures] = useState<string[]>(tier?.features || []);
  const [newFeature, setNewFeature] = useState("");
  const [isPopular, setIsPopular] = useState(tier?.is_popular || false);
  const [status, setStatus] = useState<ServiceStatus>(tier?.status || "active");
  const [sortOrder, setSortOrder] = useState(tier?.sort_order || 0);
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
    if (!tier) {
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

    if (minVolume !== "" && maxVolume !== "" && minVolume > maxVolume) {
      newErrors.max_volume = "Max volume must be greater than min volume";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const tierData: Partial<ServiceTier> = {
      name,
      slug,
      description: description || null,
      min_volume: minVolume === "" ? null : minVolume,
      max_volume: maxVolume === "" ? null : maxVolume,
      features,
      is_popular: isPopular,
      status,
      sort_order: sortOrder,
    };

    onSave(tierData);
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
          placeholder="e.g., Basic, Standard, Premium"
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
          placeholder="Describe this tier"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="pt-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Volume Range</h3>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Min Volume"
            name="min_volume"
            type="number"
            value={minVolume}
            onChange={(e) => setMinVolume(e.target.value === "" ? "" : parseInt(e.target.value))}
            min={0}
            placeholder="e.g., 0"
          />
          <Input
            label="Max Volume"
            name="max_volume"
            type="number"
            value={maxVolume}
            onChange={(e) => setMaxVolume(e.target.value === "" ? "" : parseInt(e.target.value))}
            error={errors.max_volume}
            min={0}
            placeholder="e.g., 1000"
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

      <div className="flex items-center gap-2 pt-2">
        <input
          type="checkbox"
          id="is_popular"
          name="is_popular"
          checked={isPopular}
          onChange={(e) => setIsPopular(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="is_popular" className="text-sm font-medium text-gray-700">
          Mark as popular (highlighted in UI)
        </label>
      </div>

      <div className="pt-6 flex items-center justify-between border-t border-gray-200">
        <div>
          {tier && onDelete && (
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
            {tier ? "Update Tier" : "Create Tier"}
          </Button>
        </div>
      </div>

      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Tier"
        size="sm"
      >
        <p className="text-gray-600 mb-4">
          Are you sure you want to delete this tier? This action cannot be undone.
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
