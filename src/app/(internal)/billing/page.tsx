"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Plus, Send, CheckCircle, Eye, Search, Edit, DollarSign, AlertTriangle, Clock } from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import Alert from "@/components/ui/Alert";
import FetchError from "@/components/ui/FetchError";
import Pagination from "@/components/ui/Pagination";
import { useRouter } from "next/navigation";
import {
  getInvoices,
  sendInvoice,
  markInvoicePaid,
  generateInvoiceFromUsage,
  updateInvoice,
  createInvoice,
  generateInvoiceNumber,
  getUsageRecords,
  InvoiceWithItems,
} from "@/lib/api/invoices";
import { getClients, Client } from "@/lib/api/clients";
import { InvoiceStatus, UsageRecord } from "@/types/database";
import { handleApiError } from "@/lib/utils/error-handler";

const ITEMS_PER_PAGE = 25;

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
};

const formatDate = (date: string | null) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const statusColors: Record<InvoiceStatus, "default" | "warning" | "success" | "error"> = {
  draft: "default",
  sent: "warning",
  paid: "success",
  overdue: "error",
  cancelled: "default",
};

const statusOptions = [
  { value: "", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
];

type TabType = "invoices" | "usage";

export default function BillingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("invoices");
  const [invoices, setInvoices] = useState<InvoiceWithItems[]>([]);
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [usageCurrentPage, setUsageCurrentPage] = useState(1);
  const [successMessage, setSuccessMessage] = useState("");

  // Invoice Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Usage Filters
  const [usageClientFilter, setUsageClientFilter] = useState("");
  const [usageInvoicedFilter, setUsageInvoicedFilter] = useState("");
  const [usageStartDate, setUsageStartDate] = useState("");
  const [usageEndDate, setUsageEndDate] = useState("");

  // Modals
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceWithItems | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceWithItems | null>(null);
  const [generating, setGenerating] = useState(false);

  // Generate invoice form
  const [generateClientId, setGenerateClientId] = useState("");
  const [generatePeriodStart, setGeneratePeriodStart] = useState("");
  const [generatePeriodEnd, setGeneratePeriodEnd] = useState("");
  const [includeUsage, setIncludeUsage] = useState(true);
  const [includeSupplies, setIncludeSupplies] = useState(false);
  const [generateTaxRate, setGenerateTaxRate] = useState("0");
  const [generateNotes, setGenerateNotes] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [invoicesData, clientsData, usageData] = await Promise.all([
        getInvoices({
          clientId: selectedClient || undefined,
          status: (selectedStatus as InvoiceStatus) || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
        getClients(),
        getUsageRecords({
          clientId: usageClientFilter || undefined,
          invoiced: usageInvoicedFilter === "" ? undefined : usageInvoicedFilter === "true",
          startDate: usageStartDate || undefined,
          endDate: usageEndDate || undefined,
        }),
      ]);
      setInvoices(invoicesData);
      setClients(clientsData);
      setUsageRecords(usageData);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClient, selectedStatus, startDate, endDate, usageClientFilter, usageInvoicedFilter, usageStartDate, usageEndDate]);

  const handleSendInvoice = async (invoice: InvoiceWithItems) => {
    try {
      await sendInvoice(invoice.id);
      await fetchData();
      setSuccessMessage("Invoice sent successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const handleMarkPaid = async (invoice: InvoiceWithItems) => {
    try {
      await markInvoicePaid(invoice.id);
      await fetchData();
      setSuccessMessage("Invoice marked as paid");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const handleGenerateInvoice = async () => {
    if (!generateClientId || !generatePeriodStart || !generatePeriodEnd) {
      return;
    }

    setGenerating(true);
    try {
      let invoiceId: string;
      const taxRate = parseFloat(generateTaxRate) || 0;

      if (includeUsage) {
        // Generate invoice from usage records
        const invoice = await generateInvoiceFromUsage(generateClientId, generatePeriodStart, generatePeriodEnd);
        invoiceId = invoice.id;

        // Update with tax rate and notes if provided
        if (taxRate > 0 || generateNotes) {
          const taxAmount = invoice.subtotal * (taxRate / 100);
          const total = invoice.subtotal + taxAmount;
          await updateInvoice(invoiceId, {
            tax_rate: taxRate,
            tax_amount: taxAmount,
            total: total,
            notes: generateNotes || null,
          });
        }
      } else {
        // Create blank draft invoice
        const invoiceNumber = await generateInvoiceNumber();
        const invoice = await createInvoice({
          client_id: generateClientId,
          invoice_number: invoiceNumber,
          period_start: generatePeriodStart,
          period_end: generatePeriodEnd,
          subtotal: 0,
          tax_rate: taxRate,
          tax_amount: 0,
          total: 0,
          status: "draft",
          notes: generateNotes || null,
        });
        invoiceId = invoice.id;
      }

      // Reset form
      setShowGenerateModal(false);
      setGenerateClientId("");
      setGeneratePeriodStart("");
      setGeneratePeriodEnd("");
      setIncludeUsage(true);
      setIncludeSupplies(false);
      setGenerateTaxRate("0");
      setGenerateNotes("");

      // Redirect to invoice detail page for review
      router.push(`/billing/${invoiceId}`);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setGenerating(false);
    }
  };

  const clientOptions = useMemo(() => {
    return [
      { value: "", label: "All Clients" },
      ...clients.map((client) => ({
        value: client.id,
        label: client.company_name,
      })),
    ];
  }, [clients]);

  // Summary calculations
  const summaryStats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Total outstanding = sent + overdue invoices
    const totalOutstanding = invoices
      .filter((inv) => inv.status === "sent" || inv.status === "overdue")
      .reduce((sum, inv) => sum + inv.total, 0);

    // Total overdue
    const totalOverdue = invoices
      .filter((inv) => inv.status === "overdue")
      .reduce((sum, inv) => sum + inv.total, 0);

    // Paid this month - check paid_at or updated_at if status is paid
    const paidThisMonth = invoices
      .filter((inv) => {
        if (inv.status !== "paid") return false;
        const paidDate = new Date(inv.updated_at);
        return paidDate >= startOfMonth;
      })
      .reduce((sum, inv) => sum + inv.total, 0);

    return {
      totalOutstanding,
      totalOverdue,
      paidThisMonth,
    };
  }, [invoices]);

  const columns = [
    {
      key: "invoice_number",
      header: "Invoice #",
      render: (invoice: InvoiceWithItems) => (
        <button
          onClick={() => setViewingInvoice(invoice)}
          className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
          {invoice.invoice_number}
        </button>
      ),
    },
    {
      key: "client",
      header: "Client",
      render: (invoice: InvoiceWithItems) => {
        const client = Array.isArray(invoice.client) ? invoice.client[0] : invoice.client;
        return client?.company_name || "-";
      },
    },
    {
      key: "period",
      header: "Period",
      render: (invoice: InvoiceWithItems) => (
        <span className="text-sm text-gray-500">
          {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      render: (invoice: InvoiceWithItems) => (
        <span className="font-medium">{formatCurrency(invoice.total)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (invoice: InvoiceWithItems) => (
        <Badge variant={statusColors[invoice.status]}>{invoice.status}</Badge>
      ),
    },
    {
      key: "due_date",
      header: "Due Date",
      render: (invoice: InvoiceWithItems) => formatDate(invoice.due_date),
    },
    {
      key: "actions",
      header: "Actions",
      render: (invoice: InvoiceWithItems) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setViewingInvoice(invoice);
            }}
            className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
            title="View"
          >
            <Eye className="w-4 h-4" />
          </button>
          {invoice.status === "draft" && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingInvoice(invoice);
                }}
                className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                title="Edit"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSendInvoice(invoice);
                }}
                className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                title="Send"
              >
                <Send className="w-4 h-4" />
              </button>
            </>
          )}
          {(invoice.status === "sent" || invoice.status === "overdue") && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMarkPaid(invoice);
              }}
              className="p-1 text-gray-500 hover:text-green-600 transition-colors"
              title="Mark Paid"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  // Filter invoices by search term (client-side)
  const filteredInvoices = useMemo(() => {
    if (!searchTerm) return invoices;
    const search = searchTerm.toLowerCase();
    return invoices.filter((invoice) =>
      invoice.invoice_number.toLowerCase().includes(search)
    );
  }, [invoices, searchTerm]);

  // Pagination
  const paginatedInvoices = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredInvoices.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredInvoices, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClient, selectedStatus, startDate, endDate, searchTerm]);

  if (!loading && invoices.length === 0 && !selectedClient && !selectedStatus && !startDate && !endDate && !searchTerm) {
    return (
      <AppShell
        title="Billing"
        subtitle="Invoices and usage tracking"
        actions={
          <Button onClick={() => setShowGenerateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Generate Invoice
          </Button>
        }
      >
        <Card>
          <EmptyState
            icon={<FileText className="w-12 h-12" />}
            title="No invoices yet"
            description="Generate your first invoice from client usage"
            action={
              <Button onClick={() => setShowGenerateModal(true)}>
                Generate Invoice
              </Button>
            }
          />
        </Card>
        <Modal
          isOpen={showGenerateModal}
          onClose={() => setShowGenerateModal(false)}
          title="Generate Invoice"
          size="md"
        >
          <GenerateInvoiceForm
            clients={clients}
            clientId={generateClientId}
            periodStart={generatePeriodStart}
            periodEnd={generatePeriodEnd}
            includeUsage={includeUsage}
            includeSupplies={includeSupplies}
            taxRate={generateTaxRate}
            notes={generateNotes}
            onClientChange={setGenerateClientId}
            onPeriodStartChange={setGeneratePeriodStart}
            onPeriodEndChange={setGeneratePeriodEnd}
            onIncludeUsageChange={setIncludeUsage}
            onIncludeSuppliesChange={setIncludeSupplies}
            onTaxRateChange={setGenerateTaxRate}
            onNotesChange={setGenerateNotes}
            onGenerate={handleGenerateInvoice}
            onCancel={() => setShowGenerateModal(false)}
            generating={generating}
          />
        </Modal>
      </AppShell>
    );
  }

  if (error && invoices.length === 0) {
    return (
      <AppShell title="Billing" subtitle="Invoices and usage tracking">
        <FetchError message={error} onRetry={fetchData} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Billing"
      subtitle="Invoices and usage tracking"
      actions={
        <Button onClick={() => setShowGenerateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Generate Invoice
        </Button>
      }
    >
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

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Outstanding</p>
              <p className="text-xl font-semibold text-gray-900">
                {formatCurrency(summaryStats.totalOutstanding)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Overdue</p>
              <p className="text-xl font-semibold text-red-600">
                {formatCurrency(summaryStats.totalOverdue)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Clock className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Paid This Month</p>
              <p className="text-xl font-semibold text-green-600">
                {formatCurrency(summaryStats.paidThisMonth)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("invoices")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === "invoices"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            Invoices
          </button>
          <button
            onClick={() => setActiveTab("usage")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === "usage"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            Usage Records
          </button>
        </nav>
      </div>

      {/* Invoices Tab */}
      {activeTab === "invoices" && (
        <>
          {/* Filters */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search invoice #..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <Select
          name="client"
          options={clientOptions}
          value={selectedClient}
          onChange={(e) => setSelectedClient(e.target.value)}
          placeholder="All Clients"
        />
        <Select
          name="status"
          options={statusOptions}
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        />
        <div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            title="Period Start"
          />
        </div>
        <div>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            title="Period End"
          />
        </div>
      </div>

      <Card padding="none">
        <Table
          columns={columns}
          data={paginatedInvoices}
          loading={loading}
          emptyMessage="No invoices found"
        />
        <Pagination
          currentPage={currentPage}
          totalItems={filteredInvoices.length}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
        />
      </Card>
        </>
      )}

      {/* Usage Records Tab */}
      {activeTab === "usage" && (
        <UsageRecordsTab
          usageRecords={usageRecords}
          clients={clients}
          invoices={invoices}
          clientFilter={usageClientFilter}
          invoicedFilter={usageInvoicedFilter}
          startDate={usageStartDate}
          endDate={usageEndDate}
          onClientFilterChange={setUsageClientFilter}
          onInvoicedFilterChange={setUsageInvoicedFilter}
          onStartDateChange={setUsageStartDate}
          onEndDateChange={setUsageEndDate}
          currentPage={usageCurrentPage}
          onPageChange={setUsageCurrentPage}
          loading={loading}
        />
      )}

      {/* Generate Invoice Modal */}
      <Modal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        title="Generate Invoice"
        size="md"
      >
        <GenerateInvoiceForm
          clients={clients}
          clientId={generateClientId}
          periodStart={generatePeriodStart}
          periodEnd={generatePeriodEnd}
          includeUsage={includeUsage}
          includeSupplies={includeSupplies}
          taxRate={generateTaxRate}
          notes={generateNotes}
          onClientChange={setGenerateClientId}
          onPeriodStartChange={setGeneratePeriodStart}
          onPeriodEndChange={setGeneratePeriodEnd}
          onIncludeUsageChange={setIncludeUsage}
          onIncludeSuppliesChange={setIncludeSupplies}
          onTaxRateChange={setGenerateTaxRate}
          onNotesChange={setGenerateNotes}
          onGenerate={handleGenerateInvoice}
          onCancel={() => setShowGenerateModal(false)}
          generating={generating}
        />
      </Modal>

      {/* View Invoice Modal */}
      <Modal
        isOpen={!!viewingInvoice}
        onClose={() => setViewingInvoice(null)}
        title={viewingInvoice ? `Invoice ${viewingInvoice.invoice_number}` : "Invoice Details"}
        size="lg"
      >
        {viewingInvoice && <InvoiceDetails invoice={viewingInvoice} />}
      </Modal>

      {/* Edit Invoice Modal */}
      <Modal
        isOpen={!!editingInvoice}
        onClose={() => setEditingInvoice(null)}
        title={editingInvoice ? `Edit Invoice ${editingInvoice.invoice_number}` : "Edit Invoice"}
        size="lg"
      >
        {editingInvoice && (
          <InvoiceDetails
            invoice={editingInvoice}
            isEditing
            onClose={() => setEditingInvoice(null)}
            onSave={async () => {
              await fetchData();
              setEditingInvoice(null);
              setSuccessMessage("Invoice updated successfully");
              setTimeout(() => setSuccessMessage(""), 3000);
            }}
          />
        )}
      </Modal>
    </AppShell>
  );
}

interface GenerateInvoiceFormProps {
  clients: Client[];
  clientId: string;
  periodStart: string;
  periodEnd: string;
  includeUsage: boolean;
  includeSupplies: boolean;
  taxRate: string;
  notes: string;
  onClientChange: (value: string) => void;
  onPeriodStartChange: (value: string) => void;
  onPeriodEndChange: (value: string) => void;
  onIncludeUsageChange: (checked: boolean) => void;
  onIncludeSuppliesChange: (checked: boolean) => void;
  onTaxRateChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onGenerate: () => void;
  onCancel: () => void;
  generating: boolean;
}

function GenerateInvoiceForm({
  clients,
  clientId,
  periodStart,
  periodEnd,
  includeUsage,
  includeSupplies,
  taxRate,
  notes,
  onClientChange,
  onPeriodStartChange,
  onPeriodEndChange,
  onIncludeUsageChange,
  onIncludeSuppliesChange,
  onTaxRateChange,
  onNotesChange,
  onGenerate,
  onCancel,
  generating,
}: GenerateInvoiceFormProps) {
  const clientOptions = clients.map((client) => ({
    value: client.id,
    label: client.company_name,
  }));

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Create a new invoice for the selected client and billing period.
      </p>

      <Select
        label="Client"
        name="client"
        options={clientOptions}
        value={clientId}
        onChange={(e) => onClientChange(e.target.value)}
        placeholder="Select a client"
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Period Start <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={periodStart}
            onChange={(e) => onPeriodStartChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Period End <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => onPeriodEndChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Include in Invoice
        </label>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="includeUsage"
              checked={includeUsage}
              onChange={(e) => onIncludeUsageChange(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="includeUsage" className="text-sm text-gray-700">
              Include uninvoiced usage records
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="includeSupplies"
              checked={includeSupplies}
              onChange={(e) => onIncludeSuppliesChange(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="includeSupplies" className="text-sm text-gray-700">
              Include uninvoiced supplies
            </label>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tax Rate (%)
        </label>
        <input
          type="number"
          value={taxRate}
          onChange={(e) => onTaxRateChange(e.target.value)}
          placeholder="0"
          min={0}
          max={100}
          step={0.1}
          className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
          placeholder="Add any notes for this invoice..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={onGenerate}
          disabled={!clientId || !periodStart || !periodEnd || generating}
        >
          {generating ? "Generating..." : "Generate Invoice"}
        </Button>
      </div>
    </div>
  );
}

interface InvoiceDetailsProps {
  invoice: InvoiceWithItems;
  isEditing?: boolean;
  onClose?: () => void;
  onSave?: () => void;
}

function InvoiceDetails({ invoice, isEditing, onClose, onSave }: InvoiceDetailsProps) {
  const client = Array.isArray(invoice.client) ? invoice.client[0] : invoice.client;
  const [dueDate, setDueDate] = useState(invoice.due_date?.split("T")[0] || "");
  const [notes, setNotes] = useState(invoice.notes || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateInvoice(invoice.id, {
        due_date: dueDate || null,
        notes: notes || null,
      });
      onSave?.();
    } catch (err) {
      console.error("Failed to save invoice:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-gray-500">Client</div>
          <div className="font-medium">{client?.company_name || "-"}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Status</div>
          <Badge variant={statusColors[invoice.status]}>{invoice.status}</Badge>
        </div>
        <div>
          <div className="text-sm text-gray-500">Period</div>
          <div className="font-medium">
            {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Due Date</div>
          {isEditing ? (
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          ) : (
            <div className="font-medium">{formatDate(invoice.due_date)}</div>
          )}
        </div>
      </div>

      {invoice.items && invoice.items.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Line Items</h4>
          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Description
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Qty
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Unit Price
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 text-sm">{item.description}</td>
                    <td className="px-4 py-2 text-sm text-right">{item.quantity}</td>
                    <td className="px-4 py-2 text-sm text-right">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-medium">
                      {formatCurrency(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="border-t pt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Subtotal</span>
          <span>{formatCurrency(invoice.subtotal)}</span>
        </div>
        {invoice.tax_amount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Tax ({invoice.tax_rate}%)</span>
            <span>{formatCurrency(invoice.tax_amount)}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-semibold">
          <span>Total</span>
          <span>{formatCurrency(invoice.total)}</span>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Notes</h4>
        {isEditing ? (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Add notes for this invoice..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        ) : (
          <p className="text-sm text-gray-600">{invoice.notes || "No notes"}</p>
        )}
      </div>

      {isEditing && (
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}
    </div>
  );
}

interface UsageRecordsTabProps {
  usageRecords: UsageRecord[];
  clients: Client[];
  invoices: InvoiceWithItems[];
  clientFilter: string;
  invoicedFilter: string;
  startDate: string;
  endDate: string;
  onClientFilterChange: (value: string) => void;
  onInvoicedFilterChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  loading: boolean;
}

function UsageRecordsTab({
  usageRecords,
  clients,
  invoices,
  clientFilter,
  invoicedFilter,
  startDate,
  endDate,
  onClientFilterChange,
  onInvoicedFilterChange,
  onStartDateChange,
  onEndDateChange,
  currentPage,
  onPageChange,
  loading,
}: UsageRecordsTabProps) {
  const clientOptions = [
    { value: "", label: "All Clients" },
    ...clients.map((client) => ({
      value: client.id,
      label: client.company_name,
    })),
  ];

  const invoicedOptions = [
    { value: "", label: "All Records" },
    { value: "false", label: "Not Invoiced" },
    { value: "true", label: "Invoiced" },
  ];

  const getInvoiceNumber = (invoiceId: string | null) => {
    if (!invoiceId) return null;
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    return invoice?.invoice_number || null;
  };

  const usageColumns = [
    {
      key: "date",
      header: "Date",
      render: (record: UsageRecord) => formatDate(record.usage_date),
    },
    {
      key: "client",
      header: "Client",
      render: (record: UsageRecord) => {
        const client = clients.find((c) => c.id === record.client_id);
        return client?.company_name || "-";
      },
    },
    {
      key: "type",
      header: "Type",
      render: (record: UsageRecord) => (
        <span className="text-sm">{record.usage_type || "-"}</span>
      ),
    },
    {
      key: "quantity",
      header: "Quantity",
      render: (record: UsageRecord) => record.quantity.toLocaleString(),
    },
    {
      key: "unit_price",
      header: "Unit Price",
      render: (record: UsageRecord) => formatCurrency(record.unit_price),
    },
    {
      key: "total",
      header: "Total",
      render: (record: UsageRecord) => (
        <span className="font-medium">{formatCurrency(record.total)}</span>
      ),
    },
    {
      key: "reference",
      header: "Reference",
      render: (record: UsageRecord) => {
        if (record.reference_type && record.reference_id) {
          const refType = record.reference_type.toLowerCase();
          let href = "#";
          if (refType === "inbound" || refType === "inbound_order") {
            href = `/inbound/${record.reference_id}`;
          } else if (refType === "outbound" || refType === "outbound_order") {
            href = `/outbound/${record.reference_id}`;
          }
          return (
            <a
              href={href}
              className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
            >
              {record.reference_type}
            </a>
          );
        }
        return <span className="text-gray-400">-</span>;
      },
    },
    {
      key: "invoiced",
      header: "Invoiced",
      render: (record: UsageRecord) => (
        <Badge variant={record.invoice_id ? "success" : "default"}>
          {record.invoice_id ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      key: "invoice_number",
      header: "Invoice #",
      render: (record: UsageRecord) => {
        const invoiceNumber = getInvoiceNumber(record.invoice_id);
        if (invoiceNumber) {
          return (
            <a
              href={`/billing/${record.invoice_id}`}
              className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
            >
              {invoiceNumber}
            </a>
          );
        }
        return <span className="text-gray-400">-</span>;
      },
    },
  ];

  // Pagination for usage records
  const paginatedUsage = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return usageRecords.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [usageRecords, currentPage]);

  return (
    <>
      {/* Usage Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Select
          name="usageClient"
          options={clientOptions}
          value={clientFilter}
          onChange={(e) => onClientFilterChange(e.target.value)}
          placeholder="All Clients"
        />
        <Select
          name="invoiced"
          options={invoicedOptions}
          value={invoicedFilter}
          onChange={(e) => onInvoicedFilterChange(e.target.value)}
        />
        <div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            title="Start Date"
          />
        </div>
        <div>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            title="End Date"
          />
        </div>
        <div className="flex items-center text-sm text-gray-500">
          {usageRecords.length} record{usageRecords.length !== 1 ? "s" : ""} found
        </div>
      </div>

      <Card padding="none">
        <Table
          columns={usageColumns}
          data={paginatedUsage}
          loading={loading}
          emptyMessage="No usage records found"
        />
        <Pagination
          currentPage={currentPage}
          totalItems={usageRecords.length}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={onPageChange}
        />
      </Card>
    </>
  );
}
