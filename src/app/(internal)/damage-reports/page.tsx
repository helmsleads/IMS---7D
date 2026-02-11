"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  AlertTriangle,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  FileText,
  Eye,
  ExternalLink,
  Upload,
  X,
  Search,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";
import FetchError from "@/components/ui/FetchError";
import Pagination from "@/components/ui/Pagination";
import {
  getDamageReports,
  createDamageReport,
  DamageReportWithProduct,
} from "@/lib/api/damage-reports";
import { getProducts } from "@/lib/api/products";
import { getInboundOrders, InboundOrder } from "@/lib/api/inbound";
import { getReturns, ReturnWithItems } from "@/lib/api/returns";
import { getInventory, InventoryWithDetails } from "@/lib/api/inventory";
import { handleApiError } from "@/lib/utils/error-handler";
import { DamageResolution } from "@/types/database";

const ITEMS_PER_PAGE = 20;

interface Product {
  id: string;
  sku: string;
  name: string;
}

function getResolutionDisplay(resolution: DamageResolution): {
  label: string;
  variant: "warning" | "info" | "success" | "error" | "default";
  icon: React.ReactNode;
} {
  const resolutionMap: Record<DamageResolution, {
    label: string;
    variant: "warning" | "info" | "success" | "error" | "default";
    icon: React.ReactNode;
  }> = {
    pending: {
      label: "Pending",
      variant: "warning",
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    credit_requested: {
      label: "Credit Requested",
      variant: "info",
      icon: <RefreshCw className="w-3.5 h-3.5" />,
    },
    credit_received: {
      label: "Credit Received",
      variant: "success",
      icon: <CheckCircle className="w-3.5 h-3.5" />,
    },
    replaced: {
      label: "Replaced",
      variant: "success",
      icon: <RefreshCw className="w-3.5 h-3.5" />,
    },
    written_off: {
      label: "Written Off",
      variant: "error",
      icon: <XCircle className="w-3.5 h-3.5" />,
    },
    restocked: {
      label: "Restocked",
      variant: "success",
      icon: <Package className="w-3.5 h-3.5" />,
    },
  };
  return resolutionMap[resolution] || resolutionMap.pending;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
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

const resolutionFilterOptions = [
  { value: "pending", label: "Pending" },
  { value: "resolved", label: "Resolved" },
];

const referenceTypeOptions = [
  { value: "inbound", label: "Inbound Shipment" },
  { value: "inventory", label: "Inventory" },
  { value: "return", label: "Return" },
];

const damageTypeOptions = [
  { value: "crushed", label: "Crushed/Dented" },
  { value: "water_damage", label: "Water Damage" },
  { value: "torn_packaging", label: "Torn Packaging" },
  { value: "broken", label: "Broken/Shattered" },
  { value: "missing_parts", label: "Missing Parts" },
  { value: "contamination", label: "Contamination" },
  { value: "expired", label: "Expired" },
  { value: "manufacturing_defect", label: "Manufacturing Defect" },
  { value: "other", label: "Other" },
];

interface ReferenceItem {
  id: string;
  label: string;
  subLabel?: string;
}

export default function DamageReportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [reports, setReports] = useState<DamageReportWithProduct[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [selectedResolution, setSelectedResolution] = useState<string>(
    searchParams.get("resolution") || ""
  );
  const [selectedProduct, setSelectedProduct] = useState<string>(
    searchParams.get("product_id") || ""
  );
  const [selectedReferenceType, setSelectedReferenceType] = useState<string>(
    searchParams.get("reference_type") || ""
  );
  const [startDate, setStartDate] = useState<string>(
    searchParams.get("start_date") || ""
  );
  const [endDate, setEndDate] = useState<string>(
    searchParams.get("end_date") || ""
  );

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  // Form fields
  const [formReferenceType, setFormReferenceType] = useState("");
  const [formReferenceId, setFormReferenceId] = useState("");
  const [formProductId, setFormProductId] = useState("");
  const [formQuantity, setFormQuantity] = useState<number>(1);
  const [formDamageType, setFormDamageType] = useState("");
  const [formOtherDamageType, setFormOtherDamageType] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPhotos, setFormPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);

  // Reference lookup data
  const [inboundOrders, setInboundOrders] = useState<(InboundOrder & { item_count: number })[]>([]);
  const [returns, setReturns] = useState<ReturnWithItems[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryWithDetails[]>([]);
  const [referenceSearch, setReferenceSearch] = useState("");
  const [loadingReferences, setLoadingReferences] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportsData, productsData] = await Promise.all([
        getDamageReports({
          productId: selectedProduct || undefined,
          referenceType: selectedReferenceType || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
        getProducts(),
      ]);
      setReports(reportsData);
      setProducts(productsData);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedProduct, selectedReferenceType, startDate, endDate]);

  // Load reference data when reference type changes
  const loadReferenceData = async (type: string) => {
    setLoadingReferences(true);
    try {
      switch (type) {
        case "inbound":
          const inboundData = await getInboundOrders();
          setInboundOrders(inboundData);
          break;
        case "return":
          const returnsData = await getReturns();
          setReturns(returnsData);
          break;
        case "inventory":
          const inventoryData = await getInventory();
          setInventoryItems(inventoryData);
          break;
      }
    } catch (err) {
      console.error("Failed to load reference data:", err);
    } finally {
      setLoadingReferences(false);
    }
  };

  useEffect(() => {
    if (formReferenceType) {
      loadReferenceData(formReferenceType);
      setFormReferenceId("");
      setFormProductId("");
    }
  }, [formReferenceType]);

  // Get reference options based on type
  const referenceOptions = useMemo((): ReferenceItem[] => {
    const search = referenceSearch.toLowerCase();

    switch (formReferenceType) {
      case "inbound":
        return inboundOrders
          .filter(o =>
            o.po_number.toLowerCase().includes(search) ||
            o.supplier?.toLowerCase().includes(search)
          )
          .map(o => ({
            id: o.id,
            label: o.po_number,
            subLabel: o.supplier || "No supplier",
          }));
      case "return":
        return returns
          .filter(r =>
            r.return_number.toLowerCase().includes(search)
          )
          .map(r => ({
            id: r.id,
            label: r.return_number,
            subLabel: r.reason || "No reason",
          }));
      case "inventory":
        return inventoryItems
          .filter(i =>
            i.product.sku.toLowerCase().includes(search) ||
            i.product.name.toLowerCase().includes(search)
          )
          .map(i => ({
            id: i.id,
            label: `${i.product.sku} - ${i.product.name}`,
            subLabel: `${i.qty_on_hand} units at ${i.location.name}`,
          }));
      default:
        return [];
    }
  }, [formReferenceType, inboundOrders, returns, inventoryItems, referenceSearch]);

  // Handle photo upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Limit to 5 photos
    const newPhotos = [...formPhotos, ...files].slice(0, 5);
    setFormPhotos(newPhotos);

    // Create preview URLs
    const newUrls = newPhotos.map(file => URL.createObjectURL(file));
    // Clean up old URLs
    photoPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    setPhotoPreviewUrls(newUrls);
  };

  const removePhoto = (index: number) => {
    const newPhotos = formPhotos.filter((_, i) => i !== index);
    setFormPhotos(newPhotos);

    URL.revokeObjectURL(photoPreviewUrls[index]);
    const newUrls = photoPreviewUrls.filter((_, i) => i !== index);
    setPhotoPreviewUrls(newUrls);
  };

  // Reset form
  const resetForm = () => {
    setFormReferenceType("");
    setFormReferenceId("");
    setFormProductId("");
    setFormQuantity(1);
    setFormDamageType("");
    setFormOtherDamageType("");
    setFormDescription("");
    setFormPhotos([]);
    photoPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    setPhotoPreviewUrls([]);
    setReferenceSearch("");
    setCreateError("");
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    resetForm();
  };

  // Handle form submission
  const handleCreateReport = async () => {
    // Validation
    if (!formReferenceType) {
      setCreateError("Please select a reference type");
      return;
    }
    if (!formProductId) {
      setCreateError("Please select a product");
      return;
    }
    if (formQuantity < 1) {
      setCreateError("Quantity must be at least 1");
      return;
    }
    if (!formDamageType) {
      setCreateError("Please select a damage type");
      return;
    }
    if (formDamageType === "other" && !formOtherDamageType.trim()) {
      setCreateError("Please specify the damage type");
      return;
    }

    setCreateLoading(true);
    setCreateError("");

    try {
      // TODO: Upload photos to storage and get URLs
      // For now, we'll skip photo upload
      const photoUrls: string[] = [];

      await createDamageReport({
        reference_type: formReferenceType,
        reference_id: formReferenceId || null,
        product_id: formProductId,
        quantity: formQuantity,
        damage_type: formDamageType === "other" ? formOtherDamageType : formDamageType,
        description: formDescription || null,
        photo_urls: photoUrls,
      });

      setCreateSuccess("Damage report created successfully");
      setTimeout(() => setCreateSuccess(""), 3000);
      closeCreateModal();
      fetchData();
    } catch (err) {
      setCreateError(handleApiError(err));
    } finally {
      setCreateLoading(false);
    }
  };

  // Auto-select product when reference is selected (for inventory type)
  useEffect(() => {
    if (formReferenceType === "inventory" && formReferenceId) {
      const item = inventoryItems.find(i => i.id === formReferenceId);
      if (item) {
        setFormProductId(item.product_id);
      }
    }
  }, [formReferenceId, formReferenceType, inventoryItems]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedResolution, selectedProduct, selectedReferenceType, startDate, endDate]);

  const productOptions = useMemo(() => {
    return products.map((p) => ({ value: p.id, label: `${p.sku} - ${p.name}` }));
  }, [products]);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      // Resolution filter (pending vs resolved)
      if (selectedResolution === "pending" && report.resolution !== "pending") {
        return false;
      }
      if (selectedResolution === "resolved" && report.resolution === "pending") {
        return false;
      }
      return true;
    });
  }, [reports, selectedResolution]);

  const paginatedReports = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredReports.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredReports, currentPage]);

  const summaryStats = useMemo(() => {
    const pending = reports.filter((r) => r.resolution === "pending").length;
    const resolved = reports.filter((r) => r.resolution !== "pending").length;
    const totalQty = reports.reduce((sum, r) => sum + r.quantity, 0);

    return { pending, resolved, totalQty, total: reports.length };
  }, [reports]);

  // Get reference link based on type
  const getReferenceLink = (report: DamageReportWithProduct): string | null => {
    if (!report.reference_id) return null;
    switch (report.reference_type) {
      case "inbound":
        return `/inbound/${report.reference_id}`;
      case "return":
        return `/returns/${report.reference_id}`;
      case "inventory":
        return `/inventory/${report.reference_id}`;
      default:
        return null;
    }
  };

  const columns = [
    {
      key: "id",
      header: "Report ID",
      hideOnMobile: true,
      render: (report: DamageReportWithProduct) => (
        <span className="font-mono text-sm text-gray-600">
          {report.id.slice(0, 8)}...
        </span>
      ),
    },
    {
      key: "product",
      header: "Product",
      mobilePriority: 1,
      render: (report: DamageReportWithProduct) => (
        <div>
          <div className="font-medium text-gray-900">
            {report.product?.name || "Unknown Product"}
          </div>
          <div className="text-sm text-gray-500 font-mono">
            {report.product?.sku || "N/A"}
          </div>
        </div>
      ),
    },
    {
      key: "quantity",
      header: "Qty",
      render: (report: DamageReportWithProduct) => (
        <span className="font-semibold text-red-600">{report.quantity}</span>
      ),
    },
    {
      key: "damage_type",
      header: "Damage Type",
      hideOnMobile: true,
      render: (report: DamageReportWithProduct) => (
        <span className="text-gray-700">
          {report.damage_type || <span className="text-gray-400">Not specified</span>}
        </span>
      ),
    },
    {
      key: "reference",
      header: "Reference",
      hideOnMobile: true,
      render: (report: DamageReportWithProduct) => {
        const typeLabels: Record<string, { label: string; color: string }> = {
          inbound: { label: "Inbound", color: "text-blue-600" },
          inventory: { label: "Inventory", color: "text-purple-600" },
          return: { label: "Return", color: "text-orange-600" },
        };
        const typeInfo = typeLabels[report.reference_type] || { label: report.reference_type, color: "text-gray-600" };
        const link = getReferenceLink(report);

        return (
          <div className="flex items-center gap-1">
            <span className={`text-sm ${typeInfo.color}`}>
              {typeInfo.label}
            </span>
            {link && report.reference_id && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(link);
                }}
                className="text-blue-500 hover:text-blue-700"
                title="View reference"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      },
    },
    {
      key: "reported_at",
      header: "Reported Date",
      mobilePriority: 2,
      render: (report: DamageReportWithProduct) => (
        <div>
          <div className="text-gray-900">{formatDate(report.reported_at)}</div>
          <div className="text-xs text-gray-500">
            {formatRelativeTime(report.reported_at)}
          </div>
        </div>
      ),
    },
    {
      key: "resolution",
      header: "Status",
      mobilePriority: 3,
      render: (report: DamageReportWithProduct) => {
        const resInfo = getResolutionDisplay(report.resolution);
        return (
          <Badge variant={resInfo.variant} size="sm">
            <span className="flex items-center gap-1">
              {resInfo.icon}
              {resInfo.label}
            </span>
          </Badge>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (report: DamageReportWithProduct) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/damage-reports/${report.id}`);
            }}
            title="View details"
          >
            <Eye className="w-4 h-4" />
          </Button>
          {report.resolution === "pending" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/damage-reports/${report.id}?action=resolve`);
              }}
              className="text-green-600 hover:text-green-700"
              title="Resolve"
            >
              <CheckCircle className="w-4 h-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const actionButtons = (
    <Button onClick={openCreateModal}>
      <Plus className="w-4 h-4 mr-1" />
      Report Damage
    </Button>
  );

  if (error) {
    return (
      <AppShell title="Damage Reports" actions={actionButtons}>
        <FetchError message={error} onRetry={fetchData} />
      </AppShell>
    );
  }

  return (
    <AppShell title="Damage Reports" actions={actionButtons}>
      {/* Subtitle */}
      <p className="text-gray-500 -mt-4 mb-6">
        Track and resolve damaged inventory
      </p>

      {createSuccess && (
        <div className="mb-4">
          <Alert type="success" message={createSuccess} onClose={() => setCreateSuccess("")} />
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Reports</p>
              <p className="text-xl font-semibold text-gray-900">
                {summaryStats.total}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-xl font-semibold text-yellow-600">
                {summaryStats.pending}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Resolved</p>
              <p className="text-xl font-semibold text-green-600">
                {summaryStats.resolved}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Units</p>
              <p className="text-xl font-semibold text-gray-900">
                {summaryStats.totalQty}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Resolution Status */}
          <div className="w-40">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Status
            </label>
            <Select
              name="resolution"
              options={resolutionFilterOptions}
              value={selectedResolution}
              onChange={(e) => setSelectedResolution(e.target.value)}
              placeholder="All Status"
            />
          </div>

          {/* Product */}
          <div className="w-56">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Product
            </label>
            <Select
              name="product"
              options={productOptions}
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              placeholder="All Products"
            />
          </div>

          {/* Reference Type */}
          <div className="w-44">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Reference Type
            </label>
            <Select
              name="referenceType"
              options={referenceTypeOptions}
              value={selectedReferenceType}
              onChange={(e) => setSelectedReferenceType(e.target.value)}
              placeholder="All Types"
            />
          </div>

          {/* Date Range */}
          <div className="w-40">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="w-40">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Clear Filters */}
          {(selectedResolution || selectedProduct || selectedReferenceType || startDate || endDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedResolution("");
                setSelectedProduct("");
                setSelectedReferenceType("");
                setStartDate("");
                setEndDate("");
              }}
              className="text-gray-500"
            >
              <XCircle className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Reports List */}
      {!loading && filteredReports.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="w-12 h-12" />}
            title="No damage reports"
            description={
              selectedResolution || selectedProduct || selectedReferenceType || startDate || endDate
                ? "No reports match your filters. Try adjusting your search criteria."
                : "No damage has been reported yet. Create a report when inventory damage is discovered."
            }
            action={
              <Button onClick={openCreateModal}>
                <Plus className="w-4 h-4 mr-1" />
                Report Damage
              </Button>
            }
          />
        </Card>
      ) : (
        <Card padding="none">
          <Table
            columns={columns}
            data={paginatedReports}
            loading={loading}
            emptyMessage="No damage reports found"
            onRowClick={(report) => router.push(`/damage-reports/${report.id}`)}
            rowClassName={(report) =>
              report.resolution === "pending"
                ? "bg-yellow-50 hover:bg-yellow-100"
                : ""
            }
          />
          <Pagination
            currentPage={currentPage}
            totalItems={filteredReports.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
          />
        </Card>
      )}

      {/* Create Damage Report Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        title="Report Damage"
        size="lg"
      >
        <div className="space-y-4">
          {createError && (
            <Alert type="error" message={createError} onClose={() => setCreateError("")} />
          )}

          {/* Reference Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reference Type <span className="text-red-500">*</span>
            </label>
            <Select
              name="formReferenceType"
              options={referenceTypeOptions}
              value={formReferenceType}
              onChange={(e) => setFormReferenceType(e.target.value)}
              placeholder="Select reference type..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Where was the damage discovered?
            </p>
          </div>

          {/* Reference Lookup */}
          {formReferenceType && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Reference
              </label>
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={referenceSearch}
                    onChange={(e) => setReferenceSearch(e.target.value)}
                    placeholder={`Search ${formReferenceType === "inbound" ? "PO numbers" : formReferenceType === "return" ? "return numbers" : "inventory items"}...`}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {loadingReferences ? (
                  <div className="mt-2 text-sm text-gray-500">Loading...</div>
                ) : (
                  <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                    {referenceOptions.length === 0 ? (
                      <div className="p-3 text-sm text-gray-500 text-center">
                        {referenceSearch ? "No results found" : "No items available"}
                      </div>
                    ) : (
                      referenceOptions.slice(0, 10).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setFormReferenceId(item.id);
                            setReferenceSearch(item.label);
                          }}
                          className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${
                            formReferenceId === item.id ? "bg-blue-50" : ""
                          }`}
                        >
                          <div className="font-medium text-sm text-gray-900">
                            {item.label}
                          </div>
                          {item.subLabel && (
                            <div className="text-xs text-gray-500">{item.subLabel}</div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Product */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product <span className="text-red-500">*</span>
            </label>
            <Select
              name="formProductId"
              options={productOptions}
              value={formProductId}
              onChange={(e) => setFormProductId(e.target.value)}
              placeholder="Select product..."
              disabled={formReferenceType === "inventory" && !!formReferenceId}
            />
            {formReferenceType === "inventory" && formReferenceId && (
              <p className="text-xs text-gray-500 mt-1">
                Product auto-selected from inventory item
              </p>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity Damaged <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={formQuantity}
              onChange={(e) => setFormQuantity(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Damage Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Damage Type <span className="text-red-500">*</span>
            </label>
            <Select
              name="formDamageType"
              options={damageTypeOptions}
              value={formDamageType}
              onChange={(e) => setFormDamageType(e.target.value)}
              placeholder="Select damage type..."
            />
          </div>

          {/* Other Damage Type */}
          {formDamageType === "other" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Specify Damage Type <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formOtherDamageType}
                onChange={(e) => setFormOtherDamageType(e.target.value)}
                placeholder="Describe the type of damage..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Provide additional details about the damage..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Photos
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              {photoPreviewUrls.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {photoPreviewUrls.map((url, index) => (
                    <div key={index} className="relative">
                      <img
                        src={url}
                        alt={`Damage photo ${index + 1}`}
                        className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {formPhotos.length < 5 && (
                <label className="flex flex-col items-center gap-2 cursor-pointer">
                  <Upload className="w-8 h-8 text-gray-400" />
                  <span className="text-sm text-gray-500">
                    Click to upload photos (max 5)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {formPhotos.length}/5 photos uploaded
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={closeCreateModal}
              disabled={createLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateReport}
              loading={createLoading}
            >
              Create Report
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
