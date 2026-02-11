"use client";

import { useState, useEffect, useMemo } from "react";
import { Product, ProductWithCategory } from "@/lib/api/products";
import { getCategoriesWithSubcategories, CategoryWithSubcategories } from "@/lib/api/product-categories";
import { getClients, Client } from "@/lib/api/clients";
import { getAllWorkflowProfiles } from "@/lib/api/workflow-profiles";
import { WorkflowProfile } from "@/types/database";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

interface ProductFormProps {
  product?: ProductWithCategory;
  onSave: (data: Partial<Product>) => Promise<void> | void;
  onCancel: () => void;
  onDelete?: () => void;
}

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
  const [categoryId, setCategoryId] = useState(product?.category_id || "");
  const [subcategoryId, setSubcategoryId] = useState(product?.subcategory_id || "");
  const [clientId, setClientId] = useState(product?.client_id || "");
  const [containerType, setContainerType] = useState<string>((product as any)?.container_type || "bottle");
  const [unitsPerCase, setUnitsPerCase] = useState<number>((product as any)?.units_per_case || 1);
  const [unitCost, setUnitCost] = useState(product?.unit_cost || 0);
  const [basePrice, setBasePrice] = useState(product?.base_price || 0);
  const [reorderPoint, setReorderPoint] = useState(product?.reorder_point || 0);
  const [barcode, setBarcode] = useState(product?.barcode || "");
  const [imageUrl, setImageUrl] = useState(product?.image_url || "");
  const [active, setActive] = useState(product?.active ?? true);
  const [workflowProfileId, setWorkflowProfileId] = useState(product?.workflow_profile_id || "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<CategoryWithSubcategories[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [workflowProfiles, setWorkflowProfiles] = useState<WorkflowProfile[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingWorkflows, setLoadingWorkflows] = useState(true);

  // Container type options for box selection
  const containerTypeOptions = [
    { value: "bottle", label: "Bottle" },
    { value: "can", label: "Can / RTD" },
    { value: "keg", label: "Keg" },
    { value: "bag_in_box", label: "Bag-in-Box" },
    { value: "gift_box", label: "Gift Box" },
    { value: "raw_materials", label: "Raw Materials" },
    { value: "empty_bottle", label: "Empty Bottle" },
    { value: "merchandise", label: "Merchandise" },
    { value: "sample", label: "Sample / ML" },
    { value: "other", label: "Other" },
  ];

  // Fetch categories and clients on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await getCategoriesWithSubcategories();
        setCategories(data);
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      } finally {
        setLoadingCategories(false);
      }
    };

    const fetchClients = async () => {
      try {
        const data = await getClients();
        setClients(data.filter(c => c.active)); // Only show active clients
      } catch (error) {
        console.error("Failed to fetch clients:", error);
      } finally {
        setLoadingClients(false);
      }
    };

    const fetchWorkflowProfiles = async () => {
      try {
        const data = await getAllWorkflowProfiles();
        setWorkflowProfiles(data);
      } catch (error) {
        console.error("Failed to fetch workflow profiles:", error);
      } finally {
        setLoadingWorkflows(false);
      }
    };

    fetchCategories();
    fetchClients();
    fetchWorkflowProfiles();
  }, []);

  // Build category options
  const categoryOptions = useMemo(() => {
    return categories.map((cat) => ({
      value: cat.id,
      label: `${cat.icon || ""} ${cat.name}`.trim(),
    }));
  }, [categories]);

  // Build client options
  const clientOptions = useMemo(() => {
    return clients.map((client) => ({
      value: client.id,
      label: client.company_name,
    }));
  }, [clients]);

  // Build workflow profile options for product-level override selector
  const workflowProfileOptions = useMemo(() => {
    return workflowProfiles.map((profile) => ({
      value: profile.id,
      label: profile.name,
    }));
  }, [workflowProfiles]);

  /**
   * Product-Level Workflow Override Feature
   * ----------------------------------------
   * When a client has allow_product_workflow_override=true, individual products
   * can have their own workflow profile instead of using the client default.
   *
   * This is useful when a client has products with different handling requirements
   * (e.g., hazmat vs regular items, or different compliance needs).
   *
   * The workflow selector only appears when:
   * 1. A client is selected
   * 2. That client has allow_product_workflow_override enabled
   *
   * See: docs/WORKFLOW_BUILDER_PLAN.md for full documentation
   */
  const selectedClient = useMemo(() => {
    return clients.find((c) => c.id === clientId);
  }, [clients, clientId]);

  const allowsWorkflowOverride = selectedClient?.allow_product_workflow_override ?? false;

  // Build subcategory options based on selected category
  const subcategoryOptions = useMemo(() => {
    if (!categoryId) return [];
    const selectedCategory = categories.find((c) => c.id === categoryId);
    if (!selectedCategory) return [];
    return selectedCategory.subcategories.map((sub) => ({
      value: sub.id,
      label: sub.name,
    }));
  }, [categoryId, categories]);

  // Clear subcategory when category changes
  const handleCategoryChange = (newCategoryId: string) => {
    setCategoryId(newCategoryId);
    setSubcategoryId(""); // Reset subcategory when category changes
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || saving) return;

    // Find category name for legacy field
    const selectedCategory = categories.find((c) => c.id === categoryId);

    const productData: Partial<Product> & { container_type?: string; workflow_profile_id?: string | null } = {
      sku,
      name,
      description: description || null,
      category: selectedCategory?.name || null, // Legacy field for backwards compatibility
      category_id: categoryId || null,
      subcategory_id: subcategoryId || null,
      client_id: clientId || null,
      container_type: containerType,
      units_per_case: unitsPerCase,
      unit_cost: unitCost,
      base_price: basePrice,
      reorder_point: reorderPoint,
      barcode: barcode || null,
      image_url: imageUrl || null,
      active,
      // Only include workflow_profile_id if client allows override
      workflow_profile_id: allowsWorkflowOverride ? (workflowProfileId || null) : null,
    };

    setSaving(true);
    try {
      await onSave(productData);
    } catch (error) {
      // Error is handled by parent, but we need to re-enable the button
      console.error("Save failed:", error);
    } finally {
      setSaving(false);
    }
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
        label="Client (Owner)"
        name="client_id"
        options={clientOptions}
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        placeholder={loadingClients ? "Loading..." : "Select a client (optional)"}
        disabled={loadingClients}
        hint="Assign this product to a specific client for their portal access"
      />

      {/* Workflow Profile Override - only shown if client allows it */}
      {clientId && allowsWorkflowOverride && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <Select
            label="Workflow Profile Override"
            name="workflow_profile_id"
            options={workflowProfileOptions}
            value={workflowProfileId}
            onChange={(e) => setWorkflowProfileId(e.target.value)}
            placeholder={loadingWorkflows ? "Loading..." : "Use client default workflow"}
            disabled={loadingWorkflows}
            hint="Override the client's default workflow for this product only"
          />
          <p className="mt-2 text-xs text-blue-600">
            This client allows product-level workflow overrides. Select a workflow profile
            to use for this product, or leave blank to use the client&apos;s default workflow.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Category"
          name="category_id"
          options={categoryOptions}
          value={categoryId}
          onChange={(e) => handleCategoryChange(e.target.value)}
          placeholder={loadingCategories ? "Loading..." : "Select a category"}
          disabled={loadingCategories}
        />
        <Select
          label="Subcategory"
          name="subcategory_id"
          options={subcategoryOptions}
          value={subcategoryId}
          onChange={(e) => setSubcategoryId(e.target.value)}
          placeholder={!categoryId ? "Select category first" : "Select a subcategory"}
          disabled={!categoryId || subcategoryOptions.length === 0}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Container Type"
          name="container_type"
          options={containerTypeOptions}
          value={containerType}
          onChange={(e) => {
            const ct = e.target.value;
            setContainerType(ct);
            // Auto-set units per case based on container type
            if (ct === "bottle" || ct === "empty_bottle") setUnitsPerCase(6);
            else if (ct === "can") setUnitsPerCase(24);
            else if (ct === "keg") setUnitsPerCase(1);
            else if (ct === "merchandise" || ct === "raw_materials" || ct === "sample" || ct === "other") setUnitsPerCase(1);
          }}
        />
        <Input
          label="Units Per Case"
          name="units_per_case"
          type="number"
          min={1}
          value={unitsPerCase}
          onChange={(e) => setUnitsPerCase(parseInt(e.target.value) || 1)}
        />
      </div>

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
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : product ? "Update" : "Create"}
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
