"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Clock,
  CheckCircle,
  XCircle,
  Package,
  FileText,
  CreditCard,
  MapPin,
  Printer,
  Copy,
  AlertTriangle,
  Truck,
} from "lucide-react";
import { useClient } from "@/lib/client-auth";
import Card from "@/components/ui/Card";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Table from "@/components/ui/Table";
import FetchError from "@/components/ui/FetchError";
import { handleApiError } from "@/lib/utils/error-handler";
import {
  getMyReturn,
  getReturnReasons,
  PortalReturnWithItems,
  PortalReturnItem,
  ReturnReason,
} from "@/lib/api/portal-returns";

export default function PortalReturnDetailPage() {
  const params = useParams();
  const { client } = useClient();
  const [returnData, setReturnData] = useState<PortalReturnWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reasons] = useState<ReturnReason[]>(getReturnReasons());

  const returnId = params.id as string;

  const fetchReturn = useCallback(async () => {
    if (!client || !returnId) return;

    setLoading(true);
    setError(null);

    try {
      // Security: getMyReturn verifies return belongs to this client
      const data = await getMyReturn(client.id, returnId);
      if (!data) {
        setError("Return not found or you don't have permission to view it");
      } else {
        setReturnData(data);
      }
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  }, [client, returnId]);

  useEffect(() => {
    fetchReturn();
  }, [fetchReturn]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "\u2014";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "\u2014";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getReasonLabel = (reason: string | null) => {
    if (!reason) return "\u2014";
    const reasonObj = reasons.find((r) => r.value === reason);
    return reasonObj?.label || reason;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "requested":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
            <Clock className="w-4 h-4" />
            Requested
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Approved
          </span>
        );
      case "received":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
            <Package className="w-4 h-4" />
            Received
          </span>
        );
      case "processed":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Processed
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-medium">
            <XCircle className="w-4 h-4" />
            Rejected
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full text-sm font-medium">
            <XCircle className="w-4 h-4" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full text-sm font-medium capitalize">
            {status}
          </span>
        );
    }
  };

  const returnItemColumns = [
    {
      key: "product",
      header: "Product",
      mobilePriority: 1 as const,
      render: (item: PortalReturnItem) => (
        <div>
          <p className="font-medium text-slate-900">{item.product_sku}</p>
          <p className="text-sm text-slate-500">{item.product_name}</p>
        </div>
      ),
    },
    {
      key: "qty_requested",
      header: "Qty Requested",
      align: "right" as const,
      mobilePriority: 3 as const,
      render: (item: PortalReturnItem) => (
        <span className="text-slate-900">{item.qty_requested}</span>
      ),
    },
    {
      key: "qty_received",
      header: "Qty Received",
      align: "right" as const,
      mobilePriority: 3 as const,
      render: (item: PortalReturnItem) => (
        <span className="text-slate-600">
          {item.qty_received !== null ? item.qty_received : "\u2014"}
        </span>
      ),
    },
    {
      key: "condition",
      header: "Condition",
      align: "center" as const,
      mobilePriority: 2 as const,
      render: (item: PortalReturnItem) => (
        <span className="text-slate-600 capitalize">
          {item.condition || "\u2014"}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !returnData) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          homeHref="/portal"
          items={[
            { label: "Returns", href: "/portal/returns" },
            { label: "Error" },
          ]}
        />

        <Card>
          <FetchError
            message={error || "Return not found"}
            onRetry={fetchReturn}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs
        homeHref="/portal"
        items={[
          { label: "Returns", href: "/portal/returns" },
          { label: returnData.return_number },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Return {returnData.return_number}
          </h1>
          <p className="text-slate-500 mt-1">
            Requested {formatDate(returnData.requested_at || returnData.created_at)}
          </p>
        </div>
        {getStatusBadge(returnData.status)}
      </div>

      {/* Status Timeline */}
      <Card>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Return Progress
        </h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-0">
          {/* Requested */}
          <div className="flex items-center gap-3 sm:flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                returnData.requested_at
                  ? "bg-green-100 text-green-600"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              <Clock className="w-4 h-4" />
            </div>
            <div className="sm:hidden">
              <p className="font-medium text-slate-900">Requested</p>
              <p className="text-xs text-slate-500">
                {formatDate(returnData.requested_at)}
              </p>
            </div>
          </div>
          <div className="hidden sm:block flex-1 h-1 bg-slate-200 mx-2">
            <div
              className={`h-full ${
                returnData.approved_at ? "bg-green-500" : "bg-slate-200"
              }`}
            />
          </div>

          {/* Approved */}
          <div className="flex items-center gap-3 sm:flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                returnData.approved_at
                  ? "bg-green-100 text-green-600"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              <CheckCircle className="w-4 h-4" />
            </div>
            <div className="sm:hidden">
              <p className="font-medium text-slate-900">Approved</p>
              <p className="text-xs text-slate-500">
                {returnData.approved_at ? formatDate(returnData.approved_at) : "Pending"}
              </p>
            </div>
          </div>
          <div className="hidden sm:block flex-1 h-1 bg-slate-200 mx-2">
            <div
              className={`h-full ${
                returnData.received_at ? "bg-green-500" : "bg-slate-200"
              }`}
            />
          </div>

          {/* Received */}
          <div className="flex items-center gap-3 sm:flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                returnData.received_at
                  ? "bg-green-100 text-green-600"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              <Package className="w-4 h-4" />
            </div>
            <div className="sm:hidden">
              <p className="font-medium text-slate-900">Received</p>
              <p className="text-xs text-slate-500">
                {returnData.received_at ? formatDate(returnData.received_at) : "Pending"}
              </p>
            </div>
          </div>
          <div className="hidden sm:block flex-1 h-1 bg-slate-200 mx-2">
            <div
              className={`h-full ${
                returnData.processed_at ? "bg-green-500" : "bg-slate-200"
              }`}
            />
          </div>

          {/* Processed */}
          <div className="flex items-center gap-3 sm:flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                returnData.processed_at
                  ? "bg-green-100 text-green-600"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              <CreditCard className="w-4 h-4" />
            </div>
            <div className="sm:hidden">
              <p className="font-medium text-slate-900">Processed</p>
              <p className="text-xs text-slate-500">
                {returnData.processed_at ? formatDate(returnData.processed_at) : "Pending"}
              </p>
            </div>
          </div>
        </div>

        {/* Desktop Labels */}
        <div className="hidden sm:flex mt-2">
          <div className="flex-1 text-center">
            <p className="text-sm font-medium text-slate-900">Requested</p>
            <p className="text-xs text-slate-500">
              {formatDate(returnData.requested_at)}
            </p>
          </div>
          <div className="flex-1" />
          <div className="flex-1 text-center">
            <p className="text-sm font-medium text-slate-900">Approved</p>
            <p className="text-xs text-slate-500">
              {returnData.approved_at ? formatDate(returnData.approved_at) : "\u2014"}
            </p>
          </div>
          <div className="flex-1" />
          <div className="flex-1 text-center">
            <p className="text-sm font-medium text-slate-900">Received</p>
            <p className="text-xs text-slate-500">
              {returnData.received_at ? formatDate(returnData.received_at) : "\u2014"}
            </p>
          </div>
          <div className="flex-1" />
          <div className="flex-1 text-center">
            <p className="text-sm font-medium text-slate-900">Processed</p>
            <p className="text-xs text-slate-500">
              {returnData.processed_at ? formatDate(returnData.processed_at) : "\u2014"}
            </p>
          </div>
        </div>
      </Card>

      {/* Return Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-100 rounded-lg">
              <FileText className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Reason</p>
              <p className="font-medium text-slate-900">
                {getReasonLabel(returnData.reason)}
              </p>
            </div>
          </div>
          {returnData.reason_details && (
            <p className="mt-3 text-sm text-slate-600 pl-12">
              {returnData.reason_details}
            </p>
          )}
        </Card>

        {returnData.original_order && (
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Package className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Original Order</p>
                <a
                  href={`/portal/orders/${returnData.original_order.id}`}
                  className="font-medium text-cyan-600 hover:text-cyan-700"
                >
                  {returnData.original_order.order_number}
                </a>
              </div>
            </div>
          </Card>
        )}

        {returnData.status === "processed" && returnData.credit_amount && (
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CreditCard className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Credit Issued</p>
                <p className="font-medium text-green-600 text-lg">
                  {formatCurrency(returnData.credit_amount)}
                </p>
              </div>
            </div>
          </Card>
        )}

      </div>

      {/* Approved - Shipping Instructions & RMA */}
      {returnData.status === "approved" && (
        <div className="space-y-4">
          {/* RMA Label */}
          <Card className="bg-cyan-50 border-cyan-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-cyan-600 rounded-xl">
                  <Truck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-cyan-600 font-medium">Your RMA Number</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {returnData.return_number}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(returnData.return_number);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-cyan-200 text-cyan-700 rounded-lg hover:bg-cyan-50 transition-colors text-sm font-medium"
                >
                  <Copy className="w-4 h-4" />
                  Copy RMA
                </button>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm font-medium"
                >
                  <Printer className="w-4 h-4" />
                  Print Label
                </button>
              </div>
            </div>
          </Card>

          {/* Shipping Instructions */}
          <Card>
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan-600" />
              Shipping Instructions
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Ship To Address */}
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm font-medium text-slate-500 mb-2">Ship To:</p>
                <p className="font-semibold text-slate-900">7 Degrees Co - Returns</p>
                <p className="text-slate-700">Attn: RMA {returnData.return_number}</p>
                <p className="text-slate-700">1234 Warehouse Drive</p>
                <p className="text-slate-700">Suite 100</p>
                <p className="text-slate-700">Dallas, TX 75001</p>
              </div>

              {/* Important Notes */}
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-700">
                    Write the RMA number clearly on the outside of your package
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-700">
                    Include a copy of this return inside the package
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-700">
                    Pack items securely to prevent damage during transit
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-700">
                    Ship within 14 days of approval to ensure credit
                  </p>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">Important</p>
                <p className="text-sm text-yellow-700">
                  Returns without a valid RMA number may be refused or delayed.
                  Credit will be issued after items are received and inspected.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Return Items */}
      <Card>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Return Items
        </h2>

        <Table<PortalReturnItem>
          columns={returnItemColumns}
          data={returnData.items || []}
          emptyMessage="No items in this return"
          emptyIcon={<Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />}
        />
      </Card>

      {/* Notes */}
      {returnData.notes && (
        <Card>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Notes</h2>
          <p className="text-slate-600">{returnData.notes}</p>
        </Card>
      )}

      {/* Help Card */}
      {returnData.status === "requested" && (
        <Card className="bg-yellow-50 border-yellow-100">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <h3 className="font-medium text-slate-900">Pending Review</h3>
              <p className="text-sm text-slate-600 mt-1">
                Your return request is being reviewed by the 7 Degrees team.
                You&apos;ll receive an update once it&apos;s approved.
              </p>
              <a
                href="/portal/messages"
                className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-yellow-700 hover:text-yellow-800"
              >
                Questions? Contact Us
                <span aria-hidden="true">&rarr;</span>
              </a>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
