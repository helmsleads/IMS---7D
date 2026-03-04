"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Download,
  Eye,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Receipt,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { useClient } from "@/lib/client-auth";
import Card from "@/components/ui/Card";
import {
  getMyInvoices,
  getMyInvoiceSummary,
  PortalInvoice,
  InvoiceSummary,
} from "@/lib/api/portal-billing";

export default function PortalBillingPage() {
  const { client } = useClient();
  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!client) return;

      try {
        const [invoicesData, summaryData] = await Promise.all([
          getMyInvoices(client.id),
          getMyInvoiceSummary(client.id),
        ]);

        setInvoices(invoicesData);
        setSummary(summaryData);
      } catch (error) {
        console.error("Failed to fetch billing data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [client]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "\u2014";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string, dueDate: string | null) => {
    const today = new Date().toISOString().split("T")[0];
    const isOverdue = status === "sent" && dueDate && dueDate < today;

    if (status === "paid") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
          <CheckCircle className="w-3 h-3" />
          Paid
        </span>
      );
    }

    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
          <AlertCircle className="w-3 h-3" />
          Overdue
        </span>
      );
    }

    if (status === "sent") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
          <Clock className="w-3 h-3" />
          Due
        </span>
      );
    }

    if (status === "cancelled") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
          <XCircle className="w-3 h-3" />
          Cancelled
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium capitalize">
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
        <p className="text-slate-500 mt-1">
          View your invoices and payment history
        </p>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <Receipt className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Invoices</p>
                <p className="text-2xl font-bold text-slate-900">
                  {summary.totalInvoices}
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
                <p className="text-sm text-slate-500">Total Paid</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(summary.totalPaid)}
                </p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Outstanding</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(summary.totalOutstanding)}
                </p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${summary.overdueCount > 0 ? "bg-red-100" : "bg-slate-100"}`}>
                <TrendingUp className={`w-5 h-5 ${summary.overdueCount > 0 ? "text-red-600" : "text-slate-600"}`} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Overdue</p>
                <p className={`text-2xl font-bold ${summary.overdueCount > 0 ? "text-red-600" : "text-slate-900"}`}>
                  {summary.overdueCount > 0
                    ? formatCurrency(summary.overdueAmount)
                    : "$0.00"}
                </p>
                {summary.overdueCount > 0 && (
                  <p className="text-xs text-red-500">
                    {summary.overdueCount} invoice{summary.overdueCount !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Invoice List */}
      <Card>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Invoice History
        </h2>

        {invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">
                    Invoice
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">
                    Period
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">
                    Due Date
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">
                    Amount
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-slate-500">
                    Status
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">
                        {invoice.invoice_number}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">
                      {formatDate(invoice.period_start)} -{" "}
                      {formatDate(invoice.period_end)}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">
                      {formatDate(invoice.due_date)}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900">
                      {formatCurrency(invoice.total)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {getStatusBadge(invoice.status, invoice.due_date)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/portal/plan/invoice/${invoice.id}`}
                          className="inline-flex items-center gap-1 text-sm text-cyan-600 hover:text-cyan-700 font-medium"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Link>
                        <Link
                          href={`/portal/plan/invoice/${invoice.id}/pdf`}
                          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-700 font-medium"
                        >
                          <Download className="w-4 h-4" />
                          PDF
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No invoices yet</p>
            <p className="text-sm mt-1">
              Invoices will appear here once generated
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
