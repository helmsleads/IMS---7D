"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Edit,
  Trash2,
  ChevronDown,
  ChevronRight,
  FolderTree,
  Tag,
  Save,
  X,
  GripVertical,
} from "lucide-react";
import Link from "next/link";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import Alert from "@/components/ui/Alert";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import FetchError from "@/components/ui/FetchError";
import {
  getCategoriesWithSubcategories,
  createCategory,
  updateCategory,
  deleteCategory,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
  CategoryWithSubcategories,
} from "@/lib/api/product-categories";
import { ProductSubcategory } from "@/types/database";
import { handleApiError } from "@/lib/utils/error-handler";

const COLOR_OPTIONS = [
  { value: "gray", label: "Gray", class: "bg-gray-100 text-gray-800" },
  { value: "red", label: "Red", class: "bg-red-100 text-red-800" },
  { value: "orange", label: "Orange", class: "bg-orange-100 text-orange-800" },
  { value: "amber", label: "Amber", class: "bg-amber-100 text-amber-800" },
  { value: "yellow", label: "Yellow", class: "bg-yellow-100 text-yellow-800" },
  { value: "green", label: "Green", class: "bg-green-100 text-green-800" },
  { value: "teal", label: "Teal", class: "bg-teal-100 text-teal-800" },
  { value: "blue", label: "Blue", class: "bg-blue-100 text-blue-800" },
  { value: "indigo", label: "Indigo", class: "bg-indigo-100 text-indigo-800" },
  { value: "purple", label: "Purple", class: "bg-purple-100 text-purple-800" },
  { value: "pink", label: "Pink", class: "bg-pink-100 text-pink-800" },
  { value: "brown", label: "Brown", class: "bg-amber-200 text-amber-900" },
];

function getColorClass(color: string | null): string {
  const colorOption = COLOR_OPTIONS.find((c) => c.value === color);
  return colorOption?.class || "bg-gray-100 text-gray-800";
}

