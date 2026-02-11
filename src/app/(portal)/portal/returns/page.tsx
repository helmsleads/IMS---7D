"use client";

import { useEffect, useState } from "react";
import {
  RotateCcw,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  Package,
  AlertCircle,
  Eye,
  X,
  Trash2,
} from "lucide-react";
import { useClient } from "@/lib/client-auth";
import Card from "@/components/ui/Card";
import {
  getMyReturns,
  getReturnReasons,
  getReturnableOrders,
  requestReturn,
  PortalReturn,
  ReturnReason,
  ReturnRequestItem,
} from "@/lib/api/portal-returns";
import { getProducts } from "@/lib/api/products";

interface ReturnableOrder {
  id: string;
  order_number: string;
  shipped_date: string | null;
  items: {
    product_id: string;
    product_sku: string;
    product_name: string;
    qty_shipped: number;
  }[];
}

interface ProductOption {
  id: string;
  sku: string;
  name: string;
  maxQty?: number;
}

interface ReturnItem {
  product_id: string;
  product_sku: string;
  product_name: string;
  qty_requested: number;
}

export default function PortalReturnsPage() {
  const { client } = useClient();
  const [returns, setReturns] = useState<PortalReturn[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [returnableOrders, setReturnableOrders] = useState<ReturnableOrder[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [reasons] = useState<ReturnReason[]>(getReturnReasons());

  // Form state
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [reasonDetails, setReasonDetails] = useState<string>("");
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [currentProductId, setCurrentProductId] = useState<string>("");
  const [currentQty, setCurrentQty] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReturns = async () => {
      if (!client) return;

      try {
        const data = await getMyReturns(client.id);
        setReturns(data);
      } catch (error) {
        console.error("Failed to fetch returns:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReturns();
  }, [client]);

  useEffect(() => {
    const fetchModalData = async () => {
      if (!client || !showModal) return;

      try {
        const [ordersData, productsData] = await Promise.all([
          getReturnableOrders(client.id),
          getProducts(),
        ]);

        setReturnableOrders(ordersData);

        // Map products to ProductOption format
        setProducts(
          productsData
            .filter((p) => p.active)
            .map((p) => ({
              id: p.id,
              sku: p.sku,
              name: p.name,
            }))
        );
      } catch (error) {
        console.error("Failed to fetch modal data:", error);
      }
    };

    fetchModalData();
  }, [client, showModal]);

  // Get available products based on selected order
  const availableProducts = selectedOrderId
    ? returnableOrders
        .find((o) => o.id === selectedOrderId)
        ?.items.map((item) => ({
          id: item.product_id,
          sku: item.product_sku,
          name: item.product_name,
          maxQty: item.qty_shipped,
        })) || []
    : products;

  // Check if selected reason requires details
  const selectedReasonObj = reasons.find((r) => r.value === selectedReason);
  const requiresDetails = selectedReasonObj?.requiresDetails || false;

  const handleAddItem = () => {
    if (!currentProductId || currentQty < 1) return;

    const product = availableProducts.find((p) => p.id === currentProductId);
    if (!product) return;

    // Check if product already added
    const existingIndex = returnItems.findIndex(
      (item) => item.product_id === currentProductId
    );

    if (existingIndex >= 0) {
      // Update quantity
      const updated = [...returnItems];
      updated[existingIndex].qty_requested += currentQty;
      setReturnItems(updated);
    } else {
      // Add new item
      setReturnItems([
        ...returnItems,
        {
          product_id: product.id,
          product_sku: product.sku,
          product_name: product.name,
          qty_requested: currentQty,
        },
      ]);
    }

    setCurrentProductId("");
    setCurrentQty(1);
  };

  const handleRemoveItem = (productId: string) => {
    setReturnItems(returnItems.filter((item) => item.product_id !== productId));
  };

  const handleSubmit = async () => {
    if (!client) return;
    if (!selectedReason) {
      setSubmitError("Please select a reason for the return");
      return;
    }
    if (requiresDetails && !reasonDetails.trim()) {
      setSubmitError("Please provide details for the return reason");
      return;
    }
    if (returnItems.length === 0) {
      setSubmitError("Please add at least one item to return");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const items: ReturnRequestItem[] = returnItems.map((item) => ({
        product_id: item.product_id,
        qty_requested: item.qty_requested,
      }));

      await requestReturn(
        client.id,
        selectedReason,
        reasonDetails.trim() || null,
        items,
        selectedOrderId || null
      );

      // Refresh returns list
      const updatedReturns = await getMyReturns(client.id);
      setReturns(updatedReturns);

      // Reset and close modal
      resetForm();
      setShowModal(false);
    } catch (error) {
      console.error("Failed to submit return:", error);
      setSubmitError("Failed to submit return request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedOrderId("");
    setSelectedReason("");
    setReasonDetails("");
    setReturnItems([]);
    setCurrentProductId("");
    setCurrentQty(1);
    setSubmitError(null);
  };

  const handleCloseModal = () => {
    resetForm();
    setShowModal(false);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "requested":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
            <Clock className="w-3 h-3" />
            Requested
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
            <CheckCircle className="w-3 h-3" />
            Approved
          </span>
        );
      case "received":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
            <Package className="w-3 h-3" />
            Received
          </span>
        );
      case "processed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <CheckCircle className="w-3 h-3" />
            Processed
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
            <XCircle className="w-3 h-3" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium capitalize">
            {status}
          </span>
        );
    }
  };

  const getReasonLabel = (reason: string | null) => {
    if (!reason) return "—";
    const reasonObj = reasons.find((r) => r.value === reason);
    return reasonObj?.label || reason;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Returns</h1>
          <p className="text-gray-500 mt-1">
            Request and track product returns
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Request Return
        </button>
      </div>

      {/* Returns List */}
      <Card>
        {returns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                    Return #
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                    Original Order
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                    Reason
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                    Requested
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">
                    Status
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                    Credit
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {returns.map((ret) => (
                  <tr
                    key={ret.id}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">
                        {ret.return_number}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {ret.original_order?.order_number || "—"}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {getReasonLabel(ret.reason)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {formatDate(ret.requested_at || ret.created_at)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {getStatusBadge(ret.status)}
                    </td>
                    <td className="py-3 px-4 text-right text-sm">
                      {ret.status === "processed" && ret.credit_amount ? (
                        <span className="font-medium text-green-600">
                          {formatCurrency(ret.credit_amount)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={`/portal/returns/${ret.id}`}
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <RotateCcw className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No returns yet</p>
            <p className="text-sm mt-1">Need to return a product?</p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Request Return
            </button>
          </div>
        )}
      </Card>

      {/* Help Note */}
      <Card className="bg-blue-50 border-blue-100">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <AlertCircle className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Return Policy</h3>
            <p className="text-sm text-gray-600 mt-1">
              Returns can be requested within 30 days of shipment. Once approved,
              you&apos;ll receive instructions for sending items back. Credits are
              issued after items are received and inspected.
            </p>
            <a
              href="/portal/messages"
              className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Questions? Contact Us
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </Card>

      {/* Request Return Modal */}
      {showModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={handleCloseModal}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  Request Return
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                {/* Original Order (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Original Order (Optional)
                  </label>
                  <select
                    value={selectedOrderId}
                    onChange={(e) => {
                      setSelectedOrderId(e.target.value);
                      setReturnItems([]);
                      setCurrentProductId("");
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select an order (or leave blank)</option>
                    {returnableOrders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.order_number} - Shipped{" "}
                        {formatDate(order.shipped_date)}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select if returning items from a specific order
                  </p>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for Return <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedReason}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a reason</option>
                    {reasons.map((reason) => (
                      <option key={reason.value} value={reason.value}>
                        {reason.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Reason Details */}
                {(requiresDetails || selectedReason) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Details{" "}
                      {requiresDetails && <span className="text-red-500">*</span>}
                    </label>
                    <textarea
                      value={reasonDetails}
                      onChange={(e) => setReasonDetails(e.target.value)}
                      rows={3}
                      placeholder="Please provide details about the return..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}

                {/* Items Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Items to Return <span className="text-red-500">*</span>
                  </label>

                  {/* Add Item Row */}
                  <div className="flex gap-2 mb-3">
                    <select
                      value={currentProductId}
                      onChange={(e) => setCurrentProductId(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select a product</option>
                      {availableProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.sku} - {product.name}
                          {product.maxQty ? ` (max: ${product.maxQty})` : ""}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={currentQty}
                      onChange={(e) =>
                        setCurrentQty(Math.max(1, parseInt(e.target.value) || 1))
                      }
                      min="1"
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={handleAddItem}
                      disabled={!currentProductId}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Items List */}
                  {returnItems.length > 0 ? (
                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
                      {returnItems.map((item) => (
                        <div
                          key={item.product_id}
                          className="flex items-center justify-between p-3"
                        >
                          <div>
                            <p className="font-medium text-gray-900">
                              {item.product_sku}
                            </p>
                            <p className="text-sm text-gray-500">
                              {item.product_name}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-600">
                              Qty: {item.qty_requested}
                            </span>
                            <button
                              onClick={() => handleRemoveItem(item.product_id)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 border border-dashed border-gray-300 rounded-lg text-gray-500">
                      <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No items added yet</p>
                    </div>
                  )}
                </div>

                {/* Error Message */}
                {submitError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {submitError}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Submitting..." : "Submit Return Request"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
