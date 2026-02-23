"use client";

import { useEffect, useState } from "react";
import {
  RotateCcw,
  Plus,
  Package,
  AlertCircle,
  Eye,
  Trash2,
} from "lucide-react";
import { useClient } from "@/lib/client-auth";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDate, formatCurrency } from "@/lib/utils/formatting";
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

  const getReasonLabel = (reason: string | null) => {
    if (!reason) return "\u2014";
    const reasonObj = reasons.find((r) => r.value === reason);
    return reasonObj?.label || reason;
  };

  // Build Select options for the modal
  const orderOptions = returnableOrders.map((order) => ({
    value: order.id,
    label: `${order.order_number} - Shipped ${formatDate(order.shipped_date)}`,
  }));

  const reasonOptions = reasons.map((reason) => ({
    value: reason.value,
    label: reason.label,
  }));

  const productOptions = availableProducts.map((product) => ({
    value: product.id,
    label: `${product.sku} - ${product.name}${product.maxQty ? ` (max: ${product.maxQty})` : ""}`,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
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
        <Button onClick={() => setShowModal(true)} size="md">
          <Plus className="w-4 h-4 mr-2" />
          Request Return
        </Button>
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
                      {ret.original_order?.order_number || "\u2014"}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {getReasonLabel(ret.reason)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {formatDate(ret.requested_at || ret.created_at)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={ret.status} entityType="return" />
                    </td>
                    <td className="py-3 px-4 text-right text-sm">
                      {ret.status === "processed" && ret.credit_amount ? (
                        <span className="font-medium text-green-600">
                          {formatCurrency(ret.credit_amount)}
                        </span>
                      ) : (
                        <span className="text-gray-400">{"\u2014"}</span>
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
            <div className="mt-4">
              <Button onClick={() => setShowModal(true)} size="md">
                <Plus className="w-4 h-4 mr-2" />
                Request Return
              </Button>
            </div>
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
              <span aria-hidden="true">{"\u2192"}</span>
            </a>
          </div>
        </div>
      </Card>

      {/* Request Return Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title="Request Return"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={submitting}>
              Submit Return Request
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Original Order (Optional) */}
          <Select
            name="originalOrder"
            label="Original Order (Optional)"
            options={orderOptions}
            value={selectedOrderId}
            onChange={(e) => {
              setSelectedOrderId(e.target.value);
              setReturnItems([]);
              setCurrentProductId("");
            }}
            placeholder="Select an order (or leave blank)"
            hint="Select if returning items from a specific order"
          />

          {/* Reason */}
          <Select
            name="returnReason"
            label="Reason for Return"
            options={reasonOptions}
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
            placeholder="Select a reason"
            required
          />

          {/* Reason Details */}
          {(requiresDetails || selectedReason) && (
            <Textarea
              name="reasonDetails"
              label="Details"
              value={reasonDetails}
              onChange={(e) => setReasonDetails(e.target.value)}
              rows={3}
              placeholder="Please provide details about the return..."
              required={requiresDetails}
            />
          )}

          {/* Items Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Items to Return <span className="text-red-500 ml-1">*</span>
            </label>

            {/* Add Item Row */}
            <div className="flex gap-2 mb-3">
              <div className="flex-1">
                <Select
                  name="currentProduct"
                  options={productOptions}
                  value={currentProductId}
                  onChange={(e) => setCurrentProductId(e.target.value)}
                  placeholder="Select a product"
                />
              </div>
              <div className="w-24">
                <Input
                  name="currentQty"
                  type="number"
                  value={currentQty}
                  onChange={(e) =>
                    setCurrentQty(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  min={1}
                />
              </div>
              <Button
                variant="secondary"
                onClick={handleAddItem}
                disabled={!currentProductId}
                className="self-start"
              >
                <Plus className="w-5 h-5" />
              </Button>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(item.product_id)}
                        className="text-red-500 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
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
      </Modal>
    </div>
  );
}