export default function ProductCategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryWithSubcategories[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<CategoryWithSubcategories | null>(null);
  const [editingSubcategory, setEditingSubcategory] =
    useState<ProductSubcategory | null>(null);
  const [parentCategoryId, setParentCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Category form
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    icon: "",
    color: "gray",
  });

  // Subcategory form
  const [subcategoryForm, setSubcategoryForm] = useState({
    name: "",
    description: "",
  });
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCategoriesWithSubcategories(true);
      setCategories(data);
      // Expand all categories by default
      setExpandedCategories(new Set(data.map((c) => c.id)));
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Category handlers
  const handleOpenCategoryModal = (category?: CategoryWithSubcategories) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        description: category.description || "",
        icon: category.icon || "",
        color: category.color || "gray",
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({
        name: "",
        description: "",
        icon: "",
        color: "gray",
      });
    }
    setShowCategoryModal(true);
  };

  const handleCloseCategoryModal = () => {
    setShowCategoryModal(false);
    setEditingCategory(null);
    setModalError(null);
    setCategoryForm({
      name: "",
      description: "",
      icon: "",
      color: "gray",
    });
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) return;

    setSaving(true);
    setModalError(null);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: categoryForm.name.trim(),
          description: categoryForm.description.trim() || null,
          icon: categoryForm.icon.trim() || null,
          color: categoryForm.color || null,
        });
        setSuccessMessage("Category updated successfully");
      } else {
        await createCategory({
          name: categoryForm.name.trim(),
          description: categoryForm.description.trim() || null,
          icon: categoryForm.icon.trim() || null,
          color: categoryForm.color || null,
        });
        setSuccessMessage("Category created successfully");
      }
      handleCloseCategoryModal();
      await fetchCategories();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setModalError(handleApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (category: CategoryWithSubcategories) => {
    if (
      !confirm(
        `Are you sure you want to delete "${category.name}"? This will also delete all subcategories.`
      )
    ) {
      return;
    }

    try {
      await deleteCategory(category.id);
      setSuccessMessage("Category deleted successfully");
      await fetchCategories();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const handleToggleCategoryActive = async (
    category: CategoryWithSubcategories
  ) => {
    try {
      await updateCategory(category.id, { is_active: !category.is_active });
      await fetchCategories();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  // Subcategory handlers
  const handleOpenSubcategoryModal = (
    categoryId: string,
    subcategory?: ProductSubcategory
  ) => {
    setParentCategoryId(categoryId);
    if (subcategory) {
      setEditingSubcategory(subcategory);
      setSubcategoryForm({
        name: subcategory.name,
        description: subcategory.description || "",
      });
    } else {
      setEditingSubcategory(null);
      setSubcategoryForm({
        name: "",
        description: "",
      });
    }
    setShowSubcategoryModal(true);
  };

  const handleCloseSubcategoryModal = () => {
    setShowSubcategoryModal(false);
    setEditingSubcategory(null);
    setParentCategoryId(null);
    setModalError(null);
    setSubcategoryForm({
      name: "",
      description: "",
    });
  };

  const handleSaveSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subcategoryForm.name.trim() || !parentCategoryId) return;

    setSaving(true);
    setModalError(null);
    try {
      if (editingSubcategory) {
        await updateSubcategory(editingSubcategory.id, {
          name: subcategoryForm.name.trim(),
          description: subcategoryForm.description.trim() || null,
        });
        setSuccessMessage("Subcategory updated successfully");
      } else {
        await createSubcategory({
          category_id: parentCategoryId,
          name: subcategoryForm.name.trim(),
          description: subcategoryForm.description.trim() || null,
        });
        setSuccessMessage("Subcategory created successfully");
      }
      handleCloseSubcategoryModal();
      await fetchCategories();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setModalError(handleApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubcategory = async (subcategory: ProductSubcategory) => {
    if (
      !confirm(`Are you sure you want to delete "${subcategory.name}"?`)
    ) {
      return;
    }

    try {
      await deleteSubcategory(subcategory.id);
      setSuccessMessage("Subcategory deleted successfully");
      await fetchCategories();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const handleToggleSubcategoryActive = async (
    subcategory: ProductSubcategory
  ) => {
    try {
      await updateSubcategory(subcategory.id, {
        is_active: !subcategory.is_active,
      });
      await fetchCategories();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  // Stats
  const stats = useMemo(() => {
    const totalCategories = categories.length;
    const activeCategories = categories.filter((c) => c.is_active).length;
    const totalSubcategories = categories.reduce(
      (sum, c) => sum + c.subcategories.length,
      0
    );
    return { totalCategories, activeCategories, totalSubcategories };
  }, [categories]);

  if (loading) {
    return (
      <AppShell title="Product Categories" subtitle="Loading...">
        <Card>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </Card>
      </AppShell>
    );
  }

  if (error && categories.length === 0) {
    return (
      <AppShell title="Product Categories" subtitle="Manage product categories">
        <FetchError message={error} onRetry={fetchCategories} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Product Categories"
      subtitle="Organize products by category and subcategory"
      actions={
        <Button onClick={() => handleOpenCategoryModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
      }
    >
      {successMessage && (
        <div className="mb-4">
          <Alert
            type="success"
            message={successMessage}
            onClose={() => setSuccessMessage("")}
          />
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Alert type="error" message={error} onClose={() => setError(null)} />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FolderTree className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.totalCategories}
              </p>
              <p className="text-sm text-gray-500">Categories</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Tag className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.totalSubcategories}
              </p>
              <p className="text-sm text-gray-500">Subcategories</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FolderTree className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.activeCategories}
              </p>
              <p className="text-sm text-gray-500">Active Categories</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Categories List */}
      {categories.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderTree className="w-12 h-12" />}
            title="No categories yet"
            description="Create your first product category to organize your inventory"
            action={
              <Button onClick={() => handleOpenCategoryModal()}>
                <Plus className="w-4 h-4 mr-2" />
                Add Category
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {categories.map((category) => (
            <Card key={category.id} padding="none">
              {/* Category Header */}
              <div
                className={`flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 ${
                  !category.is_active ? "opacity-60" : ""
                }`}
                onClick={() => toggleCategory(category.id)}
              >
                <div className="flex items-center gap-3">
                  <button className="p-1 hover:bg-gray-200 rounded">
                    {expandedCategories.has(category.id) ? (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-500" />
                    )}
                  </button>
                  {category.icon && (
                    <span className="text-2xl">{category.icon}</span>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {category.name}
                      </span>
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getColorClass(
                          category.color
                        )}`}
                      >
                        {category.subcategories.length} subcategories
                      </span>
                      {!category.is_active && (
                        <Badge variant="default">Inactive</Badge>
                      )}
                    </div>
                    {category.description && (
                      <p className="text-sm text-gray-500">
                        {category.description}
                      </p>
                    )}
                  </div>
                </div>
                <div
                  className="flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleOpenSubcategoryModal(category.id)
                    }
                    title="Add Subcategory"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenCategoryModal(category)}
                    title="Edit Category"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteCategory(category)}
                    title="Delete Category"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>

              {/* Subcategories */}
              {expandedCategories.has(category.id) &&
                category.subcategories.length > 0 && (
                  <div className="border-t border-gray-200 bg-gray-50">
                    {category.subcategories.map((subcategory) => (
                      <div
                        key={subcategory.id}
                        className={`flex items-center justify-between px-4 py-3 pl-14 border-b border-gray-100 last:border-b-0 hover:bg-gray-100 ${
                          !subcategory.is_active ? "opacity-60" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-900">
                            {subcategory.name}
                          </span>
                          {!subcategory.is_active && (
                            <Badge variant="default">Inactive</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleOpenSubcategoryModal(
                                category.id,
                                subcategory
                              )
                            }
                            title="Edit Subcategory"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleDeleteSubcategory(subcategory)
                            }
                            title="Delete Subcategory"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              {/* Empty subcategories message */}
              {expandedCategories.has(category.id) &&
                category.subcategories.length === 0 && (
                  <div className="border-t border-gray-200 bg-gray-50 px-4 py-6 text-center">
                    <p className="text-sm text-gray-500 mb-2">
                      No subcategories yet
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        handleOpenSubcategoryModal(category.id)
                      }
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Subcategory
                    </Button>
                  </div>
                )}
            </Card>
          ))}
        </div>
      )}

      {/* Category Modal */}
      <Modal
        isOpen={showCategoryModal}
        onClose={handleCloseCategoryModal}
        title={editingCategory ? "Edit Category" : "New Category"}
        size="md"
      >
        <form onSubmit={handleSaveCategory} className="space-y-4">
          {modalError && (
            <Alert
              type="error"
              message={modalError}
              onClose={() => setModalError(null)}
            />
          )}
          <Input
            label="Category Name"
            name="name"
            value={categoryForm.name}
            onChange={(e) =>
              setCategoryForm({ ...categoryForm, name: e.target.value })
            }
            required
            placeholder="e.g., Beer, Wine, Spirits"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={categoryForm.description}
              onChange={(e) =>
                setCategoryForm({
                  ...categoryForm,
                  description: e.target.value,
                })
              }
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Brief description of this category..."
            />
          </div>

          <Input
            label="Icon (Emoji)"
            name="icon"
            value={categoryForm.icon}
            onChange={(e) =>
              setCategoryForm({ ...categoryForm, icon: e.target.value })
            }
            placeholder="e.g., 🍺, 🍷, 🥃"
            hint="Optional: Enter an emoji to represent this category"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() =>
                    setCategoryForm({ ...categoryForm, color: color.value })
                  }
                  className={`
                    px-3 py-1.5 rounded-full text-sm font-medium transition-all
                    ${color.class}
                    ${
                      categoryForm.color === color.value
                        ? "ring-2 ring-offset-2 ring-blue-500"
                        : "hover:ring-1 hover:ring-gray-300"
                    }
                  `}
                >
                  {color.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseCategoryModal}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {editingCategory ? "Update" : "Create"} Category
            </Button>
          </div>
        </form>
      </Modal>

      {/* Subcategory Modal */}
      <Modal
        isOpen={showSubcategoryModal}
        onClose={handleCloseSubcategoryModal}
        title={editingSubcategory ? "Edit Subcategory" : "New Subcategory"}
        size="sm"
      >
        <form onSubmit={handleSaveSubcategory} className="space-y-4">
          {modalError && (
            <Alert
              type="error"
              message={modalError}
              onClose={() => setModalError(null)}
            />
          )}
          <Input
            label="Subcategory Name"
            name="name"
            value={subcategoryForm.name}
            onChange={(e) =>
              setSubcategoryForm({ ...subcategoryForm, name: e.target.value })
            }
            required
            placeholder="e.g., IPA, Lager, Bourbon"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={subcategoryForm.description}
              onChange={(e) =>
                setSubcategoryForm({
                  ...subcategoryForm,
                  description: e.target.value,
                })
              }
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Optional description..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseSubcategoryModal}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {editingSubcategory ? "Update" : "Create"} Subcategory
            </Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
