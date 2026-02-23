"use client";

import { useEffect, useMemo, useState } from "react";
import { Package } from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import Alert from "@/components/ui/Alert";
import FetchError from "@/components/ui/FetchError";
import ProductForm from "@/components/internal/ProductForm";
import { getProducts, createProduct, updateProduct, deleteProduct, Product, ProductWithCategory } from "@/lib/api/products";
import { getCategories } from "@/lib/api/product-categories";
import { getClients, Client } from "@/lib/api/clients";
import { ProductCategory } from "@/types/database";
import { handleApiError } from "@/lib/utils/error-handler";
import { formatCurrency } from "@/lib/utils/formatting";
import Pagination from "@/components/ui/Pagination";

const ITEMS_PER_PAGE = 25;

const columns = [
  { key: "sku", header: "SKU" },
  { key: "name", header: "Name" },
  {
    key: "client",
    header: "Client",
    render: (product: ProductWithCategory) => (
      <span className={product.client ? "text-gray-900" : "text-gray-400"}>
        {product.client?.company_name || "—"}
      </span>
    ),
  },
  {
    key: "category",
    header: "Category",
    render: (product: ProductWithCategory) => {
      const categoryName = product.product_category?.name || product.category || "—";
      const subcategoryName = product.product_subcategory?.name;
      return (
        <div>
          <div className="font-medium">{categoryName}</div>
          {subcategoryName && (
            <div className="text-xs text-gray-500">{subcategoryName}</div>
          )}
        </div>
      );
    },
  },
  {
    key: "unit_cost",
    header: "Cost",
    render: (product: ProductWithCategory) => formatCurrency(product.unit_cost),
  },
  {
    key: "base_price",
    header: "Price",
    render: (product: ProductWithCategory) => formatCurrency(product.base_price),
  },
  {
    key: "active",
    header: "Status",
    render: (product: ProductWithCategory) => (
      <Badge variant={product.active ? "success" : "default"}>
        {product.active ? "Active" : "Inactive"}
      </Badge>
    ),
  },
];

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categoryList, setCategoryList] = useState<ProductCategory[]>([]);
  const [clientList, setClientList] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithCategory | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const [productsData, categoriesData, clientsData] = await Promise.all([
        getProducts(),
        getCategories(),
        getClients(),
      ]);
      setProducts(productsData);
      setCategoryList(categoriesData);
      setClientList(clientsData);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const [errorMessage, setErrorMessage] = useState("");

  const handleSaveProduct = async (productData: Partial<Product>) => {
    try {
      await createProduct(productData);
      await fetchProducts();
      setShowAddModal(false);
      setSuccessMessage("Product created successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create product";
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(""), 5000);
      throw error; // Re-throw so form knows save failed
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
      const message = error instanceof Error ? error.message : "Failed to update product";
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(""), 5000);
      throw error; // Re-throw so form knows save failed
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
    return categoryList.map((cat) => ({
      value: cat.id,
      label: `${cat.icon || ""} ${cat.name}`.trim(),
    }));
  }, [categoryList]);

  const clientOptions = useMemo(() => {
    return clientList.map((client) => ({
      value: client.id,
      label: client.company_name,
    }));
  }, [clientList]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        product.sku.toLowerCase().includes(search) ||
        product.name.toLowerCase().includes(search);
      const matchesCategory =
        !selectedCategory || product.category_id === selectedCategory;
      const matchesClient =
        !selectedClient || product.client_id === selectedClient;
      return matchesSearch && matchesCategory && matchesClient;
    });
  }, [products, searchTerm, selectedCategory, selectedClient]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedClient]);

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
      {errorMessage && (
        <div className="mb-4">
          <Alert
            type="error"
            message={errorMessage}
            onClose={() => setErrorMessage("")}
          />
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-4">
        <div className="w-full max-w-md">
          <Input
            type="text"
            placeholder="Search by SKU or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-48">
          <Select
            name="client"
            options={clientOptions}
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            placeholder="All Clients"
          />
        </div>
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
