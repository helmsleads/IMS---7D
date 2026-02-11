"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  FileText,
  Calendar,
  Building2,
} from "lucide-react";
import { useClient } from "@/lib/client-auth";
import Card from "@/components/ui/Card";
import { getMyInvoice, PortalInvoiceWithItems } from "@/lib/api/portal-billing";

export default function PortalInvoiceDetailPage() {
  const params = useParams();
  const { client } = useClient();
  const [invoice, setInvoice] = useState<PortalInvoiceWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const invoiceId = params.id as string;

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!client || !invoiceId) return;

      try {
        // Security: getMyInvoice verifies invoice belongs to this client
        const data = await getMyInvoice(client.id, invoiceId);
        if (!data) {
          // Invoice not found or doesn't belong to this client
          setError("Invoice not found or you don't have permission to view it");
        } else {
          setInvoice(data);
        }
      } catch (err) {
        console.error("Failed to fetch invoice:", err);
        setError("Failed to load invoice");
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [client, invoiceId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string, dueDate: string | null) => {
    const today = new Date().toISOString().split("T")[0];
    const isOverdue = status === "sent" && dueDate && dueDate < today;

    if (status === "paid") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
          <CheckCircle className="w-4 h-4" />
          Paid
        </span>
      );
    }

    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-medium">
          <AlertCircle className="w-4 h-4" />
          Overdue
        </span>
      );
    }

    if (status === "sent") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
          <Clock className="w-4 h-4" />
          Payment Due
        </span>
      );
    }

    if (status === "cancelled") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
          <XCircle className="w-4 h-4" />
          Cancelled
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium capitalize">
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="space-y-6">
        <a
          href="/portal/plan"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Plan & Billing
        </a>

        <Card>
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">{error || "Invoice not found"}</p>
            <a
              href="/portal/plan"
              className="text-blue-600 hover:underline text-sm mt-2 inline-block"
            >
              Return to billing
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
        href="/portal/plan"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Plan & Billing
      </a>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Invoice {invoice.invoice_number}
          </h1>
          <p className="text-gray-500 mt-1">
            Billing period: {formatDate(invoice.period_start)} – {formatDate(invoice.period_end)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(invoice.status, invoice.due_date)}
          <a
            href={`/portal/plan/invoice/${invoice.id}/pdf`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </a>
        </div>
      </div>

      {/* Invoice Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Issue Date</p>
              <p className="font-medium text-gray-900">
                {formatDate(invoice.sent_at || invoice.created_at)}
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
              <p className="text-sm text-gray-500">Due Date</p>
              <p className="font-medium text-gray-900">
                {formatDate(invoice.due_date)}
              </p>
            </div>
          </div>
        </Card>

        {invoice.status === "paid" && invoice.paid_at && (
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Paid Date</p>
                <p className="font-medium text-gray-900">
                  {formatDate(invoice.paid_at)}
                </p>
              </div>
            </div>
          </Card>
        )}

        {invoice.status !== "paid" && (
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Building2 className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">From</p>
                <p className="font-medium text-gray-900">7 Degrees Co</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Invoice Items */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Invoice Details
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                  Description
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                  Qty
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                  Unit Price
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.items && invoice.items.length > 0 ? (
                invoice.items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="py-3 px-4 text-gray-900">
                      {item.description}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600">
                      {item.quantity}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900">
                      {formatCurrency(item.total)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-500">
                    No line items
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex flex-col items-end space-y-2">
            <div className="flex justify-between w-full max-w-xs">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-900">{formatCurrency(invoice.subtotal)}</span>
            </div>
            {invoice.tax_rate > 0 && (
              <div className="flex justify-between w-full max-w-xs">
                <span className="text-gray-500">Tax ({invoice.tax_rate}%)</span>
                <span className="text-gray-900">{formatCurrency(invoice.tax_amount)}</span>
              </div>
            )}
            <div className="flex justify-between w-full max-w-xs pt-2 border-t border-gray-200">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="font-bold text-xl text-gray-900">
                {formatCurrency(invoice.total)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Payment Note */}
      {invoice.status === "sent" && (
        <Card className="bg-blue-50 border-blue-100">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Payment Information</h3>
              <p className="text-sm text-gray-600 mt-1">
                Please contact 7 Degrees for payment instructions or if you have
                any questions about this invoice.
              </p>
              <a
                href="/portal/messages"
                className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Contact Us
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
