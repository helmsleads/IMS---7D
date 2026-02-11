"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  Package,
  RotateCcw,
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
import {
  getMyReturn,
  getReturnReasons,
  PortalReturnWithItems,
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

  useEffect(() => {
    const fetchReturn = async () => {
      if (!client || !returnId) return;

      try {
        // Security: getMyReturn verifies return belongs to this client
        const data = await getMyReturn(client.id, returnId);
        if (!data) {
          setError("Return not found or you don't have permission to view it");
        } else {
          setReturnData(data);
        }
      } catch (err) {
        console.error("Failed to fetch return:", err);
        setError("Failed to load return details");
      } finally {
        setLoading(false);
      }
    };

    fetchReturn();
  }, [client, returnId]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getReasonLabel = (reason: string | null) => {
    if (!reason) return "—";
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
            <XCircle className="w-4 h-4" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium capitalize">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !returnData) {
    return (
      <div className="space-y-6">
        <a
          href="/portal/returns"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Returns
        </a>

        <Card>
          <div className="text-center py-12 text-gray-500">
            <RotateCcw className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">{error || "Return not found"}</p>
            <a
              href="/portal/returns"
              className="text-blue-600 hover:underline text-sm mt-2 inline-block"
            >
              Return to returns list
            </a>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <a
        href="/portal/returns"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Returns
      </a>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Return {returnData.return_number}
          </h1>
          <p className="text-gray-500 mt-1">
            Requested {formatDate(returnData.requested_at || returnData.created_at)}
          </p>
        </div>
        {getStatusBadge(returnData.status)}
      </div>

      {/* Status Timeline */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Return Progress
        </h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-0">
          {/* Requested */}
          <div className="flex items-center gap-3 sm:flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                returnData.requested_at
                  ? "bg-green-100 text-green-600"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              <Clock className="w-4 h-4" />
            </div>
            <div className="sm:hidden">
              <p className="font-medium text-gray-900">Requested</p>
              <p className="text-xs text-gray-500">
                {formatDate(returnData.requested_at)}
              </p>
            </div>
          </div>
          <div className="hidden sm:block flex-1 h-1 bg-gray-200 mx-2">
            <div
              className={`h-full ${
                returnData.approved_at ? "bg-green-500" : "bg-gray-200"
              }`}
            />
          </div>

          {/* Approved */}
          <div className="flex items-center gap-3 sm:flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                returnData.approved_at
                  ? "bg-green-100 text-green-600"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              <CheckCircle className="w-4 h-4" />
            </div>
            <div className="sm:hidden">
              <p className="font-medium text-gray-900">Approved</p>
              <p className="text-xs text-gray-500">
                {returnData.approved_at ? formatDate(returnData.approved_at) : "Pending"}
              </p>
            </div>
          </div>
          <div className="hidden sm:block flex-1 h-1 bg-gray-200 mx-2">
            <div
              className={`h-full ${
                returnData.received_at ? "bg-green-500" : "bg-gray-200"
              }`}
            />
          </div>

          {/* Received */}
          <div className="flex items-center gap-3 sm:flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                returnData.received_at
                  ? "bg-green-100 text-green-600"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              <Package className="w-4 h-4" />
            </div>
            <div className="sm:hidden">
              <p className="font-medium text-gray-900">Received</p>
              <p className="text-xs text-gray-500">
                {returnData.received_at ? formatDate(returnData.received_at) : "Pending"}
              </p>
            </div>
          </div>
          <div className="hidden sm:block flex-1 h-1 bg-gray-200 mx-2">
            <div
              className={`h-full ${
                returnData.processed_at ? "bg-green-500" : "bg-gray-200"
              }`}
            />
          </div>

          {/* Processed */}
          <div className="flex items-center gap-3 sm:flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                returnData.processed_at
                  ? "bg-green-100 text-green-600"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              <CreditCard className="w-4 h-4" />
            </div>
            <div className="sm:hidden">
              <p className="font-medium text-gray-900">Processed</p>
              <p className="text-xs text-gray-500">
                {returnData.processed_at ? formatDate(returnData.processed_at) : "Pending"}
              </p>
            </div>
          </div>
        </div>

        {/* Desktop Labels */}
        <div className="hidden sm:flex mt-2">
          <div className="flex-1 text-center">
            <p className="text-sm font-medium text-gray-900">Requested</p>
            <p className="text-xs text-gray-500">
              {formatDate(returnData.requested_at)}
            </p>
          </div>
          <div className="flex-1" />
          <div className="flex-1 text-center">
            <p className="text-sm font-medium text-gray-900">Approved</p>
            <p className="text-xs text-gray-500">
              {returnData.approved_at ? formatDate(returnData.approved_at) : "—"}
            </p>
          </div>
          <div className="flex-1" />
          <div className="flex-1 text-center">
            <p className="text-sm font-medium text-gray-900">Received</p>
            <p className="text-xs text-gray-500">
              {returnData.received_at ? formatDate(returnData.received_at) : "—"}
            </p>
          </div>
          <div className="flex-1" />
          <div className="flex-1 text-center">
            <p className="text-sm font-medium text-gray-900">Processed</p>
            <p className="text-xs text-gray-500">
              {returnData.processed_at ? formatDate(returnData.processed_at) : "—"}
            </p>
          </div>
        </div>
      </Card>

      {/* Return Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Reason</p>
              <p className="font-medium text-gray-900">
                {getReasonLabel(returnData.reason)}
              </p>
            </div>
          </div>
          {returnData.reason_details && (
            <p className="mt-3 text-sm text-gray-600 pl-12">
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
                <p className="text-sm text-gray-500">Original Order</p>
                <a
                  href={`/portal/orders/${returnData.original_order.id}`}
                  className="font-medium text-blue-600 hover:text-blue-700"
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
                <p className="text-sm text-gray-500">Credit Issued</p>
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
          <Card className="bg-blue-50 border-blue-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-600 rounded-xl">
                  <Truck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-blue-600 font-medium">Your RMA Number</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {returnData.return_number}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(returnData.return_number);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
                >
                  <Copy className="w-4 h-4" />
                  Copy RMA
                </button>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <Printer className="w-4 h-4" />
                  Print Label
                </button>
              </div>
            </div>
          </Card>

          {/* Shipping Instructions */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              Shipping Instructions
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Ship To Address */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-500 mb-2">Ship To:</p>
                <p className="font-semibold text-gray-900">7 Degrees Co - Returns</p>
                <p className="text-gray-700">Attn: RMA {returnData.return_number}</p>
                <p className="text-gray-700">1234 Warehouse Drive</p>
                <p className="text-gray-700">Suite 100</p>
                <p className="text-gray-700">Dallas, TX 75001</p>
              </div>

              {/* Important Notes */}
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-700">
                    Write the RMA number clearly on the outside of your package
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-700">
                    Include a copy of this return inside the package
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-700">
                    Pack items securely to prevent damage during transit
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-700">
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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Return Items
        </h2>

        {returnData.items && returnData.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                    Product
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                    Qty Requested
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                    Qty Received
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">
                    Condition
                  </th>
                </tr>
              </thead>
              <tbody>
                {returnData.items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">
                        {item.product_sku}
                      </p>
                      <p className="text-sm text-gray-500">{item.product_name}</p>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-900">
                      {item.qty_requested}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600">
                      {item.qty_received !== null ? item.qty_received : "—"}
                    </td>
                    <td className="py-3 px-4 text-center text-gray-600 capitalize">
                      {item.condition || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No items in this return</p>
          </div>
        )}
      </Card>

      {/* Notes */}
      {returnData.notes && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-gray-600">{returnData.notes}</p>
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
              <h3 className="font-medium text-gray-900">Pending Review</h3>
              <p className="text-sm text-gray-600 mt-1">
                Your return request is being reviewed by the 7 Degrees team.
                You&apos;ll receive an update once it&apos;s approved.
              </p>
              <a
                href="/portal/messages"
                className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-yellow-700 hover:text-yellow-800"
              >
                Questions? Contact Us
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
