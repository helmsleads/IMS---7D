"use client";

import { useEffect, useMemo, useState } from "react";
import { Package } from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import Alert from "@/components/ui/Alert";
import FetchError from "@/components/ui/FetchError";
import ProductForm from "@/components/internal/ProductForm";
import { getProducts, createProduct, updateProduct, deleteProduct, Product } from "@/lib/api/products";
import { handleApiError } from "@/lib/utils/error-handler";
import Pagination from "@/components/ui/Pagination";

const ITEMS_PER_PAGE = 25;

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
};

const columns = [
  { key: "sku", header: "SKU" },
  { key: "name", header: "Name" },
  { key: "category", header: "Category" },
  {
    key: "unit_cost",
    header: "Cost",
    render: (product: Product) => formatCurrency(product.unit_cost),
  },
  {
    key: "base_price",
    header: "Price",
    render: (product: Product) => formatCurrency(product.base_price),
  },
  {
    key: "active",
    header: "Status",
    render: (product: Product) => (
      <Badge variant={product.active ? "success" : "default"}>
        {product.active ? "Active" : "Inactive"}
      </Badge>
    ),
  },
];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSaveProduct = async (productData: Partial<Product>) => {
    try {
      await createProduct(productData);
      await fetchProducts();
      setShowAddModal(false);
      setSuccessMessage("Product created successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Failed to create product:", error);
    }
  };

  const handleUpdateProduct = async (productData: Partial<Product>) => {
    if (!editingProduct) return;
    try {
      await updateProduct(editingProduct.id, productData);
      await fetchProducts();
      setEditingProduct(null);
      setSuccessMessage("Product updated successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Failed to update product:", error);
    }
  };

  const handleDeleteProduct = async () => {
    if (!editingProduct) return;
    try {
      await deleteProduct(editingProduct.id);
      await fetchProducts();
      setEditingProduct(null);
      setSuccessMessage("Product deleted successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Failed to delete product:", error);
    }
  };

  const categoryOptions = useMemo(() => {
    const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];
    return categories.map((cat) => ({ value: cat!, label: cat! }));
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        product.sku.toLowerCase().includes(search) ||
        product.name.toLowerCase().includes(search);
      const matchesCategory =
        !selectedCategory || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory]);

  // Paginate the filtered results
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  if (!loading && products.length === 0) {
    return (
      <AppShell
        title="Products"
        actions={<Button onClick={() => setShowAddModal(true)}>Add Product</Button>}
      >
        <Card>
          <EmptyState
            icon={<Package className="w-12 h-12" />}
            title="No products yet"
            description="Add your first product to get started"
            action={<Button onClick={() => setShowAddModal(true)}>Add Product</Button>}
          />
        </Card>
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add Product"
          size="lg"
        >
          <ProductForm
            onSave={handleSaveProduct}
            onCancel={() => setShowAddModal(false)}
          />
        </Modal>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Products">
        <FetchError message={error} onRetry={fetchProducts} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Products"
      actions={<Button onClick={() => setShowAddModal(true)}>Add Product</Button>}
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
      <div className="mb-4 flex gap-4">
        <input
          type="text"
          placeholder="Search by SKU or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="w-48">
          <Select
            name="category"
            options={categoryOptions}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            placeholder="All Categories"
          />
        </div>
      </div>
      <Card padding="none">
        <Table
          columns={columns}
          data={paginatedProducts}
          loading={loading}
          emptyMessage="No products found"
          onRowClick={(product) => setEditingProduct(product)}
        />
        <Pagination
          currentPage={currentPage}
          totalItems={filteredProducts.length}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
        />
      </Card>
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Product"
        size="lg"
      >
        <ProductForm
          onSave={handleSaveProduct}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>
      <Modal
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        title="Edit Product"
        size="lg"
      >
        {editingProduct && (
          <ProductForm
            product={editingProduct}
            onSave={handleUpdateProduct}
            onCancel={() => setEditingProduct(null)}
            onDelete={handleDeleteProduct}
          />
        )}
      </Modal>
    </AppShell>
  );
}
