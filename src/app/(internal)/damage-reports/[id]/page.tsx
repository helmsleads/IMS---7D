"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Package,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Calendar,
  User,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  DollarSign,
  Truck,
  Undo2,
  Trash2,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import Alert from "@/components/ui/Alert";
import FetchError from "@/components/ui/FetchError";
import {
  getDamageReport,
  resolveDamageReport,
  DamageReportWithProduct,
} from "@/lib/api/damage-reports";
import { getLocations, Location } from "@/lib/api/locations";
import { handleApiError } from "@/lib/utils/error-handler";
import { DamageResolution } from "@/types/database";
import { MapPin, ArrowDown, ArrowUp } from "lucide-react";

function getResolutionDisplay(resolution: DamageResolution): {
  label: string;
  variant: "warning" | "info" | "success" | "error" | "default";
  icon: React.ReactNode;
  description: string;
} {
  const resolutionMap: Record<DamageResolution, {
    label: string;
    variant: "warning" | "info" | "success" | "error" | "default";
    icon: React.ReactNode;
    description: string;
  }> = {
    pending: {
      label: "Pending",
      variant: "warning",
      icon: <Clock className="w-4 h-4" />,
      description: "This report is awaiting resolution",
    },
    credit_requested: {
      label: "Credit Requested",
      variant: "info",
      icon: <RefreshCw className="w-4 h-4" />,
      description: "Credit has been requested from the supplier",
    },
    credit_received: {
      label: "Credit Received",
      variant: "success",
      icon: <CheckCircle className="w-4 h-4" />,
      description: "Credit has been received from the supplier",
    },
    replaced: {
      label: "Replaced",
      variant: "success",
      icon: <RefreshCw className="w-4 h-4" />,
      description: "The damaged items have been replaced",
    },
    written_off: {
      label: "Written Off",
      variant: "error",
      icon: <XCircle className="w-4 h-4" />,
      description: "The damaged items have been written off as a loss",
    },
    restocked: {
      label: "Restocked",
      variant: "success",
      icon: <Package className="w-4 h-4" />,
      description: "The items were returned to inventory",
    },
  };
  return resolutionMap[resolution] || resolutionMap.pending;
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

const resolutionOptions = [
  { value: "credit_requested", label: "Credit Requested" },
  { value: "credit_received", label: "Credit Received" },
  { value: "replaced", label: "Replaced" },
  { value: "written_off", label: "Written Off" },
  { value: "restocked", label: "Restocked" },
];

export default function DamageReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const autoResolve = searchParams.get("action") === "resolve";

  const [report, setReport] = useState<DamageReportWithProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Location state
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");

  // Resolve Modal
  const [showResolveModal, setShowResolveModal] = useState(autoResolve);
  const [resolveLoading, setResolveLoading] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const [selectedResolution, setSelectedResolution] = useState<string>("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [creditAmount, setCreditAmount] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState("");
  const [modalTitle, setModalTitle] = useState("Resolve Damage Report");

  // Photo modal
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDamageReport(id);
      if (!data) {
        setError("Damage report not found");
        return;
      }
      setReport(data);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchReport();
      getLocations()
        .then((locs) => setLocations(locs.filter((l) => l.active)))
        .catch(() => {});
    }
  }, [id]);

  const needsLocation = selectedResolution === "written_off" || selectedResolution === "restocked";

  const handleResolve = async () => {
    if (report?.resolution !== "pending") {
      setResolveError("This report has already been resolved");
      return;
    }

    if (!selectedResolution) {
      setResolveError("Please select a resolution");
      return;
    }

    // Validate location for write-off and restock
    if (needsLocation && !selectedLocationId) {
      setResolveError(
        selectedResolution === "written_off"
          ? "Please select the location to deduct inventory from"
          : "Please select the location to restock inventory to"
      );
      return;
    }

    // Validate credit amount if resolution involves credit
    const needsCredit = selectedResolution === "credit_requested" || selectedResolution === "credit_received";
    const parsedCreditAmount = creditAmount ? parseFloat(creditAmount) : null;

    if (needsCredit && creditAmount && isNaN(parsedCreditAmount!)) {
      setResolveError("Please enter a valid credit amount");
      return;
    }

    setResolveLoading(true);
    setResolveError("");

    try {
      await resolveDamageReport(
        id,
        selectedResolution as DamageResolution,
        resolutionNotes || null,
        parsedCreditAmount,
        needsLocation ? selectedLocationId : undefined
      );

      const resolutionLabels: Record<string, string> = {
        credit_requested: "Credit request submitted",
        credit_received: "Credit received recorded",
        replaced: "Marked for return to vendor",
        written_off: "Items written off",
        restocked: "Items restocked",
      };

      setSuccessMessage(resolutionLabels[selectedResolution] || "Report resolved successfully");
      setShowResolveModal(false);
      resetResolveModal();
      fetchReport();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setResolveError(handleApiError(err));
    } finally {
      setResolveLoading(false);
    }
  };

  const resetResolveModal = () => {
    setSelectedResolution("");
    setResolutionNotes("");
    setCreditAmount("");
    setSelectedLocationId("");
    setResolveError("");
    setModalTitle("Resolve Damage Report");
  };

  const openResolveModal = (resolution?: DamageResolution, title?: string) => {
    resetResolveModal();
    if (resolution) {
      setSelectedResolution(resolution);
    }
    if (title) {
      setModalTitle(title);
    }
    setShowResolveModal(true);
  };

  const getReferenceLink = (): string | null => {
    if (!report?.reference_id) return null;
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

  const getReferenceTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      inbound: "Inbound Shipment",
      inventory: "Inventory",
      return: "Return",
    };
    return labels[type] || type;
  };

  const backButton = (
    <Button
      variant="ghost"
      onClick={() => router.push("/damage-reports")}
      className="mr-2"
    >
      <ArrowLeft className="w-4 h-4 mr-1" />
      Back
    </Button>
  );

  if (loading) {
    return (
      <AppShell title="Loading...">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </AppShell>
    );
  }

  if (error || !report) {
    return (
      <AppShell title="Damage Report" actions={backButton}>
        <FetchError message={error || "Report not found"} onRetry={fetchReport} />
      </AppShell>
    );
  }

  const resInfo = getResolutionDisplay(report.resolution);
  const referenceLink = getReferenceLink();

  return (
    <AppShell
      title={`Damage Report`}
      actions={backButton}
    >
      <Breadcrumbs items={[
        { label: "Damage Reports", href: "/damage-reports" },
        { label: `#${report.id.slice(0, 8)}` || "Report Details" }
      ]} />
      {/* Report ID subtitle */}
      <p className="text-gray-500 font-mono text-sm -mt-4 mb-6">
        #{report.id.slice(0, 8)}
      </p>

      {successMessage && (
        <div className="mb-4">
          <Alert type="success" message={successMessage} onClose={() => setSuccessMessage("")} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Product Info */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-gray-400" />
              <h3 className="font-medium text-gray-900">Product Information</h3>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gray-100 rounded-lg">
                <Package className="w-6 h-6 text-gray-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900">
                  {report.product?.name || "Unknown Product"}
                </h2>
                <p className="text-sm text-gray-500 font-mono">
                  SKU: {report.product?.sku || "N/A"}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 -ml-2"
                  onClick={() => router.push(`/products/${report.product_id}`)}
                >
                  View Product Details
                  <ExternalLink className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Damage Details */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h3 className="font-medium text-gray-900">Damage Details</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                <span className="text-xs text-red-600 uppercase tracking-wide font-medium">
                  Quantity Damaged
                </span>
                <p className="text-2xl font-bold text-red-600 mt-1">
                  {report.quantity}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                  Damage Type
                </span>
                <p className="text-lg font-semibold text-gray-900 mt-1">
                  {report.damage_type || "Not specified"}
                </p>
              </div>
            </div>
          </Card>

          {/* Description */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-gray-400" />
              <h3 className="font-medium text-gray-900">Description</h3>
            </div>
            {report.description ? (
              <p className="text-gray-600 whitespace-pre-wrap">
                {report.description}
              </p>
            ) : (
              <p className="text-gray-400 italic">No description provided</p>
            )}
          </Card>

          {/* Photos Gallery */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <ImageIcon className="w-5 h-5 text-gray-400" />
              <h3 className="font-medium text-gray-900">
                Photos {report.photo_urls && report.photo_urls.length > 0 && `(${report.photo_urls.length})`}
              </h3>
            </div>
            {report.photo_urls && report.photo_urls.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {report.photo_urls.map((url, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedPhoto(url)}
                    className="aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all"
                  >
                    <img
                      src={url}
                      alt={`Damage photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <ImageIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400">No photos attached</p>
              </div>
            )}
          </Card>

          {/* Reference Link */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <ExternalLink className="w-5 h-5 text-gray-400" />
              <h3 className="font-medium text-gray-900">Reference</h3>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Source</p>
                <p className="font-medium text-gray-900 mt-1">
                  {getReferenceTypeLabel(report.reference_type)}
                </p>
              </div>
              {referenceLink ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push(referenceLink)}
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  View
                </Button>
              ) : (
                <span className="text-sm text-gray-400">No link available</span>
              )}
            </div>
          </Card>

          {/* Resolution Notes */}
          {report.resolution !== "pending" && report.resolution_notes && (
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-5 h-5 text-gray-400" />
                <h3 className="font-medium text-gray-900">Resolution Notes</h3>
              </div>
              <p className="text-gray-600 whitespace-pre-wrap">
                {report.resolution_notes}
              </p>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Resolution Status */}
          <Card>
            <h3 className="font-medium text-gray-900 mb-4">Resolution Status</h3>
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg ${
                resInfo.variant === "warning" ? "bg-yellow-100" :
                resInfo.variant === "success" ? "bg-green-100" :
                resInfo.variant === "error" ? "bg-red-100" :
                resInfo.variant === "info" ? "bg-blue-100" :
                "bg-gray-100"
              }`}>
                {resInfo.icon}
              </div>
              <div>
                <Badge variant={resInfo.variant} size="md">
                  {resInfo.label}
                </Badge>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              {resInfo.description}
            </p>

            {report.resolution === "pending" && (
              <div className="space-y-2">
                <Button
                  onClick={() => openResolveModal("credit_requested", "Request Credit")}
                  className="w-full justify-start"
                  variant="secondary"
                >
                  <DollarSign className="w-4 h-4 mr-2 text-blue-600" />
                  Request Credit
                </Button>
                <Button
                  onClick={() => openResolveModal("replaced", "Return to Vendor")}
                  className="w-full justify-start"
                  variant="secondary"
                >
                  <Truck className="w-4 h-4 mr-2 text-orange-600" />
                  Return to Vendor
                </Button>
                <Button
                  onClick={() => openResolveModal("restocked", "Restock Items")}
                  className="w-full justify-start"
                  variant="secondary"
                >
                  <Undo2 className="w-4 h-4 mr-2 text-green-600" />
                  Restock
                </Button>
                <Button
                  onClick={() => openResolveModal("written_off", "Write Off")}
                  className="w-full justify-start"
                  variant="secondary"
                >
                  <Trash2 className="w-4 h-4 mr-2 text-red-600" />
                  Write Off
                </Button>
                <div className="pt-2 border-t border-gray-100 mt-3">
                  <Button
                    onClick={() => openResolveModal()}
                    variant="ghost"
                    size="sm"
                    className="w-full text-gray-500"
                  >
                    Other Resolution...
                  </Button>
                </div>
              </div>
            )}

            {report.resolution !== "pending" && (
              <>
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">Resolved on</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatDateTime(report.resolved_at)}
                  </p>
                </div>
                {report.credit_amount && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500">Credit Amount</p>
                    <p className="text-lg font-semibold text-green-600">
                      ${report.credit_amount.toFixed(2)}
                    </p>
                  </div>
                )}
              </>
            )}
          </Card>

          {/* Reported By & Date */}
          <Card>
            <h3 className="font-medium text-gray-900 mb-4">Report Information</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Reported Date</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatDateTime(report.reported_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Reported By</p>
                  <p className="text-sm font-medium text-gray-900">
                    {report.reported_by || "Unknown"}
                  </p>
                </div>
              </div>
              {report.resolution !== "pending" && (
                <>
                  <div className="border-t border-gray-100 pt-4">
                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Resolved Date</p>
                        <p className="text-sm font-medium text-gray-900">
                          {formatDateTime(report.resolved_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Resolved By</p>
                      <p className="text-sm font-medium text-gray-900">
                        {report.resolved_by || "Unknown"}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Quick Actions */}
          <Card>
            <h3 className="font-medium text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Button
                variant="secondary"
                className="w-full justify-start"
                onClick={() => router.push(`/products/${report.product_id}`)}
              >
                <Package className="w-4 h-4 mr-2" />
                View Product
              </Button>
              {referenceLink && (
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={() => router.push(referenceLink)}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View {getReferenceTypeLabel(report.reference_type)}
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Resolve Modal */}
      <Modal
        isOpen={showResolveModal}
        onClose={() => {
          setShowResolveModal(false);
          resetResolveModal();
        }}
        title={modalTitle}
      >
        <div className="space-y-4">
          {resolveError && (
            <Alert type="error" message={resolveError} onClose={() => setResolveError("")} />
          )}

          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">
                  {report.product?.name}
                </p>
                <p className="text-sm text-gray-500">
                  {report.quantity} unit{report.quantity !== 1 ? "s" : ""} damaged
                </p>
              </div>
            </div>
          </div>

          {/* Resolution Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Resolution <span className="text-red-500">*</span>
            </label>
            <Select
              name="resolution"
              options={resolutionOptions}
              value={selectedResolution}
              onChange={(e) => setSelectedResolution(e.target.value)}
              placeholder="Select resolution..."
            />
          </div>

          {/* Credit Amount - Show when resolution involves credit */}
          {(selectedResolution === "credit_requested" || selectedResolution === "credit_received") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Credit Amount
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Enter the credit amount to request or record
              </p>
            </div>
          )}

          {/* Resolution-specific info messages */}
          {selectedResolution === "credit_requested" && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Request Credit:</strong> This will mark the report as pending credit from the vendor.
                You may want to contact the vendor to initiate the credit request.
              </p>
            </div>
          )}
          {selectedResolution === "replaced" && (
            <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg">
              <p className="text-sm text-orange-700">
                <strong>Return to Vendor:</strong> This indicates the damaged items will be returned to the vendor
                for replacement or credit.
              </p>
            </div>
          )}
          {selectedResolution === "restocked" && (
            <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
              <p className="text-sm text-green-700">
                <strong>Restock:</strong> Use this if the items are deemed acceptable after inspection
                and can be returned to available inventory.
              </p>
            </div>
          )}
          {selectedResolution === "written_off" && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-sm text-red-700">
                <strong>Write Off:</strong> This will record the damaged items as a loss.
                Inventory quantities will be adjusted accordingly.
              </p>
            </div>
          )}

          {/* Location selector for write-off and restock */}
          {needsLocation && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <MapPin className="w-3.5 h-3.5 inline mr-1" />
                {selectedResolution === "written_off"
                  ? "Deduct From Location"
                  : "Restock To Location"}{" "}
                <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select location...</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Inventory impact preview */}
          {needsLocation && selectedLocationId && report && (
            <div
              className={`p-3 rounded-lg border ${
                selectedResolution === "written_off"
                  ? "bg-red-50 border-red-200"
                  : "bg-green-50 border-green-200"
              }`}
            >
              <h4 className={`text-sm font-medium flex items-center gap-1 mb-1 ${
                selectedResolution === "written_off" ? "text-red-800" : "text-green-800"
              }`}>
                {selectedResolution === "written_off" ? (
                  <ArrowDown className="w-4 h-4" />
                ) : (
                  <ArrowUp className="w-4 h-4" />
                )}
                Inventory Impact
              </h4>
              <p className={`text-xs ${
                selectedResolution === "written_off" ? "text-red-700" : "text-green-700"
              }`}>
                <span className="font-medium">{report.product?.sku}</span>
                {" — "}
                {selectedResolution === "written_off"
                  ? `-${report.quantity} units from`
                  : `+${report.quantity} units to`}
                {" "}
                <span className="font-medium">
                  {locations.find((l) => l.id === selectedLocationId)?.name}
                </span>
              </p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Add any notes about the resolution..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => {
                setShowResolveModal(false);
                resetResolveModal();
              }}
              disabled={resolveLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              loading={resolveLoading}
            >
              {selectedResolution === "credit_requested" ? "Request Credit" :
               selectedResolution === "replaced" ? "Mark for Return" :
               selectedResolution === "restocked" ? "Restock Items" :
               selectedResolution === "written_off" ? "Write Off" :
               "Save Resolution"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Photo Lightbox */}
      <Modal
        isOpen={!!selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
        title="Damage Photo"
        size="lg"
      >
        {selectedPhoto && (
          <div className="flex justify-center">
            <img
              src={selectedPhoto}
              alt="Damage photo"
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
            />
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
