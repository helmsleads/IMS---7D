"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  Search,
  Package,
  MapPin,
  MoreVertical,
  Edit2,
  Trash2,
  ShoppingCart,
  ChevronRight,
  X,
  Minus,
} from "lucide-react";
import { useClient } from "@/lib/client-auth";
import Card from "@/components/ui/Card";
import {
  getMyTemplates,
  getMyTemplate,
  createMyTemplate,
  updateMyTemplate,
  deleteMyTemplate,
  PortalTemplate,
  PortalTemplateWithItems,
  CreateTemplateItem,
} from "@/lib/api/portal-templates";
import { getMyAddresses, PortalAddress } from "@/lib/api/portal-addresses";
import { getClientInventory, ClientInventoryItem } from "@/lib/api/portal-inventory";

interface TemplateFormItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
}

export default function PortalTemplatesPage() {
  const { client } = useClient();
  const [templates, setTemplates] = useState<PortalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PortalTemplateWithItems | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAddressId, setFormAddressId] = useState<string>("");
  const [formItems, setFormItems] = useState<TemplateFormItem[]>([]);

  // Product selection state
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [addQuantity, setAddQuantity] = useState(1);

  // Data for dropdowns
  const [addresses, setAddresses] = useState<PortalAddress[]>([]);
  const [inventory, setInventory] = useState<ClientInventoryItem[]>([]);

  useEffect(() => {
    const fetchTemplates = async () => {
      if (!client) return;

      try {
        const data = await getMyTemplates(client.id);
        setTemplates(data);
      } catch (err) {
        console.error("Failed to fetch templates:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [client]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    if (activeMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [activeMenu]);

  // Fetch addresses and inventory when modal opens
  useEffect(() => {
    const fetchModalData = async () => {
      if (!client || !showModal) return;

      try {
        const [addressData, inventoryData] = await Promise.all([
          getMyAddresses(client.id),
          getClientInventory(client.id),
        ]);
        setAddresses(addressData);
        setInventory(inventoryData);
      } catch (err) {
        console.error("Failed to fetch modal data:", err);
      }
    };

    fetchModalData();
  }, [client, showModal]);

  // Reset form when modal closes
  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormAddressId("");
    setFormItems([]);
    setProductSearch("");
    setSelectedProductId("");
    setAddQuantity(1);
    setEditingTemplate(null);
  };

  // Open modal for creating new template
  const handleOpenCreate = () => {
    resetForm();
    setShowModal(true);
  };

  // Open modal for editing template
  const handleOpenEdit = async (templateId: string) => {
    if (!client) return;

    try {
      const template = await getMyTemplate(client.id, templateId);
      if (!template) {
        alert("Template not found");
        return;
      }

      setEditingTemplate(template);
      setFormName(template.name);
      setFormDescription(template.description || "");
      setFormAddressId(template.address_id || "");
      setFormItems(
        template.items.map((item) => ({
          productId: item.product_id,
          productName: item.product_name,
          sku: item.product_sku,
          quantity: item.quantity,
        }))
      );
      setShowModal(true);
      setActiveMenu(null);
    } catch (err) {
      console.error("Failed to load template:", err);
      alert("Failed to load template");
    }
  };

  // Close modal
  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  // Add product to form
  const handleAddProduct = () => {
    if (!selectedProductId || addQuantity < 1) return;

    const product = inventory.find((p) => p.productId === selectedProductId);
    if (!product) return;

    // Check if product already in list
    const existingIndex = formItems.findIndex((item) => item.productId === selectedProductId);
    if (existingIndex >= 0) {
      // Update quantity
      setFormItems((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex
            ? { ...item, quantity: item.quantity + addQuantity }
            : item
        )
      );
    } else {
      // Add new item
      setFormItems((prev) => [
        ...prev,
        {
          productId: product.productId,
          productName: product.productName,
          sku: product.sku,
          quantity: addQuantity,
        },
      ]);
    }

    // Reset selection
    setSelectedProductId("");
    setAddQuantity(1);
    setProductSearch("");
  };

  // Update item quantity
  const handleUpdateQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return;
    setFormItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, quantity } : item))
    );
  };

  // Remove item from form
  const handleRemoveItem = (index: number) => {
    setFormItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Save template
  const handleSave = async () => {
    if (!client) return;
    if (!formName.trim()) {
      alert("Please enter a template name");
      return;
    }
    if (formItems.length === 0) {
      alert("Please add at least one product");
      return;
    }

    setSaving(true);
    try {
      const items: CreateTemplateItem[] = formItems.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
      }));

      if (editingTemplate) {
        // Update existing template
        await updateMyTemplate(client.id, editingTemplate.id, {
          name: formName.trim(),
          description: formDescription.trim() || null,
          address_id: formAddressId || null,
        });
        // Note: updateMyTemplate doesn't update items - would need separate API
      } else {
        // Create new template
        await createMyTemplate(
          client.id,
          {
            name: formName.trim(),
            description: formDescription.trim() || null,
            address_id: formAddressId || null,
          },
          items
        );
      }

      // Refresh templates list
      const updatedTemplates = await getMyTemplates(client.id);
      setTemplates(updatedTemplates);

      handleCloseModal();
    } catch (err: any) {
      console.error("Failed to save template:", err);
      alert(err.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  // Filter products for dropdown
  const filteredProducts = inventory.filter(
    (p) =>
      p.productName.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleDelete = async (templateId: string) => {
    if (!client) return;
    if (!confirm("Are you sure you want to delete this template?")) return;

    setDeleting(templateId);
    try {
      await deleteMyTemplate(client.id, templateId);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    } catch (err) {
      console.error("Failed to delete template:", err);
      alert("Failed to delete template");
    } finally {
      setDeleting(null);
      setActiveMenu(null);
    }
  };

  const handleUseTemplate = (templateId: string) => {
    // Redirect to request-shipment with template ID to pre-fill form
    window.location.href = `/portal/request-shipment?templateId=${templateId}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order Templates</h1>
          <p className="text-gray-500 mt-1">
            Save frequently used orders as templates for quick reordering
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Create Template
        </button>
      </div>

      {/* Search */}
      {templates.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>
      )}

      {/* Templates List */}
      {filteredTemplates.length > 0 ? (
        <div className="grid gap-4">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {template.name}
                      </h3>
                      {template.description && (
                        <p className="text-sm text-gray-500 truncate">
                          {template.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Package className="w-4 h-4" />
                      {template.item_count} item{template.item_count !== 1 ? "s" : ""}
                    </span>

                    {template.address && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-4 h-4" />
                        {template.address.label || `${template.address.city}, ${template.address.state}`}
                      </span>
                    )}

                    <span className="text-gray-400">
                      Created {formatDate(template.created_at)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {/* Use Template Button */}
                  <button
                    onClick={() => handleUseTemplate(template.id)}
                    disabled={template.item_count === 0}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Use Template
                  </button>

                  {/* Menu Button */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenu(activeMenu === template.id ? null : template.id);
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>

                    {activeMenu === template.id && (
                      <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                        <Link
                          href={`/portal/templates/${template.id}`}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <ChevronRight className="w-4 h-4" />
                          View Details
                        </Link>
                        <button
                          onClick={() => handleOpenEdit(template.id)}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit Template
                        </button>
                        <button
                          onClick={() => handleDelete(template.id)}
                          disabled={deleting === template.id}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          {deleting === template.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : templates.length > 0 ? (
        <Card>
          <div className="text-center py-12 text-gray-500">
            <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No templates match "{searchQuery}"</p>
            <p className="text-sm mt-1">Try a different search term</p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No templates yet</p>
            <p className="text-sm mt-1 mb-4">
              Create templates to quickly reorder your frequently shipped items
            </p>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Create Your First Template
            </button>
          </div>
        </Card>
      )}

      {/* Help Note */}
      {templates.length > 0 && (
        <Card className="bg-blue-50 border-blue-100">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Using Templates</h3>
              <p className="text-sm text-gray-600 mt-1">
                Click "Order Now" to instantly create a new order with the template's
                items and shipping address. You can review and modify the order before
                it's submitted to 7 Degrees for fulfillment.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Create/Edit Template Modal */}
      {showModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={handleCloseModal}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingTemplate ? "Edit Template" : "Create Template"}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Name Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Weekly Restock, Monthly Supplies"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Description Textarea */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Optional description for this template"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                </div>

                {/* Default Address Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Shipping Address
                  </label>
                  <select
                    value={formAddressId}
                    onChange={(e) => setFormAddressId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="">No default address</option>
                    {addresses.map((addr) => (
                      <option key={addr.id} value={addr.id}>
                        {addr.label || `${addr.address_line1}, ${addr.city}, ${addr.state}`}
                        {addr.is_default && " (Default)"}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Products Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Products <span className="text-red-500">*</span>
                  </label>

                  {/* Add Product Row */}
                  <div className="flex gap-2 mb-4">
                    <div className="flex-1 relative">
                      <select
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                      >
                        <option value="">Select a product...</option>
                        {filteredProducts.map((product) => (
                          <option key={product.productId} value={product.productId}>
                            {product.productName} ({product.sku}) - {product.qtyOnHand} available
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="number"
                      min="1"
                      value={addQuantity}
                      onChange={(e) => setAddQuantity(parseInt(e.target.value) || 1)}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
                    />
                    <button
                      onClick={handleAddProduct}
                      disabled={!selectedProductId}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Products List */}
                  {formItems.length > 0 ? (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">
                              Product
                            </th>
                            <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 uppercase w-24">
                              Qty
                            </th>
                            <th className="py-2 px-3 w-12"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {formItems.map((item, index) => (
                            <tr key={item.productId} className="border-t border-gray-100">
                              <td className="py-2 px-3">
                                <div>
                                  <span className="font-medium text-gray-900 text-sm">
                                    {item.productName}
                                  </span>
                                  <span className="text-gray-500 text-xs block">
                                    {item.sku}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    handleUpdateQuantity(index, parseInt(e.target.value) || 1)
                                  }
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <button
                                  onClick={() => handleRemoveItem(index)}
                                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Remove"
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
                      <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm text-gray-500">No products added yet</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Select a product above and click + to add
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={handleCloseModal}
                  disabled={saving}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formName.trim() || formItems.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving..." : editingTemplate ? "Save Changes" : "Create Template"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
