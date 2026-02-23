"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Package,
  MapPin,
  Grid3X3,
  Clock,
  User,
  FileText,
  History,
  AlertTriangle,
  RefreshCw,
  MoveRight,
  Pencil,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  ArrowRightLeft,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Alert from "@/components/ui/Alert";
import FetchError from "@/components/ui/FetchError";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import {
  getInventoryById,
  getInventoryStatusHistory,
  updateInventoryStatus,
  deleteInventory,
  InventoryWithDetails,
  InventoryStatusHistory,
} from "@/lib/api/inventory";
import {
  getInventoryTransactions,
  TransactionWithDetails,
  TransactionType,
} from "@/lib/api/inventory-transactions";
import { handleApiError } from "@/lib/utils/error-handler";
import { InventoryStatus } from "@/types/database";

function getInventoryStatusDisplay(status: InventoryStatus): {
  label: string;
  variant: "success" | "warning" | "error" | "info" | "default";
  bgClass: string;
  textClass: string;
  description: string;
} {
  const statusMap: Record<InventoryStatus, {
    label: string;
    variant: "success" | "warning" | "error" | "info" | "default";
    bgClass: string;
    textClass: string;
    description: string;
  }> = {
    available: {
      label: "Available",
      variant: "success",
      bgClass: "bg-green-100",
      textClass: "text-green-700",
      description: "Ready for sale and shipment",
    },
    damaged: {
      label: "Damaged",
      variant: "error",
      bgClass: "bg-red-100",
      textClass: "text-red-700",
      description: "Items have physical damage and cannot be sold",
    },
    quarantine: {
      label: "Quarantine",
      variant: "warning",
      bgClass: "bg-yellow-100",
      textClass: "text-yellow-700",
      description: "Under review or inspection, not available for sale",
    },
    reserved: {
      label: "Reserved",
      variant: "info",
      bgClass: "bg-blue-100",
      textClass: "text-blue-700",
      description: "Allocated to pending orders",
    },
    returned: {
      label: "Returned",
      variant: "default",
      bgClass: "bg-purple-100",
      textClass: "text-purple-700",
      description: "Received from customer return, awaiting inspection",
    },
  };
  return statusMap[status] || statusMap.available;
}

