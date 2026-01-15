"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, PackagePlus, History } from "lucide-react";
import { ProductImageCard } from "@/components/ui/ProductImage";
import AppShell from "@/components/internal/AppShell";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";
import Alert from "@/components/ui/Alert";
import ProductForm from "@/components/internal/ProductForm";
import StockAdjustmentModal from "@/components/internal/StockAdjustmentModal";
import { getProduct, updateProduct, deleteProduct, Product } from "@/lib/api/products";
import { getProductInventory, InventoryWithLocation } from "@/lib/api/inventory";
import Table from "@/components/ui/Table";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
};

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [inventory, setInventory] = useState<InventoryWithLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const fetchData = async () => {
    try {
      const [productData, inventoryData] = await Promise.all([
        getProduct(id),
        getProductInventory(id),
      ]);
      setProduct(productData);
      setInventory(inventoryData);
    } catch (error) {
      console.error("Failed to fetch product:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const handleUpdateProduct = async (productData: Partial<Product>) => {
    try {
      await updateProduct(id, productData);
      await fetchData();
      setShowEditModal(false);
      setSuccessMessage("Product updated successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Failed to update product:", error);
    }
  };

  const handleDeleteProduct = async () => {
    try {
      await deleteProduct(id);
      router.push("/products");
    } catch (error) {
      console.error("Failed to delete product:", error);
    }
  };

  if (loading) {
    return (
      <AppShell title="Product Details">
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (!product) {
    return (
      <AppShell title="Product Details">
        <Card>
          <div className="text-center py-12 text-gray-500">
            Product not found
          </div>
        </Card>
      </AppShell>
    );
  }

  const actionButtons = (
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" onClick={() => setShowEditModal(true)}>
        <Pencil className="w-4 h-4 mr-1" />
        Edit Product
      </Button>
      <Button variant="secondary" size="sm" onClick={() => setShowStockModal(true)}>
        <PackagePlus className="w-4 h-4 mr-1" />
        Adjust Stock
      </Button>
      <Button variant="ghost" size="sm" onClick={() => {}}>
        <History className="w-4 h-4 mr-1" />
        View History
      </Button>
    </div>
  );

  return (
    <AppShell title="Product Details" actions={actionButtons}>
      <div className="mb-4">
        <Link
          href="/products"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Products
        </Link>
      </div>

      {successMessage && (
        <div className="mb-4">
          <Alert
            type="success"
            message={successMessage}
            onClose={() => setSuccessMessage("")}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card padding="none">
          <ProductImageCard
            src={product.image_url}
            alt={product.name}
            aspectRatio="square"
            priority
          />
        </Card>

        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {product.name}
                </h2>
                <p className="text-sm text-gray-500 mt-1">SKU: {product.sku}</p>
              </div>
              <Badge variant={product.active ? "success" : "default"} size="md">
                {product.active ? "Active" : "Inactive"}
              </Badge>
            </div>

            <div className="flex gap-2 mb-4">
              {product.category && (
                <Badge variant="info">{product.category}</Badge>
              )}
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Description
              </h3>
              <p className="text-gray-700">
                {product.description || "No description available"}
              </p>
            </div>
          </Card>
        </div>

        <Card title="Pricing">
          {(() => {
            const margin = product.base_price - product.unit_cost;
            const marginPercent = product.unit_cost > 0
              ? ((margin / product.unit_cost) * 100).toFixed(1)
              : "0.0";
            return (
              <dl className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Unit Cost</dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {formatCurrency(product.unit_cost)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Base Price</dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {formatCurrency(product.base_price)}
                    </dd>
                  </div>
                </div>
                <div className="border-t border-gray-200 pt-4 grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Margin</dt>
                    <dd className={`text-lg font-semibold ${margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(margin)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Margin %</dt>
                    <dd className={`text-lg font-semibold ${margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {marginPercent}%
                    </dd>
                  </div>
                </div>
                <div className="border-t border-gray-200 pt-4">
                  <dt className="text-sm font-medium text-gray-500">Reorder Point</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {product.reorder_point} units
                  </dd>
                </div>
              </dl>
            );
          })()}
        </Card>

        <Card title="Identification">
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Barcode</dt>
              <dd className="text-sm text-gray-900 font-mono">
                {product.barcode || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="text-sm text-gray-900">
                {new Date(product.created_at).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </Card>

        <div className="lg:col-span-3">
          <Card title="Inventory by Location" padding="none">
            <Table
              columns={[
                {
                  key: "location",
                  header: "Location",
                  render: (item: InventoryWithLocation) => (
                    <div>
                      <div className="font-medium text-gray-900">
                        {item.location.name}
                      </div>
                      {(item.location.city || item.location.state) && (
                        <div className="text-sm text-gray-500">
                          {[item.location.city, item.location.state]
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  key: "qty_on_hand",
                  header: "On Hand",
                  render: (item: InventoryWithLocation) => (
                    <span className="font-medium">{item.qty_on_hand}</span>
                  ),
                },
                {
                  key: "qty_reserved",
                  header: "Reserved",
                  render: (item: InventoryWithLocation) => (
                    <span className="text-yellow-600">{item.qty_reserved}</span>
                  ),
                },
                {
                  key: "available",
                  header: "Available",
                  render: (item: InventoryWithLocation) => {
                    const available = item.qty_on_hand - item.qty_reserved;
                    return (
                      <span
                        className={`font-semibold ${
                          available <= 0
                            ? "text-red-600"
                            : available <= product.reorder_point
                            ? "text-yellow-600"
                            : "text-green-600"
                        }`}
                      >
                        {available}
                      </span>
                    );
                  },
                },
              ]}
              data={inventory}
              emptyMessage="No inventory records for this product"
            />
          </Card>
        </div>
      </div>

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Product"
        size="lg"
      >
        <ProductForm
          product={product}
          onSave={handleUpdateProduct}
          onCancel={() => setShowEditModal(false)}
          onDelete={handleDeleteProduct}
        />
      </Modal>

      <StockAdjustmentModal
        isOpen={showStockModal}
        onClose={() => setShowStockModal(false)}
        onComplete={() => {
          setShowStockModal(false);
          fetchData();
        }}
        preselectedProduct={product.id}
      />
    </AppShell>
  );
}
