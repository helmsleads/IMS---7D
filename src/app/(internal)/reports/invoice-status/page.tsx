"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import Link from "next/link";
import AppShell from "@/components/internal/AppShell";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Select from "@/components/ui/Select";
import Spinner from "@/components/ui/Spinner";
import FetchError from "@/components/ui/FetchError";
import Badge from "@/components/ui/Badge";
import {
  getInvoiceStatusReport,
  InvoiceStatusItem,
  InvoiceStatusReport,
} from "@/lib/api/dashboard";
import { formatCurrency } from "@/lib/utils/formatting";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "overdue", label: "Overdue" },
];

function getAgingBadge(bucket: string) {
  switch (bucket) {
    case "current":
      return <Badge variant="success">Current</Badge>;
    case "1-30":
      return <Badge variant="info">1-30 days</Badge>;
    case "31-60":
      return <Badge variant="warning">31-60 days</Badge>;
    case "61-90":
      return <Badge variant="error">61-90 days</Badge>;
    case "90+":
      return <Badge variant="error">90+ days</Badge>;
    default:
      return <Badge variant="info">{bucket}</Badge>;
  }
}

export default function InvoiceStatusPage() {
  const [report, setReport] = useState<InvoiceStatusReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInvoiceStatusReport();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <AppShell title="Invoice Status" subtitle="Accounts receivable aging report">
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Invoice Status" subtitle="Accounts receivable aging report">
        <FetchError message={error} onRetry={fetchData} />
      </AppShell>
    );
  }

  const invoices = report?.invoices || [];
  const summary = report?.summary;

  const filtered = invoices.filter((inv) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "overdue") return inv.daysOverdue > 0;
    return inv.status === statusFilter;
  });

  return (
    <AppShell
      title="Invoice Status"
      subtitle="Accounts receivable aging and collections management"
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="text-center">
            <p className="text-3xl font-semibold text-slate-900">
              {formatCurrency(summary?.totalExposure || 0, 0)}
            </p>
            <p className="text-sm text-slate-500">Total Exposure</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-3xl font-semibold text-red-600">
              {formatCurrency(summary?.overdueAmount || 0, 0)}
            </p>
            <p className="text-sm text-slate-500">Overdue Amount</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-3xl font-semibold text-slate-900">
              {summary?.topDebtor?.name || "—"}
            </p>
            <p className="text-sm text-slate-500">
              Top Debtor{summary?.topDebtor ? ` (${formatCurrency(summary.topDebtor.exposure, 0)})` : ""}
            </p>
          </div>
        </Card>
      </div>

      {/* Filter */}
      <div className="mb-4 max-w-xs">
        <Select
          label="Filter by Status"
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        />
      </div>

      {/* Invoice Table */}
      <Card>
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-slate-500">No outstanding invoices found</p>
          </div>
        ) : (
          <Table
            columns={[
              {
                key: "due_date",
                header: "Due Date",
                render: (row: InvoiceStatusItem) => (
                  <span className="text-slate-600">
                    {row.due_date
                      ? new Date(row.due_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </span>
                ),
              },
              {
                key: "clientName",
                header: "Customer",
                render: (row: InvoiceStatusItem) => (
                  <span className="font-medium text-slate-900">{row.clientName}</span>
                ),
              },
              {
                key: "invoice_number",
                header: "Invoice #",
                render: (row: InvoiceStatusItem) => (
                  <Link
                    href={`/billing/${row.id}`}
                    className="text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    {row.invoice_number || "—"}
                  </Link>
                ),
              },
              {
                key: "agingBucket",
                header: "Aging Bucket",
                render: (row: InvoiceStatusItem) => getAgingBadge(row.agingBucket),
              },
              {
                key: "daysOverdue",
                header: "Days Overdue",
                render: (row: InvoiceStatusItem) => (
                  <span className={row.daysOverdue > 0 ? "text-red-600 font-medium" : "text-slate-500"}>
                    {row.daysOverdue > 0 ? row.daysOverdue : "—"}
                  </span>
                ),
              },
              {
                key: "total",
                header: "Amount",
                align: "right",
                render: (row: InvoiceStatusItem) => (
                  <span className="font-medium text-slate-900">
                    {formatCurrency(row.total)}
                  </span>
                ),
              },
            ]}
            data={filtered}
          />
        )}
      </Card>
    </AppShell>
  );
}
