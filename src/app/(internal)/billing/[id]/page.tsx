"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  CheckCircle,
  Edit,
  Printer,
  Download,
  XCircle,
  Plus,
  Trash2,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import AppShell from "@/components/internal/AppShell";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Alert from "@/components/ui/Alert";
import FetchError from "@/components/ui/FetchError";
import Modal from "@/components/ui/Modal";
import {
  getInvoice,
  sendInvoice,
  markInvoicePaid,
  updateInvoice,
  addInvoiceItem,
  deleteInvoiceItem,
  deleteInvoice,
  InvoiceWithItems,
} from "@/lib/api/invoices";
import Input from "@/components/ui/Input";
import { InvoiceStatus } from "@/types/database";
import { handleApiError } from "@/lib/utils/error-handler";

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

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<InvoiceWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editDueDate, setEditDueDate] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Modals
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Add item modal
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState("");
  const [newItemUnitPrice, setNewItemUnitPrice] = useState("");
  const [itemSaving, setItemSaving] = useState(false);

  // Tax rate editing
  const [editTaxRate, setEditTaxRate] = useState("");

  const fetchInvoice = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInvoice(invoiceId);
      if (!data) {
        setError("Invoice not found");
        return;
      }
      setInvoice(data);
      setEditDueDate(data.due_date?.split("T")[0] || "");
      setEditNotes(data.notes || "");
      setEditTaxRate(data.tax_rate?.toString() || "0");
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (invoiceId) {
      fetchInvoice();
    }
  }, [invoiceId]);

  const handleSend = async () => {
    if (!invoice) return;
    setActionLoading(true);
    try {
      await sendInvoice(invoice.id);
      await fetchInvoice();
      setSuccessMessage("Invoice sent successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!invoice) return;
    setActionLoading(true);
    try {
      await markInvoicePaid(invoice.id);
      await fetchInvoice();
      setSuccessMessage("Invoice marked as paid");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!invoice) return;
    setActionLoading(true);
    try {
      await updateInvoice(invoice.id, { status: "cancelled" });
      await fetchInvoice();
      setShowCancelModal(false);
      setSuccessMessage("Invoice cancelled");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!invoice) return;
    setActionLoading(true);
    try {
      await deleteInvoice(invoice.id);
      setShowDeleteModal(false);
      router.push("/billing");
    } catch (err) {
      setError(handleApiError(err));
      setActionLoading(false);
    }
  };

  const handleResend = async () => {
    if (!invoice) return;
    setActionLoading(true);
    try {
      await sendInvoice(invoice.id);
      await fetchInvoice();
      setSuccessMessage("Invoice resent successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!invoice) return;
    setActionLoading(true);
    try {
      await updateInvoice(invoice.id, {
        due_date: editDueDate || null,
        notes: editNotes || null,
      });
      await fetchInvoice();
      setIsEditing(false);
      setSuccessMessage("Invoice updated successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!invoice || !newItemDescription || !newItemQuantity || !newItemUnitPrice) return;
    setItemSaving(true);
    try {
      const quantity = parseFloat(newItemQuantity);
      const unitPrice = parseFloat(newItemUnitPrice);
      const total = quantity * unitPrice;

      await addInvoiceItem(invoice.id, {
        description: newItemDescription,
        quantity,
        unit_price: unitPrice,
        total,
      });

      // Recalculate invoice totals
      const newSubtotal = invoice.subtotal + total;
      const newTaxAmount = newSubtotal * (invoice.tax_rate / 100);
      const newTotal = newSubtotal + newTaxAmount;

      await updateInvoice(invoice.id, {
        subtotal: newSubtotal,
        tax_amount: newTaxAmount,
        total: newTotal,
      });

      await fetchInvoice();
      setShowAddItemModal(false);
      setNewItemDescription("");
      setNewItemQuantity("");
      setNewItemUnitPrice("");
      setSuccessMessage("Item added successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setItemSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string, itemTotal: number) => {
    if (!invoice) return;
    setActionLoading(true);
    try {
      await deleteInvoiceItem(itemId);

      // Recalculate invoice totals
      const newSubtotal = invoice.subtotal - itemTotal;
      const newTaxAmount = newSubtotal * (invoice.tax_rate / 100);
      const newTotal = newSubtotal + newTaxAmount;

      await updateInvoice(invoice.id, {
        subtotal: newSubtotal,
        tax_amount: newTaxAmount,
        total: newTotal,
      });

      await fetchInvoice();
      setSuccessMessage("Item deleted successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleTaxRateChange = async (newRate: string) => {
    if (!invoice) return;
    const rate = parseFloat(newRate) || 0;
    setEditTaxRate(newRate);

    // Recalculate tax amount and total
    const newTaxAmount = invoice.subtotal * (rate / 100);
    const newTotal = invoice.subtotal + newTaxAmount;

    setActionLoading(true);
    try {
      await updateInvoice(invoice.id, {
        tax_rate: rate,
        tax_amount: newTaxAmount,
        total: newTotal,
      });
      await fetchInvoice();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const client = invoice
    ? Array.isArray(invoice.client)
      ? invoice.client[0]
      : invoice.client
    : null;

  const backLink = (
    <Link
      href="/billing"
      className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
    >
      <ArrowLeft className="w-4 h-4 mr-1" />
      Back to Invoices
    </Link>
  );

  if (error && !invoice) {
    return (
      <AppShell title="Invoice">
        {backLink}
        <FetchError message={error} onRetry={fetchInvoice} />
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell title="Loading...">
        {backLink}
        <Card>
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          </div>
        </Card>
      </AppShell>
    );
  }

  if (!invoice) {
    return (
      <AppShell title="Invoice Not Found">
        {backLink}
        <Card>
          <div className="text-center py-8">
            <p className="text-gray-500">The invoice you&apos;re looking for doesn&apos;t exist.</p>
            <Button onClick={() => router.push("/billing")} className="mt-4">
              Go to Invoices
            </Button>
          </div>
        </Card>
      </AppShell>
    );
  }

  const renderActions = () => {
    const actions = [];

    if (invoice.status === "draft") {
      actions.push(
        <Button
          key="send"
          onClick={handleSend}
          disabled={actionLoading}
        >
          <Send className="w-4 h-4 mr-2" />
          Send Invoice
        </Button>
      );
      actions.push(
        <Button
          key="delete"
          variant="danger"
          onClick={() => setShowDeleteModal(true)}
          disabled={actionLoading}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </Button>
      );
    }

    if (invoice.status === "sent" || invoice.status === "overdue") {
      actions.push(
        <Button
          key="paid"
          onClick={handleMarkPaid}
          disabled={actionLoading}
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          Mark Paid
        </Button>
      );
      actions.push(
        <Button
          key="resend"
          variant="secondary"
          onClick={handleResend}
          disabled={actionLoading}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Resend
        </Button>
      );
    }

    if (invoice.status === "paid") {
      actions.push(
        <Button
          key="download"
          onClick={() => window.print()}
          disabled={actionLoading}
        >
          <Download className="w-4 h-4 mr-2" />
          Download PDF
        </Button>
      );
    }

    return <div className="flex gap-2 flex-wrap">{actions}</div>;
  };

  return (
    <AppShell
      title={`Invoice ${invoice.invoice_number}`}
      actions={renderActions()}
    >
      <Breadcrumbs items={[
        { label: "Billing", href: "/billing" },
        { label: invoice.invoice_number || "Invoice Details" }
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Invoice Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Header */}
          <Card>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Invoice {invoice.invoice_number}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Created on {formatDate(invoice.created_at)}
                </p>
              </div>
              <Badge variant={statusColors[invoice.status]}>
                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Client</h3>
                {client ? (
                  <Link
                    href={`/clients/${invoice.client_id}`}
                    className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {client.company_name}
                  </Link>
                ) : (
                  <p className="font-medium text-gray-900">-</p>
                )}
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Period</h3>
                <p className="font-medium text-gray-900">
                  {formatDate(invoice.period_start)} to {formatDate(invoice.period_end)}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Due Date</h3>
                <p className="font-medium text-gray-900">
                  {formatDate(invoice.due_date)}
                </p>
              </div>
              {invoice.sent_at && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Sent Date</h3>
                  <p className="font-medium text-gray-900">
                    {formatDate(invoice.sent_at)}
                  </p>
                </div>
              )}
              {invoice.paid_at && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Paid Date</h3>
                  <p className="font-medium text-green-600">
                    {formatDate(invoice.paid_at)}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Line Items */}
          <Card padding="none">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Line Items</h3>
              {invoice.status === "draft" && (
                <Button
                  size="sm"
                  onClick={() => setShowAddItemModal(true)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              )}
            </div>
            {invoice.items && invoice.items.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unit Price
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    {invoice.status === "draft" && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoice.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {item.description}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right">
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                        {formatCurrency(item.total)}
                      </td>
                      {invoice.status === "draft" && (
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDeleteItem(item.id, item.total)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete item"
                            disabled={actionLoading}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-8 text-center text-gray-500">
                No line items
                {invoice.status === "draft" && (
                  <div className="mt-4">
                    <Button
                      size="sm"
                      onClick={() => setShowAddItemModal(true)}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add First Item
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Totals */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Totals</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(invoice.subtotal)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">Tax Rate</span>
                  {invoice.status === "draft" ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editTaxRate}
                        onChange={(e) => setEditTaxRate(e.target.value)}
                        onBlur={(e) => handleTaxRateChange(e.target.value)}
                        className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right"
                        min={0}
                        max={100}
                        step={0.1}
                      />
                      <span className="text-gray-500">%</span>
                    </div>
                  ) : (
                    <span className="text-gray-500">({invoice.tax_rate}%)</span>
                  )}
                </div>
                <span className="font-medium text-gray-900">
                  {formatCurrency(invoice.tax_amount)}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-t-2 border-gray-200">
                <span className="text-lg font-semibold text-gray-900">Total</span>
                <span className="text-xl font-bold text-gray-900">
                  {formatCurrency(invoice.total)}
                </span>
              </div>
            </div>
          </Card>

          {/* Notes */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Notes</h3>
            {isEditing ? (
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={4}
                placeholder="Add notes for this invoice..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            ) : (
              <p className="text-gray-600">
                {invoice.notes || "No notes added."}
              </p>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Payment Info */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Details</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Due Date</p>
                {isEditing ? (
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-1"
                  />
                ) : (
                  <p className="font-medium text-gray-900">
                    {formatDate(invoice.due_date)}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500">Amount Due</p>
                <p className="text-2xl font-bold text-gray-900">
                  {invoice.status === "paid" ? formatCurrency(0) : formatCurrency(invoice.total)}
                </p>
              </div>
              {invoice.status === "paid" && invoice.paid_at && (
                <div>
                  <p className="text-sm text-gray-500">Paid On</p>
                  <p className="font-medium text-green-600">
                    {formatDate(invoice.paid_at)}
                  </p>
                </div>
              )}
              {invoice.status === "sent" && invoice.sent_at && (
                <div>
                  <p className="text-sm text-gray-500">Sent On</p>
                  <p className="font-medium text-gray-900">
                    {formatDate(invoice.sent_at)}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Save Edit Button */}
          {isEditing && (
            <Card>
              <div className="space-y-3">
                <Button
                  onClick={handleSaveEdit}
                  disabled={actionLoading}
                  className="w-full"
                >
                  {actionLoading ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsEditing(false);
                    setEditDueDate(invoice.due_date?.split("T")[0] || "");
                    setEditNotes(invoice.notes || "");
                  }}
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => window.print()}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print Invoice
              </button>
              <button
                onClick={() => {
                  // Future: implement PDF download
                  window.print();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Invoice"
        size="sm"
      >
        <p className="text-gray-600 mb-4">
          Are you sure you want to cancel this invoice? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowCancelModal(false)}>
            Keep Invoice
          </Button>
          <Button
            variant="danger"
            onClick={handleCancel}
            disabled={actionLoading}
          >
            {actionLoading ? "Cancelling..." : "Cancel Invoice"}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Invoice"
        size="sm"
      >
        <p className="text-gray-600 mb-4">
          Are you sure you want to delete this invoice? This will permanently remove the invoice and all its line items. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Keep Invoice
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={actionLoading}
          >
            {actionLoading ? "Deleting..." : "Delete Invoice"}
          </Button>
        </div>
      </Modal>

      {/* Add Item Modal */}
      <Modal
        isOpen={showAddItemModal}
        onClose={() => {
          setShowAddItemModal(false);
          setNewItemDescription("");
          setNewItemQuantity("");
          setNewItemUnitPrice("");
        }}
        title="Add Line Item"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Description"
            name="description"
            value={newItemDescription}
            onChange={(e) => setNewItemDescription(e.target.value)}
            placeholder="e.g., Storage fees for January"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Quantity"
              name="quantity"
              type="number"
              value={newItemQuantity}
              onChange={(e) => setNewItemQuantity(e.target.value)}
              placeholder="1"
              min={0}
              step={0.01}
              required
            />
            <Input
              label="Unit Price"
              name="unit_price"
              type="number"
              value={newItemUnitPrice}
              onChange={(e) => setNewItemUnitPrice(e.target.value)}
              placeholder="0.00"
              min={0}
              step={0.01}
              required
            />
          </div>
          {newItemQuantity && newItemUnitPrice && (
            <div className="bg-gray-50 rounded-md p-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Line Total:</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(parseFloat(newItemQuantity) * parseFloat(newItemUnitPrice))}
                </span>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddItemModal(false);
                setNewItemDescription("");
                setNewItemQuantity("");
                setNewItemUnitPrice("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddItem}
              disabled={!newItemDescription || !newItemQuantity || !newItemUnitPrice || itemSaving}
            >
              {itemSaving ? "Adding..." : "Add Item"}
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