function getActionLabel(action: string): string {
  const actionLabels: Record<string, string> = {
    status_change: "Status Changed",
    stock_adjustment: "Stock Adjusted",
    sublocation_move: "Moved to Sublocation",
    created: "Created",
    moved_to_damaged_goods: "Moved to Damaged Goods",
  };
  return actionLabels[action] || action;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

const inventoryStatusOptions = [
  { value: "available", label: "Available" },
  { value: "damaged", label: "Damaged" },
  { value: "quarantine", label: "Quarantine" },
  { value: "reserved", label: "Reserved" },
  { value: "returned", label: "Returned" },
];

const transactionTypeOptions = [
  { value: "", label: "All Types" },
  { value: "receive", label: "Receive" },
  { value: "putaway", label: "Put Away" },
  { value: "pick", label: "Pick" },
  { value: "pack", label: "Pack" },
  { value: "ship", label: "Ship" },
  { value: "adjust", label: "Adjust" },
  { value: "transfer", label: "Transfer" },
  { value: "return_restock", label: "Return Restock" },
  { value: "damage_writeoff", label: "Damage Write-off" },
  { value: "cycle_count", label: "Cycle Count" },
  { value: "reserve", label: "Reserve" },
  { value: "release", label: "Release" },
  { value: "expire", label: "Expire" },
  { value: "quarantine", label: "Quarantine" },
];

function getTransactionTypeDisplay(type: TransactionType): {
  label: string;
  color: string;
  bgColor: string;
  icon: "up" | "down" | "neutral";
} {
  const map: Record<string, { label: string; color: string; bgColor: string; icon: "up" | "down" | "neutral" }> = {
    receive: { label: "Receive", color: "text-green-700", bgColor: "bg-green-100", icon: "up" },
    putaway: { label: "Put Away", color: "text-blue-700", bgColor: "bg-blue-100", icon: "neutral" },
    pick: { label: "Pick", color: "text-orange-700", bgColor: "bg-orange-100", icon: "down" },
    pack: { label: "Pack", color: "text-purple-700", bgColor: "bg-purple-100", icon: "neutral" },
    ship: { label: "Ship", color: "text-red-700", bgColor: "bg-red-100", icon: "down" },
    adjust: { label: "Adjust", color: "text-gray-700", bgColor: "bg-gray-100", icon: "neutral" },
    transfer: { label: "Transfer", color: "text-indigo-700", bgColor: "bg-indigo-100", icon: "neutral" },
    return_restock: { label: "Return", color: "text-teal-700", bgColor: "bg-teal-100", icon: "up" },
    damage_writeoff: { label: "Damage", color: "text-red-700", bgColor: "bg-red-100", icon: "down" },
    cycle_count: { label: "Cycle Count", color: "text-yellow-700", bgColor: "bg-yellow-100", icon: "neutral" },
    reserve: { label: "Reserve", color: "text-blue-700", bgColor: "bg-blue-100", icon: "neutral" },
    release: { label: "Release", color: "text-green-700", bgColor: "bg-green-100", icon: "neutral" },
    expire: { label: "Expire", color: "text-red-700", bgColor: "bg-red-100", icon: "down" },
    quarantine: { label: "Quarantine", color: "text-yellow-700", bgColor: "bg-yellow-100", icon: "neutral" },
  };
  return map[type] || { label: type, color: "text-gray-700", bgColor: "bg-gray-100", icon: "neutral" };
}

export default function InventoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [inventory, setInventory] = useState<InventoryWithDetails | null>(null);
  const [statusHistory, setStatusHistory] = useState<InventoryStatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transaction history state
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [txnLoading, setTxnLoading] = useState(false);
  const [txnTypeFilter, setTxnTypeFilter] = useState<string>("");
  const [txnStartDate, setTxnStartDate] = useState("");
  const [txnEndDate, setTxnEndDate] = useState("");
  const [showTxnFilters, setShowTxnFilters] = useState(false);

  // Change status modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<InventoryStatus>("available");
  const [statusNotes, setStatusNotes] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [statusSuccess, setStatusSuccess] = useState("");

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [forceDelete, setForceDelete] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [inventoryData, historyData] = await Promise.all([
        getInventoryById(resolvedParams.id),
        getInventoryStatusHistory(resolvedParams.id),
      ]);

      if (!inventoryData) {
        setError("Inventory record not found");
        return;
      }

      setInventory(inventoryData);
      setStatusHistory(historyData);

      // Fetch transactions for this product/location
      fetchTransactions(inventoryData.product_id, inventoryData.location_id);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (
    productId: string,
    locationId: string,
    typeFilter?: string,
    startDate?: string,
    endDate?: string
  ) => {
    setTxnLoading(true);
    try {
      const txns = await getInventoryTransactions({
        productId,
        locationId,
        transactionType: (typeFilter || undefined) as TransactionType | undefined,
        startDate: startDate || undefined,
        endDate: endDate ? `${endDate}T23:59:59.999Z` : undefined,
        limit: 50,
      });
      setTransactions(txns);
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
    } finally {
      setTxnLoading(false);
    }
  };

  const applyTxnFilters = () => {
    if (!inventory) return;
    fetchTransactions(
      inventory.product_id,
      inventory.location_id,
      txnTypeFilter,
      txnStartDate,
      txnEndDate
    );
  };

  const clearTxnFilters = () => {
    setTxnTypeFilter("");
    setTxnStartDate("");
    setTxnEndDate("");
    if (inventory) {
      fetchTransactions(inventory.product_id, inventory.location_id);
    }
  };

  useEffect(() => {
    fetchData();
  }, [resolvedParams.id]);

  const openStatusModal = () => {
    if (inventory) {
      setNewStatus(inventory.status || "available");
      setStatusNotes("");
      setStatusError("");
      setShowStatusModal(true);
    }
  };

  const closeStatusModal = () => {
    setShowStatusModal(false);
    setNewStatus("available");
    setStatusNotes("");
    setStatusError("");
  };

  const handleStatusChange = async () => {
    if (!inventory) return;

    if ((newStatus === "damaged" || newStatus === "quarantine") && !statusNotes.trim()) {
      setStatusError(`Notes are required when changing status to ${newStatus}`);
      return;
    }

    if (newStatus === inventory.status) {
      setStatusError("Please select a different status");
      return;
    }

    setStatusLoading(true);
    setStatusError("");

    try {
      await updateInventoryStatus(inventory.id, newStatus, statusNotes.trim() || null);
      setStatusSuccess(`Status changed to ${getInventoryStatusDisplay(newStatus).label}`);
      setTimeout(() => setStatusSuccess(""), 3000);
      closeStatusModal();
      fetchData();
    } catch (err) {
      setStatusError(handleApiError(err));
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!inventory) return;

    setDeleteLoading(true);
    setDeleteError("");

    try {
      await deleteInventory(inventory.id, forceDelete);
      router.push("/inventory");
    } catch (err) {
      setDeleteError(handleApiError(err));
    } finally {
      setDeleteLoading(false);
    }
  };

  const openDeleteModal = () => {
    setDeleteError("");
    setForceDelete(false);
    setShowDeleteModal(true);
  };

  const actionButtons = (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={() => router.back()}>
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back
      </Button>
    </div>
  );

  if (loading) {
    return (
      <AppShell title="Inventory Details" actions={actionButtons}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </AppShell>
    );
  }

  if (error || !inventory) {
    return (
      <AppShell title="Inventory Details" actions={actionButtons}>
        <FetchError message={error || "Inventory not found"} onRetry={fetchData} />
      </AppShell>
    );
  }

  const statusInfo = getInventoryStatusDisplay(inventory.status || "available");

  return (
    <AppShell
      title={inventory.product?.name || "Inventory Details"}
      actions={actionButtons}
    >
      <Breadcrumbs items={[
        { label: "Inventory", href: "/inventory" },
        { label: inventory.product?.name || inventory.product?.sku || "Details" }
      ]} />
      {statusSuccess && (
        <div className="mb-4">
          <Alert type="success" message={statusSuccess} onClose={() => setStatusSuccess("")} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Product Info Card */}
          <Card>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Package className="w-8 h-8 text-blue-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900">
                  {inventory.product?.name}
                </h2>
                <p className="text-gray-500 font-mono">{inventory.product?.sku}</p>
                {inventory.product?.category && (
                  <Badge variant="default" size="sm" className="mt-2">
                    {inventory.product.category}
                  </Badge>
                )}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">On Hand</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {inventory.qty_on_hand}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Reserved</p>
                <p className="text-2xl font-semibold text-yellow-600">
                  {inventory.qty_reserved}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Available</p>
                <p className={`text-2xl font-semibold ${
                  inventory.qty_on_hand - inventory.qty_reserved <= 0
                    ? "text-red-600"
                    : "text-green-600"
                }`}>
                  {inventory.qty_on_hand - inventory.qty_reserved}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Unit Cost</p>
                <p className="text-2xl font-semibold text-gray-900">
                  ${inventory.product?.unit_cost?.toFixed(2) || "0.00"}
                </p>
              </div>
            </div>
          </Card>

          {/* Location Info */}
          <Card>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-gray-400" />
              Location
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Warehouse</p>
                <p className="font-medium text-gray-900">{inventory.location?.name}</p>
                {(inventory.location?.city || inventory.location?.state) && (
                  <p className="text-sm text-gray-500">
                    {[inventory.location.city, inventory.location.state].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500">Sublocation</p>
                {inventory.sublocation ? (
                  <div className="flex items-center gap-2">
                    <Grid3X3 className="w-4 h-4 text-purple-500" />
                    <span className="font-mono font-medium text-gray-900">
                      {inventory.sublocation.code}
                    </span>
                    {inventory.sublocation.zone && (
                      <Badge variant="default" size="sm">Zone {inventory.sublocation.zone}</Badge>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-400">Unassigned</p>
                )}
              </div>
            </div>
          </Card>

          {/* Inventory Transaction History */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-gray-400" />
                Transaction History
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTxnFilters(!showTxnFilters)}
              >
                <Filter className="w-4 h-4 mr-1" />
                Filters
              </Button>
            </div>

            {/* Filters */}
            {showTxnFilters && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                    <select
                      value={txnTypeFilter}
                      onChange={(e) => setTxnTypeFilter(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    >
                      {transactionTypeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                    <input
                      type="date"
                      value={txnStartDate}
                      onChange={(e) => setTxnStartDate(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                    <input
                      type="date"
                      value={txnEndDate}
                      onChange={(e) => setTxnEndDate(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={applyTxnFilters}>Apply</Button>
                  <Button size="sm" variant="ghost" onClick={clearTxnFilters}>Clear</Button>
                </div>
              </div>
            )}

            {txnLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : transactions.length > 0 ? (
              <div className="space-y-2">
                {transactions.map((txn) => {
                  const typeDisplay = getTransactionTypeDisplay(txn.transaction_type);
                  return (
                    <div
                      key={txn.id}
                      className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {/* Direction Icon */}
                      <div className={`p-2 rounded-lg ${typeDisplay.bgColor}`}>
                        {typeDisplay.icon === "up" ? (
                          <ArrowUpRight className={`w-4 h-4 ${typeDisplay.color}`} />
                        ) : typeDisplay.icon === "down" ? (
                          <ArrowDownRight className={`w-4 h-4 ${typeDisplay.color}`} />
                        ) : (
                          <ArrowRightLeft className={`w-4 h-4 ${typeDisplay.color}`} />
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeDisplay.bgColor} ${typeDisplay.color}`}>
                            {typeDisplay.label}
                          </span>
                          {txn.reference_type && (
                            <span className="text-xs text-gray-400">
                              {txn.reference_type.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                        {txn.notes && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{txn.notes}</p>
                        )}
                        {txn.lot && (
                          <p className="text-xs text-purple-600 mt-0.5">Lot: {txn.lot.lot_number}</p>
                        )}
                      </div>

                      {/* Quantity Change */}
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-semibold ${
                          txn.qty_change > 0
                            ? "text-green-600"
                            : txn.qty_change < 0
                            ? "text-red-600"
                            : "text-gray-500"
                        }`}>
                          {txn.qty_change > 0 ? "+" : ""}{txn.qty_change}
                        </p>
                        <p className="text-xs text-gray-400">
                          {txn.qty_before} → {txn.qty_after}
                        </p>
                      </div>

                      {/* Timestamp */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-gray-500">
                          {formatRelativeTime(txn.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {transactions.length >= 50 && (
                  <p className="text-center text-xs text-gray-400 pt-2">
                    Showing most recent 50 transactions
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No transactions found</p>
                {(txnTypeFilter || txnStartDate || txnEndDate) && (
                  <p className="text-xs mt-1">Try adjusting your filters</p>
                )}
              </div>
            )}
          </Card>

          {/* Status History */}
          <Card>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-gray-400" />
              Activity History
            </h3>
            {statusHistory.length > 0 ? (
              <div className="space-y-4">
                {statusHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className={`p-2 rounded-lg ${
                      entry.action === "status_change"
                        ? "bg-purple-100"
                        : entry.action === "stock_adjustment"
                        ? "bg-blue-100"
                        : "bg-gray-100"
                    }`}>
                      {entry.action === "status_change" ? (
                        <RefreshCw className="w-4 h-4 text-purple-600" />
                      ) : entry.action === "stock_adjustment" ? (
                        <Package className="w-4 h-4 text-blue-600" />
                      ) : (
                        <MoveRight className="w-4 h-4 text-gray-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-gray-900">
                          {getActionLabel(entry.action)}
                        </p>
                        <span className="text-xs text-gray-500">
                          {formatRelativeTime(entry.created_at)}
                        </span>
                      </div>

                      {/* Status change details */}
                      {entry.action === "status_change" && entry.details && (
                        <div className="mt-1 flex items-center gap-2 text-sm">
                          {entry.details.old_status && (
                            <>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                getInventoryStatusDisplay(entry.details.old_status as InventoryStatus).bgClass
                              } ${
                                getInventoryStatusDisplay(entry.details.old_status as InventoryStatus).textClass
                              }`}>
                                {getInventoryStatusDisplay(entry.details.old_status as InventoryStatus).label}
                              </span>
                              <span className="text-gray-400">&rarr;</span>
                            </>
                          )}
                          {entry.details.new_status && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              getInventoryStatusDisplay(entry.details.new_status as InventoryStatus).bgClass
                            } ${
                              getInventoryStatusDisplay(entry.details.new_status as InventoryStatus).textClass
                            }`}>
                              {getInventoryStatusDisplay(entry.details.new_status as InventoryStatus).label}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Stock adjustment details */}
                      {entry.action === "stock_adjustment" && entry.details && (
                        <p className="mt-1 text-sm text-gray-600">
                          Quantity changed by {(entry.details.qty_change as number) > 0 ? "+" : ""}
                          {entry.details.qty_change as number}
                          {entry.details.reason && ` (${entry.details.reason})`}
                        </p>
                      )}

                      {/* Sublocation move details */}
                      {entry.action === "sublocation_move" && entry.details && (
                        <p className="mt-1 text-sm text-gray-600">
                          Moved {entry.details.quantity as number} units
                        </p>
                      )}

                      {/* Notes */}
                      {entry.details?.notes && (
                        <p className="mt-1 text-sm text-gray-500 italic">
                          &quot;{entry.details.notes as string}&quot;
                        </p>
                      )}

                      {/* User info */}
                      {entry.user && (
                        <p className="mt-1 text-xs text-gray-400 flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {entry.user.name}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <History className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No activity history available</p>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar - Status Section */}
        <div className="space-y-6">
          {/* Current Status Card */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Status</h3>
              <Button variant="ghost" size="sm" onClick={openStatusModal}>
                <Pencil className="w-4 h-4 mr-1" />
                Change
              </Button>
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-3 mb-4">
              <span className={`inline-flex items-center px-4 py-2 rounded-full text-lg font-semibold ${statusInfo.bgClass} ${statusInfo.textClass}`}>
                {statusInfo.label}
              </span>
            </div>

            {/* Status Description */}
            <p className="text-sm text-gray-600 mb-4">
              {statusInfo.description}
            </p>

            {/* Status Details */}
            <div className="space-y-3 pt-4 border-t">
              {/* Changed Date */}
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Status Changed</p>
                  <p className="text-sm font-medium text-gray-900">
                    {inventory.status_changed_at
                      ? formatDateTime(inventory.status_changed_at)
                      : "Not recorded"}
                  </p>
                  {inventory.status_changed_at && (
                    <p className="text-xs text-gray-400">
                      {formatRelativeTime(inventory.status_changed_at)}
                    </p>
                  )}
                </div>
              </div>

              {/* Changed By */}
              <div className="flex items-start gap-3">
                <User className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Changed By</p>
                  <p className="text-sm font-medium text-gray-900">
                    {inventory.status_changed_by || "Unknown"}
                  </p>
                </div>
              </div>

              {/* Status Notes */}
              <div className="flex items-start gap-3">
                <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Notes</p>
                  {inventory.status_notes ? (
                    <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded mt-1">
                      {inventory.status_notes}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No notes</p>
                  )}
                </div>
              </div>
            </div>

            {/* Warning for non-available status */}
            {inventory.status && inventory.status !== "available" && (
              <div className={`mt-4 p-3 rounded-lg ${
                inventory.status === "damaged"
                  ? "bg-red-50 border border-red-100"
                  : inventory.status === "quarantine"
                  ? "bg-yellow-50 border border-yellow-100"
                  : "bg-gray-50 border border-gray-100"
              }`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                    inventory.status === "damaged"
                      ? "text-red-500"
                      : inventory.status === "quarantine"
                      ? "text-yellow-500"
                      : "text-gray-500"
                  }`} />
                  <p className={`text-sm ${
                    inventory.status === "damaged"
                      ? "text-red-700"
                      : inventory.status === "quarantine"
                      ? "text-yellow-700"
                      : "text-gray-700"
                  }`}>
                    {inventory.status === "damaged" && "This inventory is marked as damaged and unavailable for sale."}
                    {inventory.status === "quarantine" && "This inventory is quarantined and requires inspection."}
                    {inventory.status === "reserved" && "This inventory is reserved for pending orders."}
                    {inventory.status === "returned" && "This inventory was returned and needs processing."}
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* Quick Actions */}
          <Card>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Button
                variant="secondary"
                className="w-full justify-start"
                onClick={openStatusModal}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Change Status
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start"
                onClick={() => router.push(`/products/${inventory.product_id}`)}
              >
                <Package className="w-4 h-4 mr-2" />
                View Product
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start"
                onClick={() => router.push(`/locations/${inventory.location_id}`)}
              >
                <MapPin className="w-4 h-4 mr-2" />
                View Location
              </Button>
              {inventory.status === "damaged" && (
                <Button
                  variant="secondary"
                  className="w-full justify-start text-red-600 hover:text-red-700"
                  onClick={() => router.push(`/damage-reports/new?product_id=${inventory.product_id}`)}
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Create Damage Report
                </Button>
              )}
              <div className="border-t pt-2 mt-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={openDeleteModal}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Inventory
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Change Status Modal */}
      <Modal
        isOpen={showStatusModal}
        onClose={closeStatusModal}
        title="Change Inventory Status"
        size="md"
      >
        <div className="space-y-4">
          {statusError && (
            <Alert type="error" message={statusError} onClose={() => setStatusError("")} />
          )}

          {/* Current Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Status
            </label>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusInfo.bgClass} ${statusInfo.textClass}`}>
              {statusInfo.label}
            </span>
          </div>

          {/* New Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Status *
            </label>
            <Select
              name="newStatus"
              options={inventoryStatusOptions}
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as InventoryStatus)}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes {(newStatus === "damaged" || newStatus === "quarantine") && (
                <span className="text-red-500">*</span>
              )}
            </label>
            <textarea
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              placeholder={
                newStatus === "damaged"
                  ? "Describe the damage..."
                  : newStatus === "quarantine"
                  ? "Reason for quarantine..."
                  : "Optional notes"
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            {(newStatus === "damaged" || newStatus === "quarantine") && (
              <p className="text-xs text-amber-600 mt-1">
                Notes are required when changing to {newStatus} status
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={closeStatusModal}>
              Cancel
            </Button>
            <Button
              onClick={handleStatusChange}
              loading={statusLoading}
              disabled={
                statusLoading ||
                newStatus === (inventory?.status || "available") ||
                ((newStatus === "damaged" || newStatus === "quarantine") && !statusNotes.trim())
              }
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Change Status
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Inventory Record"
        size="md"
      >
        <div className="space-y-4">
          {deleteError && (
            <Alert type="error" message={deleteError} onClose={() => setDeleteError("")} />
          )}

          <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Are you sure you want to delete this inventory record?</p>
                <p className="text-sm text-red-600 mt-1">
                  This will permanently remove the inventory record for <strong>{inventory?.product?.name}</strong> at <strong>{inventory?.location?.name}</strong>.
                </p>
              </div>
            </div>
          </div>

          {inventory && inventory.qty_on_hand > 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">
                    This inventory has {inventory.qty_on_hand} units on hand
                  </p>
                  <p className="text-sm text-yellow-600 mt-1">
                    You must enable &quot;Force Delete&quot; to remove inventory with remaining stock.
                  </p>
                  <label className="flex items-center gap-2 mt-3">
                    <input
                      type="checkbox"
                      checked={forceDelete}
                      onChange={(e) => setForceDelete(e.target.checked)}
                      className="rounded border-yellow-400 text-yellow-600 focus:ring-yellow-500"
                    />
                    <span className="text-sm font-medium text-yellow-800">
                      Force delete (I understand stock will be lost)
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deleteLoading}
              disabled={deleteLoading || (inventory?.qty_on_hand > 0 && !forceDelete)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Inventory
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
