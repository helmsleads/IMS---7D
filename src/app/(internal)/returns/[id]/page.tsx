"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  Truck,
  AlertCircle,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import Alert from "@/components/ui/Alert";
import FetchError from "@/components/ui/FetchError";
import {
  getReturn,
  updateReturn,
  updateReturnStatus,
  updateReturnItem,
  receiveReturnItem,
  ReturnWithItems,
} from "@/lib/api/returns";
import { getLocations, Location } from "@/lib/api/locations";
import { ReturnStatus, ItemCondition, ItemDisposition } from "@/types/database";
import { handleApiError } from "@/lib/utils/error-handler";
import { MapPin, ArrowRight } from "lucide-react";

const statusFlow: ReturnStatus[] = [
  "requested",
  "approved",
  "shipped",
  "received",
  "processing",
  "completed",
];

const conditionOptions: { value: ItemCondition; label: string }[] = [
  { value: "good", label: "Good" },
  { value: "damaged", label: "Damaged" },
  { value: "defective", label: "Defective" },
  { value: "expired", label: "Expired" },
  { value: "other", label: "Other" },
];

const dispositionOptions: { value: ItemDisposition; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "restock", label: "Restock" },
  { value: "discard", label: "Discard" },
  { value: "return_to_vendor", label: "Return to Vendor" },
];

const getStatusIcon = (status: ReturnStatus) => {
  switch (status) {
    case "requested":
      return <Clock className="w-5 h-5" />;
    case "approved":
      return <CheckCircle className="w-5 h-5" />;
    case "denied":
      return <XCircle className="w-5 h-5" />;
    case "shipped":
      return <Truck className="w-5 h-5" />;
    case "received":
      return <Package className="w-5 h-5" />;
    case "processing":
      return <Clock className="w-5 h-5" />;
    case "completed":
      return <CheckCircle className="w-5 h-5" />;
    case "cancelled":
      return <XCircle className="w-5 h-5" />;
    default:
      return <AlertCircle className="w-5 h-5" />;
  }
};

