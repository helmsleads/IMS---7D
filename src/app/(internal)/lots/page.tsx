"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Layers,
  Plus,
  Search,
  Eye,
  Pencil,
  AlertTriangle,
  X,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import FetchError from "@/components/ui/FetchError";
import StatusBadge from "@/components/ui/StatusBadge";
import { getLots, getExpiringLots, createLot, LotWithInventory } from "@/lib/api/lots";
import { createClient } from "@/lib/supabase";
import { handleApiError } from "@/lib/utils/error-handler";
import { formatDate } from "@/lib/utils/formatting";

interface LotTrackingProduct {
  id: string;
  name: string;
  sku: string;
}

type TabType = "active" | "expiring" | "all";

const getDaysUntilExpiration = (expirationDate: string | null) => {
  if (!expirationDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = new Date(expirationDate);
  expDate.setHours(0, 0, 0, 0);
  const diffTime = expDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export default function LotsPage() {
  const [activeLots, setActiveLots] = useState<LotWithInventory[]>([]);
  const [expiringLots, setExpiringLots] = useState<LotWithInventory[]>([]);
  const [allLots, setAllLots] = useState<LotWithInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("active");
  const [searchTerm, setSearchTerm] = useState("");

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [products, setProducts] = useState<LotTrackingProduct[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    product_id: "",
    lot_number: "",
    batch_number: "",
    manufacture_date: "",
    expiration_date: "",
    received_date: "",
    supplier: "",
    notes: "",
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [active, expiring, all] = await Promise.all([
        getLots({ status: "active" }),
        getExpiringLots(30),
        getLots(),
      ]);
      setActiveLots(active);
      setExpiringLots(expiring);
      setAllLots(all);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchLotTrackingProducts = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("products")
      .select("id, name, sku")
      .eq("lot_tracking_enabled", true)
      .eq("active", true)
      .order("name");

    if (error) {
      console.error("Failed to fetch products:", error);
      return;
    }

    setProducts(data || []);
  };

  const handleOpenModal = async () => {
    setShowAddModal(true);
    await fetchLotTrackingProducts();
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setFormData({
      product_id: "",
      lot_number: "",
      batch_number: "",
      manufacture_date: "",
      expiration_date: "",
      received_date: "",
      supplier: "",
      notes: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.product_id || !formData.lot_number) return;

    setSubmitting(true);
    try {
      await createLot({
        product_id: formData.product_id,
        lot_number: formData.lot_number,
        batch_number: formData.batch_number || null,
        manufacture_date: formData.manufacture_date || null,
        expiration_date: formData.expiration_date || null,
        received_date: formData.received_date || null,
        supplier: formData.supplier || null,
        notes: formData.notes || null,
        status: "active",
      });
      handleCloseModal();
      await fetchData();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const displayedLots = useMemo(() => {
    let filtered: LotWithInventory[];

    switch (activeTab) {
      case "active":
        filtered = activeLots;
        break;
      case "expiring":
        // Sort by expiration date ascending (soonest first)
        filtered = [...expiringLots].sort((a, b) => {
          if (!a.expiration_date) return 1;
          if (!b.expiration_date) return -1;
          return new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime();
        });
        break;
      case "all":
      default:
        filtered = allLots;
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (lot) =>
          lot.lot_number.toLowerCase().includes(search) ||
          lot.batch_number?.toLowerCase().includes(search) ||
          lot.product?.name.toLowerCase().includes(search) ||
          lot.product?.sku.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [activeLots, expiringLots, allLots, activeTab, searchTerm]);

  const getTotalQty = (lot: LotWithInventory) => {
    return lot.lot_inventory.reduce((sum, inv) => sum + inv.qty_on_hand, 0);
  };

  const tabCounts = useMemo(() => {
    return {
      active: activeLots.length,
      expiring: expiringLots.length,
      all: allLots.length,
    };
  }, [activeLots, expiringLots, allLots]);

  if (error && allLots.length === 0) {
    return (
      <AppShell title="Lot Tracking" subtitle="Manage lots and expiration dates">
        <FetchError message={error} onRetry={fetchData} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Lot Tracking"
      subtitle="Manage lots and expiration dates"
      actions={
        <Button onClick={handleOpenModal}>
          <Plus className="w-4 h-4 mr-2" />
          Add Lot
        </Button>
      }
    >
      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("active")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "active"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Active Lots
              <span
                className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                  activeTab === "active"
                    ? "bg-blue-100 text-blue-600"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {tabCounts.active}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("expiring")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "expiring"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Expiring Soon
              {tabCounts.expiring > 0 && (
                <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-orange-100 text-orange-600">
                  {tabCounts.expiring}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "all"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              All Lots
              <span
                className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                  activeTab === "all"
                    ? "bg-blue-100 text-blue-600"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {tabCounts.all}
              </span>
            </button>
          </nav>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search lot number, batch, product..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Lots List */}
      {loading ? (
        <Card>
          <div className="animate-pulse">
            <div className="h-10 bg-gray-200 rounded mb-4"></div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded mb-2"></div>
            ))}
          </div>
        </Card>
      ) : displayedLots.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Layers className="w-12 h-12" />}
            title={allLots.length === 0 ? "No lots yet" : "No lots found"}
            description={
              allLots.length === 0
                ? "Start tracking lots by adding your first one"
                : "Try adjusting your search or filters"
            }
            action={
              allLots.length === 0 ? (
                <Button onClick={handleOpenModal}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Lot
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Lot Number
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Product
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Batch Number
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Expiration Date
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Days Until Expiry
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Total Qty
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedLots.map((lot) => {
                  const daysUntil = getDaysUntilExpiration(lot.expiration_date);
                  const isExpired = daysUntil !== null && daysUntil < 0;
                  const isCritical = daysUntil !== null && daysUntil >= 0 && daysUntil <= 7;
                  const isExpiringSoon = daysUntil !== null && daysUntil > 7 && daysUntil <= 30;

                  return (
                    <tr
                      key={lot.id}
                      className={`border-b border-gray-100 ${
                        isExpired
                          ? "bg-red-50 hover:bg-red-100"
                          : isCritical
                          ? "bg-red-100 hover:bg-red-200"
                          : isExpiringSoon
                          ? "bg-orange-50 hover:bg-orange-100"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <td className="py-3 px-4">
                        <Link
                          href={`/lots/${lot.id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {lot.lot_number}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-gray-900">{lot.product?.name || "-"}</p>
                          <p className="text-sm text-gray-500">{lot.product?.sku}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {lot.batch_number || "-"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={
                            isExpired || isCritical
                              ? "text-red-600 font-medium"
                              : isExpiringSoon
                              ? "text-orange-600 font-medium"
                              : "text-gray-600"
                          }
                        >
                          {formatDate(lot.expiration_date)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {daysUntil !== null ? (
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                isExpired || isCritical
                                  ? "text-red-600 font-medium"
                                  : isExpiringSoon
                                  ? "text-orange-600 font-medium"
                                  : "text-gray-600"
                              }
                            >
                              {daysUntil < 0
                                ? `${Math.abs(daysUntil)} days ago`
                                : daysUntil === 0
                                ? "Today"
                                : daysUntil === 1
                                ? "1 day"
                                : `${daysUntil} days`}
                            </span>
                            {isCritical && (
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-900 font-medium">
                        {getTotalQty(lot).toLocaleString()}
                      </td>
                      <td className="py-3 px-4"><StatusBadge status={lot.status} entityType="lot" /></td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/lots/${lot.id}`}
                            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Link>
                          <Link
                            href={`/lots/${lot.id}/edit`}
                            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-800"
                          >
                            <Pencil className="w-4 h-4 mr-1" />
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add Lot Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Add New Lot</h2>
              <button
                onClick={handleCloseModal}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Product Dropdown (Required) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.product_id}
                  onChange={(e) =>
                    setFormData({ ...formData, product_id: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a product...</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </option>
                  ))}
                </select>
                {products.length === 0 && (
                  <p className="mt-1 text-sm text-gray-500">
                    No lot-tracking-enabled products found. Enable lot tracking on products first.
                  </p>
                )}
              </div>

              {/* Lot Number (Required) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lot Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.lot_number}
                  onChange={(e) =>
                    setFormData({ ...formData, lot_number: e.target.value })
                  }
                  required
                  placeholder="e.g., LOT-2026-001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Batch Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Batch Number
                </label>
                <input
                  type="text"
                  value={formData.batch_number}
                  onChange={(e) =>
                    setFormData({ ...formData, batch_number: e.target.value })
                  }
                  placeholder="e.g., BATCH-001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Date Fields Row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Manufacture Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Manufacture Date
                  </label>
                  <input
                    type="date"
                    value={formData.manufacture_date}
                    onChange={(e) =>
                      setFormData({ ...formData, manufacture_date: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Expiration Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiration Date
                  </label>
                  <input
                    type="date"
                    value={formData.expiration_date}
                    onChange={(e) =>
                      setFormData({ ...formData, expiration_date: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Received Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Received Date
                </label>
                <input
                  type="date"
                  value={formData.received_date}
                  onChange={(e) =>
                    setFormData({ ...formData, received_date: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Supplier */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier
                </label>
                <input
                  type="text"
                  value={formData.supplier}
                  onChange={(e) =>
                    setFormData({ ...formData, supplier: e.target.value })
                  }
                  placeholder="Supplier name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  rows={3}
                  placeholder="Additional notes about this lot..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCloseModal}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !formData.product_id || !formData.lot_number}
                >
                  {submitting ? "Creating..." : "Create Lot"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