const getStatusBadge = (status: ReturnStatus) => {
  switch (status) {
    case "requested":
      return <Badge variant="warning">Requested</Badge>;
    case "approved":
      return <Badge variant="info">Approved</Badge>;
    case "denied":
      return <Badge variant="error">Denied</Badge>;
    case "shipped":
      return <Badge variant="info">Shipped</Badge>;
    case "received":
      return <Badge variant="info">Received</Badge>;
    case "processing":
      return <Badge variant="warning">Processing</Badge>;
    case "completed":
      return <Badge variant="success">Completed</Badge>;
    case "cancelled":
      return <Badge variant="default">Cancelled</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatCurrency = (value: number | null) => {
  if (value === null) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
};

const formatCondition = (condition: string | null) => {
  if (!condition) return "-";
  return condition.charAt(0).toUpperCase() + condition.slice(1).replace("_", " ");
};

const formatDisposition = (disposition: string) => {
  const labels: Record<string, string> = {
    restock: "Restock",
    discard: "Discard",
    return_to_vendor: "Return to Vendor",
    pending: "Pending",
  };
  return labels[disposition] || disposition;
};

export default function ReturnDetailPage() {
  const params = useParams();
  const router = useRouter();
  const returnId = params.id as string;

  const [returnData, setReturnData] = useState<ReturnWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Location state for restock
  const [locations, setLocations] = useState<Location[]>([]);
  const [restockLocations, setRestockLocations] = useState<Record<string, string>>({});

  // Modal states
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showDenyModal, setShowDenyModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [approveNotes, setApproveNotes] = useState("");
  const [denyReason, setDenyReason] = useState("");
  const [creditAmount, setCreditAmount] = useState("");

  const fetchReturn = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getReturn(returnId);
      setReturnData(data);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (returnId) {
      fetchReturn();
      getLocations()
        .then((locs) => setLocations(locs.filter((l) => l.active)))
        .catch(() => {});
    }
  }, [returnId]);

  const handleStatusUpdate = async (newStatus: ReturnStatus) => {
    setUpdating(true);
    try {
      await updateReturnStatus(returnId, newStatus);
      await fetchReturn();
      setSuccessMessage(`Return status updated to ${newStatus}`);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setUpdating(false);
    }
  };

  const handleItemUpdate = async (
    itemId: string,
    field: string,
    value: string | number | null
  ) => {
    try {
      await updateReturnItem(itemId, { [field]: value });
      await fetchReturn();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const handleApprove = async () => {
    setUpdating(true);
    try {
      if (approveNotes) {
        await updateReturn(returnId, { notes: approveNotes });
      }
      await updateReturnStatus(returnId, "approved");
      await fetchReturn();
      setShowApproveModal(false);
      setApproveNotes("");
      setSuccessMessage("Return approved successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setUpdating(false);
    }
  };

  const handleDeny = async () => {
    if (!denyReason.trim()) {
      setError("Please provide a reason for denial");
      return;
    }
    setUpdating(true);
    try {
      await updateReturn(returnId, { reason_details: denyReason });
      await updateReturnStatus(returnId, "denied");
      await fetchReturn();
      setShowDenyModal(false);
      setDenyReason("");
      setSuccessMessage("Return denied");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setUpdating(false);
    }
  };

  const handleComplete = async () => {
    if (!returnData) return;

    // Validate: all restock items must have a location
    const restockItems = returnData.items.filter(
      (i) => i.disposition === "restock" && (i.qty_received || 0) > 0
    );
    const missingLocations = restockItems.filter(
      (i) => !restockLocations[i.id]
    );
    if (missingLocations.length > 0) {
      setError(
        `Please select a restock location for: ${missingLocations
          .map((i) => i.product?.name || i.product_id.slice(0, 8))
          .join(", ")}`
      );
      return;
    }

    setUpdating(true);
    try {
      // Process each item through receiveReturnItem (handles inventory + billing)
      const itemsToProcess = returnData.items.filter(
        (i) => (i.qty_received || 0) > 0
      );

      const processedIds: string[] = [];
      for (const item of itemsToProcess) {
        const locationId =
          item.disposition === "restock" ? restockLocations[item.id] : undefined;

        try {
          await receiveReturnItem(
            item.id,
            item.qty_received || 0,
            (item.condition || "other") as ItemCondition,
            item.disposition as ItemDisposition,
            locationId,
            undefined
          );
          processedIds.push(item.id);
        } catch (itemErr) {
          // Report which items failed and which succeeded
          const failedName = item.product?.name || item.product?.sku || item.id.slice(0, 8);
          const msg = processedIds.length > 0
            ? `Failed processing "${failedName}" (${processedIds.length} items succeeded before this). Please review item states before retrying.`
            : `Failed processing "${failedName}": ${itemErr instanceof Error ? itemErr.message : "Unknown error"}`;
          setError(msg);
          return;
        }
      }

      // Set credit and complete
      const credit = creditAmount ? parseFloat(creditAmount) : null;
      await updateReturn(returnId, { credit_amount: credit });
      await updateReturnStatus(returnId, "completed");
      await fetchReturn();
      setShowCompleteModal(false);
      setCreditAmount("");
      setRestockLocations({});
      setSuccessMessage("Return completed — inventory updated for restocked items");
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setUpdating(false);
    }
  };


  const backLink = (
    <Link
      href="/returns"
      className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
    >
      <ArrowLeft className="w-4 h-4 mr-1" />
      Back to Returns
    </Link>
  );

  if (loading) {
    return (
      <AppShell title="Loading...">
        {backLink}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-20 bg-gray-200 rounded"></div>
              </div>
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            </Card>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error && !returnData) {
    return (
      <AppShell title="Return Details">
        {backLink}
        <FetchError message={error} onRetry={fetchReturn} />
      </AppShell>
    );
  }

  if (!returnData) {
    return (
      <AppShell title="Return Not Found">
        {backLink}
        <Card>
          <EmptyState
            icon={<RotateCcw className="w-12 h-12" />}
            title="Return not found"
            description="The return you're looking for doesn't exist"
            action={
              <Button onClick={() => router.push("/returns")}>
                Go to Returns
              </Button>
            }
          />
        </Card>
      </AppShell>
    );
  }

  const currentStatusIndex = statusFlow.indexOf(returnData.status);
  const isTerminalStatus = ["denied", "completed", "cancelled"].includes(
    returnData.status
  );

  return (
    <AppShell
      title={`Return ${returnData.return_number}`}
      subtitle={returnData.client?.company_name}
    >
      <Breadcrumbs items={[
        { label: "Returns", href: "/returns" },
        { label: returnData.return_number || "Return Details" }
      ]} />
      {backLink}

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

      {/* Status Workflow */}
      <div className="mb-6">
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Status Workflow
          </h3>
          {isTerminalStatus && returnData.status !== "completed" ? (
            <div className="flex items-center gap-2 text-gray-500">
              {getStatusIcon(returnData.status)}
              <span>
                This return has been{" "}
                <span className="font-medium">{returnData.status}</span>
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between overflow-x-auto pb-2">
              {statusFlow.map((status, index) => {
                const isActive = status === returnData.status;
                const isCompleted = currentStatusIndex > index;

                return (
                  <div key={status} className="flex items-center">
                    <div className="flex flex-col items-center min-w-[80px]">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isCompleted
                            ? "bg-green-100 text-green-600"
                            : isActive
                            ? "bg-blue-100 text-blue-600 ring-2 ring-blue-500"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          getStatusIcon(status)
                        )}
                      </div>
                      <span
                        className={`text-xs mt-2 capitalize ${
                          isActive
                            ? "text-blue-600 font-medium"
                            : isCompleted
                            ? "text-green-600"
                            : "text-gray-400"
                        }`}
                      >
                        {status}
                      </span>
                    </div>
                    {index < statusFlow.length - 1 && (
                      <div
                        className={`h-1 w-8 mx-1 ${
                          currentStatusIndex > index
                            ? "bg-green-500"
                            : "bg-gray-200"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Status Actions */}
          {!isTerminalStatus && (
            <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-2">
              {/* Requested: Approve or Deny */}
              {returnData.status === "requested" && (
                <>
                  <Button
                    onClick={() => setShowApproveModal(true)}
                    disabled={updating}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setShowDenyModal(true)}
                    disabled={updating}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Deny
                  </Button>
                </>
              )}

              {/* Approved: Mark Shipped */}
              {returnData.status === "approved" && (
                <Button
                  onClick={() => handleStatusUpdate("shipped")}
                  disabled={updating}
                >
                  <Truck className="w-4 h-4 mr-2" />
                  Mark Shipped
                </Button>
              )}

              {/* Shipped: Mark Received */}
              {returnData.status === "shipped" && (
                <Button
                  onClick={() => handleStatusUpdate("received")}
                  disabled={updating}
                >
                  <Package className="w-4 h-4 mr-2" />
                  Mark Received
                </Button>
              )}

              {/* Received: Process Items or Complete */}
              {returnData.status === "received" && (
                <>
                  <Button
                    onClick={() => handleStatusUpdate("processing")}
                    disabled={updating}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Process Items
                  </Button>
                </>
              )}

              {/* Processing: Complete Return */}
              {returnData.status === "processing" && (
                <Button
                  onClick={() => setShowCompleteModal(true)}
                  disabled={updating}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Complete Return
                </Button>
              )}

              {/* Cancel option for all non-terminal statuses */}
              <Button
                variant="secondary"
                onClick={() => handleStatusUpdate("cancelled")}
                disabled={updating}
              >
                Cancel Return
              </Button>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Return Details */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Return Details
            </h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Return Number</dt>
                <dd className="mt-1 text-sm text-gray-900">{returnData.return_number}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Client</dt>
                <dd className="mt-1 text-sm">
                  <Link
                    href={`/clients/${returnData.client_id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {returnData.client?.company_name}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Original Order</dt>
                <dd className="mt-1 text-sm">
                  {returnData.original_order_id ? (
                    <Link
                      href={`/outbound/${returnData.original_order_id}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View Order
                    </Link>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1">{getStatusBadge(returnData.status)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Reason</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {returnData.reason || <span className="text-gray-400">-</span>}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Requested Date</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatDate(returnData.requested_at || returnData.created_at)}
                </dd>
              </div>
              {returnData.reason_details && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Reason Details</dt>
                  <dd className="mt-1 text-sm text-gray-900">{returnData.reason_details}</dd>
                </div>
              )}
              {returnData.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Notes</dt>
                  <dd className="mt-1 text-sm text-gray-900">{returnData.notes}</dd>
                </div>
              )}
            </dl>
          </Card>

          {/* Return Items */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Return Items
            </h3>
            {returnData.items.length === 0 ? (
              <p className="text-gray-500">No items in this return</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-medium text-gray-700">
                        Product
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">
                        Qty Requested
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">
                        Qty Received
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">
                        Condition
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">
                        Disposition
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">
                        Restock Location
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnData.items.map((item) => {
                      const isEditable = returnData.status === "received" || returnData.status === "processing";
                      return (
                        <tr
                          key={item.id}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="py-2 px-3">
                            <Link
                              href={`/products/${item.product_id}`}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <div className="font-medium">
                                {item.product?.name || "Unknown Product"}
                              </div>
                              <div className="text-xs text-gray-500">
                                {item.product?.sku || item.product_id.slice(0, 8)}
                              </div>
                            </Link>
                          </td>
                          <td className="py-2 px-3 text-gray-600">
                            {item.qty_requested}
                          </td>
                          <td className="py-2 px-3">
                            {isEditable ? (
                              <input
                                type="number"
                                value={item.qty_received ?? ""}
                                onChange={(e) =>
                                  handleItemUpdate(
                                    item.id,
                                    "qty_received",
                                    e.target.value ? parseInt(e.target.value, 10) : null
                                  )
                                }
                                min={0}
                                max={item.qty_requested}
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="0"
                              />
                            ) : (
                              <span className="text-gray-600">
                                {item.qty_received ?? "-"}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {isEditable ? (
                              <select
                                value={item.condition || ""}
                                onChange={(e) =>
                                  handleItemUpdate(
                                    item.id,
                                    "condition",
                                    e.target.value || null
                                  )
                                }
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">Select...</option>
                                {conditionOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            ) : item.condition ? (
                              <Badge
                                variant={
                                  item.condition === "good"
                                    ? "success"
                                    : item.condition === "damaged" ||
                                      item.condition === "defective"
                                    ? "error"
                                    : "warning"
                                }
                              >
                                {formatCondition(item.condition)}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {isEditable ? (
                              <select
                                value={item.disposition}
                                onChange={(e) =>
                                  handleItemUpdate(
                                    item.id,
                                    "disposition",
                                    e.target.value
                                  )
                                }
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                {dispositionOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-gray-600">
                                {formatDisposition(item.disposition)}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {item.disposition === "restock" && isEditable ? (
                              <select
                                value={restockLocations[item.id] || ""}
                                onChange={(e) =>
                                  setRestockLocations((prev) => ({
                                    ...prev,
                                    [item.id]: e.target.value,
                                  }))
                                }
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">Select location...</option>
                                {locations.map((loc) => (
                                  <option key={loc.id} value={loc.id}>
                                    {loc.name}
                                  </option>
                                ))}
                              </select>
                            ) : item.disposition === "restock" && restockLocations[item.id] ? (
                              <span className="text-sm text-gray-600 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {locations.find((l) => l.id === restockLocations[item.id])?.name || "-"}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {isEditable ? (
                              <input
                                type="text"
                                value={item.notes || ""}
                                onChange={(e) =>
                                  handleItemUpdate(item.id, "notes", e.target.value || null)
                                }
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Add notes..."
                              />
                            ) : (
                              <span className="text-gray-600 text-sm">
                                {item.notes || "-"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Reason & Notes */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Reason & Notes
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Return Reason
                </label>
                <p className="mt-1 text-gray-900">
                  {returnData.reason || "No reason provided"}
                </p>
              </div>
              {returnData.reason_details && (
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Additional Details
                  </label>
                  <p className="mt-1 text-gray-900">{returnData.reason_details}</p>
                </div>
              )}
              {returnData.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Internal Notes
                  </label>
                  <p className="mt-1 text-gray-900">{returnData.notes}</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Card */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Details</h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Status</dt>
                <dd>{getStatusBadge(returnData.status)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Client</dt>
                <dd className="text-sm font-medium text-gray-900">
                  <Link
                    href={`/clients/${returnData.client_id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {returnData.client?.company_name}
                  </Link>
                </dd>
              </div>
              {returnData.original_order_id && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Original Order</dt>
                  <dd className="text-sm">
                    <Link
                      href={`/outbound/${returnData.original_order_id}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View Order
                    </Link>
                  </dd>
                </div>
              )}
              {returnData.credit_amount !== null && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Credit Amount</dt>
                  <dd className="text-sm font-medium text-green-600">
                    {formatCurrency(returnData.credit_amount)}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          {/* Timeline */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h3>
            <div className="space-y-0">
              {/* Requested */}
              <div className="flex items-start gap-3 pb-4 relative">
                <div className="absolute left-[9px] top-5 bottom-0 w-0.5 bg-gray-200" />
                <div className={`w-5 h-5 rounded-full flex items-center justify-center z-10 ${
                  returnData.requested_at || returnData.created_at
                    ? "bg-green-100 text-green-600"
                    : "bg-gray-100 text-gray-400"
                }`}>
                  {(returnData.requested_at || returnData.created_at) ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Clock className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Requested</p>
                  <p className="text-sm text-gray-500">
                    {formatDate(returnData.requested_at || returnData.created_at)}
                  </p>
                </div>
              </div>

              {/* Approved/Denied */}
              <div className="flex items-start gap-3 pb-4 relative">
                <div className="absolute left-[9px] top-5 bottom-0 w-0.5 bg-gray-200" />
                <div className={`w-5 h-5 rounded-full flex items-center justify-center z-10 ${
                  returnData.status === "denied"
                    ? "bg-red-100 text-red-600"
                    : returnData.approved_at
                    ? "bg-green-100 text-green-600"
                    : "bg-gray-100 text-gray-400"
                }`}>
                  {returnData.status === "denied" ? (
                    <XCircle className="w-4 h-4" />
                  ) : returnData.approved_at ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Clock className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {returnData.status === "denied" ? "Denied" : "Approved"}
                  </p>
                  <p className={`text-sm ${returnData.approved_at || returnData.status === "denied" ? "text-gray-500" : "text-gray-400 italic"}`}>
                    {returnData.status === "denied"
                      ? formatDate(returnData.updated_at)
                      : returnData.approved_at
                      ? formatDate(returnData.approved_at)
                      : "Pending"}
                  </p>
                </div>
              </div>

              {/* Shipped */}
              {returnData.status !== "denied" && returnData.status !== "cancelled" && (
                <div className="flex items-start gap-3 pb-4 relative">
                  <div className="absolute left-[9px] top-5 bottom-0 w-0.5 bg-gray-200" />
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center z-10 ${
                    statusFlow.indexOf(returnData.status) >= statusFlow.indexOf("shipped")
                      ? "bg-green-100 text-green-600"
                      : "bg-gray-100 text-gray-400"
                  }`}>
                    {statusFlow.indexOf(returnData.status) >= statusFlow.indexOf("shipped") ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Truck className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Shipped</p>
                    <p className={`text-sm ${statusFlow.indexOf(returnData.status) >= statusFlow.indexOf("shipped") ? "text-gray-500" : "text-gray-400 italic"}`}>
                      {statusFlow.indexOf(returnData.status) >= statusFlow.indexOf("shipped")
                        ? "Shipped by client"
                        : "Pending"}
                    </p>
                  </div>
                </div>
              )}

              {/* Received */}
              {returnData.status !== "denied" && returnData.status !== "cancelled" && (
                <div className="flex items-start gap-3 pb-4 relative">
                  <div className="absolute left-[9px] top-5 bottom-0 w-0.5 bg-gray-200" />
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center z-10 ${
                    returnData.received_at
                      ? "bg-green-100 text-green-600"
                      : "bg-gray-100 text-gray-400"
                  }`}>
                    {returnData.received_at ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Package className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Received</p>
                    <p className={`text-sm ${returnData.received_at ? "text-gray-500" : "text-gray-400 italic"}`}>
                      {returnData.received_at ? formatDate(returnData.received_at) : "Pending"}
                    </p>
                  </div>
                </div>
              )}

              {/* Processing */}
              {returnData.status !== "denied" && returnData.status !== "cancelled" && (
                <div className="flex items-start gap-3 pb-4 relative">
                  <div className="absolute left-[9px] top-5 bottom-0 w-0.5 bg-gray-200" />
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center z-10 ${
                    statusFlow.indexOf(returnData.status) >= statusFlow.indexOf("processing")
                      ? "bg-green-100 text-green-600"
                      : "bg-gray-100 text-gray-400"
                  }`}>
                    {statusFlow.indexOf(returnData.status) >= statusFlow.indexOf("processing") ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Clock className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Processing</p>
                    <p className={`text-sm ${statusFlow.indexOf(returnData.status) >= statusFlow.indexOf("processing") ? "text-gray-500" : "text-gray-400 italic"}`}>
                      {statusFlow.indexOf(returnData.status) >= statusFlow.indexOf("processing")
                        ? "In progress"
                        : "Pending"}
                    </p>
                  </div>
                </div>
              )}

              {/* Completed */}
              {returnData.status !== "denied" && returnData.status !== "cancelled" && (
                <div className="flex items-start gap-3 relative">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center z-10 ${
                    returnData.processed_at
                      ? "bg-green-100 text-green-600"
                      : "bg-gray-100 text-gray-400"
                  }`}>
                    {returnData.processed_at ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Clock className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Completed</p>
                    <p className={`text-sm ${returnData.processed_at ? "text-gray-500" : "text-gray-400 italic"}`}>
                      {returnData.processed_at ? formatDate(returnData.processed_at) : "Pending"}
                    </p>
                  </div>
                </div>
              )}

              {/* Cancelled - if applicable */}
              {returnData.status === "cancelled" && (
                <div className="flex items-start gap-3 relative">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center z-10 bg-gray-100 text-gray-600">
                    <XCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Cancelled</p>
                    <p className="text-sm text-gray-500">
                      {formatDate(returnData.updated_at)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Approve Modal */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title="Approve Return"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Approving this return will notify the client that they can ship the items back.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add any notes for this approval..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowApproveModal(false)}
              disabled={updating}
            >
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={updating}>
              {updating ? "Approving..." : "Approve Return"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Deny Modal */}
      <Modal
        isOpen={showDenyModal}
        onClose={() => setShowDenyModal(false)}
        title="Deny Return"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Please provide a reason for denying this return request.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Denial <span className="text-red-500">*</span>
            </label>
            <textarea
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter the reason for denying this return..."
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowDenyModal(false)}
              disabled={updating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeny}
              disabled={updating || !denyReason.trim()}
            >
              {updating ? "Denying..." : "Deny Return"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Complete Return Modal */}
      <Modal
        isOpen={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        title="Complete Return"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Review the return details and enter the credit amount to issue to the client.
          </p>

          {/* Inventory Impact Preview */}
          {returnData && (() => {
            const restockItems = returnData.items.filter(
              (i) => i.disposition === "restock" && (i.qty_received || 0) > 0
            );
            const discardItems = returnData.items.filter(
              (i) => i.disposition === "discard" && (i.qty_received || 0) > 0
            );
            const vendorItems = returnData.items.filter(
              (i) => i.disposition === "return_to_vendor" && (i.qty_received || 0) > 0
            );
            const pendingItems = returnData.items.filter(
              (i) => i.disposition === "pending"
            );
            const missingLocs = restockItems.filter((i) => !restockLocations[i.id]);

            return (
              <div className="space-y-3">
                {/* Warning for pending items */}
                {pendingItems.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                    <p className="text-sm text-yellow-800 font-medium">
                      {pendingItems.length} item(s) still have &quot;Pending&quot; disposition
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      Set a disposition for all items before completing.
                    </p>
                  </div>
                )}

                {/* Warning for missing locations */}
                {missingLocs.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-sm text-red-800 font-medium">
                      {missingLocs.length} restock item(s) need a location
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                      {missingLocs.map((i) => i.product?.name || i.product?.sku).join(", ")}
                    </p>
                  </div>
                )}

                {/* Restock impact */}
                {restockItems.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-3">
                    <h4 className="text-sm font-medium text-green-800 flex items-center gap-1 mb-2">
                      <ArrowRight className="w-4 h-4" />
                      Restocking to Inventory ({restockItems.length} item{restockItems.length > 1 ? "s" : ""})
                    </h4>
                    <div className="space-y-1">
                      {restockItems.map((item) => {
                        const loc = locations.find((l) => l.id === restockLocations[item.id]);
                        return (
                          <div key={item.id} className="text-xs text-green-700 flex items-center gap-1">
                            <span className="font-medium">{item.product?.sku}</span>
                            <span>+{item.qty_received} units</span>
                            {loc && (
                              <>
                                <ArrowRight className="w-3 h-3" />
                                <span>{loc.name}</span>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Discard summary */}
                {discardItems.length > 0 && (
                  <div className="bg-red-50 border border-red-100 rounded-md p-3">
                    <h4 className="text-sm font-medium text-red-800 mb-1">
                      Discarding ({discardItems.reduce((s, i) => s + (i.qty_received || 0), 0)} units)
                    </h4>
                    <p className="text-xs text-red-700">
                      {discardItems.map((i) => `${i.product?.sku} x${i.qty_received}`).join(", ")}
                    </p>
                  </div>
                )}

                {/* Return to vendor summary */}
                {vendorItems.length > 0 && (
                  <div className="bg-blue-50 border border-blue-100 rounded-md p-3">
                    <h4 className="text-sm font-medium text-blue-800 mb-1">
                      Return to Vendor ({vendorItems.reduce((s, i) => s + (i.qty_received || 0), 0)} units)
                    </h4>
                    <p className="text-xs text-blue-700">
                      {vendorItems.map((i) => `${i.product?.sku} x${i.qty_received}`).join(", ")}
                    </p>
                  </div>
                )}

                {/* Total summary */}
                <div className="bg-gray-50 rounded-md p-3">
                  <div className="grid grid-cols-2 gap-1 text-sm">
                    <div className="text-gray-500">Total Received:</div>
                    <div className="font-medium">
                      {returnData.items.reduce((sum, i) => sum + (i.qty_received || 0), 0)} units
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Credit Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                $
              </span>
              <input
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                min={0}
                step={0.01}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Enter the credit amount to issue to the client (leave empty for no credit)
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowCompleteModal(false)}
              disabled={updating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleComplete}
              disabled={
                updating ||
                (returnData?.items.some((i) => i.disposition === "pending") ?? false) ||
                (returnData?.items
                  .filter((i) => i.disposition === "restock" && (i.qty_received || 0) > 0)
                  .some((i) => !restockLocations[i.id]) ?? false)
              }
            >
              {updating ? "Completing..." : "Complete Return"}
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
