"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
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
import Table from "@/components/ui/Table";
import FetchError from "@/components/ui/FetchError";
import Pagination, { usePagination } from "@/components/ui/Pagination";
import { formatDate, formatCurrency } from "@/lib/utils/formatting";
import { handleApiError } from "@/lib/utils/error-handler";
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
  const [error, setError] = useState<string | null>(null);

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

  // Pagination
  const {
    currentPage,
    setCurrentPage,
    paginatedItems,
    totalItems,
    itemsPerPage,
  } = usePagination(returns, 20);

  const fetchReturns = useCallback(async () => {
    if (!client) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getMyReturns(client.id);
      setReturns(data);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

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
      } catch (err) {
        console.error("Failed to fetch modal data:", handleApiError(err));
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
    } catch (err) {
      setSubmitError(handleApiError(err));
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

  // Table columns
  const columns = useMemo(
    () => [
      {
        key: "return_number",
        header: "Return #",
        mobilePriority: 1 as const,
        render: (ret: PortalReturn) => (
          <span className="font-medium text-slate-900">
            {ret.return_number}
          </span>
        ),
      },
      {
        key: "original_order",
        header: "Original Order",
        mobilePriority: 3 as const,
        hideOnMobile: true,
        render: (ret: PortalReturn) => (
          <span className="text-sm text-slate-600">
            {ret.original_order?.order_number || "\u2014"}
          </span>
        ),
      },
      {
        key: "reason",
        header: "Reason",
        mobilePriority: 2 as const,
        render: (ret: PortalReturn) => (
          <span className="text-sm text-slate-600">
            {getReasonLabel(ret.reason)}
          </span>
        ),
      },
      {
        key: "requested_at",
        header: "Requested Date",
        mobilePriority: 3 as const,
        hideOnMobile: true,
        render: (ret: PortalReturn) => (
          <span className="text-sm text-slate-600">
            {formatDate(ret.requested_at || ret.created_at)}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        align: "center" as const,
        mobilePriority: 2 as const,
        render: (ret: PortalReturn) => (
          <StatusBadge status={ret.status} entityType="return" />
        ),
      },
      {
        key: "credit_amount",
        header: "Credit",
        align: "right" as const,
        mobilePriority: 3 as const,
        hideOnMobile: true,
        render: (ret: PortalReturn) =>
          ret.status === "processed" && ret.credit_amount ? (
            <span className="font-medium text-green-600">
              {formatCurrency(ret.credit_amount)}
            </span>
          ) : (
            <span className="text-slate-400">{"\u2014"}</span>
          ),
      },
      {
        key: "actions",
        header: "Actions",
        align: "right" as const,
        hideOnMobile: true,
        render: (ret: PortalReturn) => (
          <a
            href={`/portal/returns/${ret.id}`}
            className="inline-flex items-center gap-1 text-sm text-cyan-600 hover:text-cyan-700 font-medium"
          >
            <Eye className="w-4 h-4" />
            View
          </a>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

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

  if (error) {
    return <FetchError message={error} onRetry={() => fetchReturns()} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Returns</h1>
          <p className="text-slate-500 mt-1">
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
        <Table
          columns={columns}
          data={paginatedItems}
          emptyIcon={
            <RotateCcw className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          }
          emptyMessage={
            <div className="text-center text-slate-500">
              <p className="font-medium">No returns yet</p>
              <p className="text-sm mt-1">Need to return a product?</p>
              <div className="mt-4">
                <Button onClick={() => setShowModal(true)} size="md">
                  <Plus className="w-4 h-4 mr-2" />
                  Request Return
                </Button>
              </div>
            </div>
          }
        />
        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </Card>

      {/* Help Note */}
      <Card className="bg-cyan-50 border-cyan-100">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-cyan-100 rounded-lg">
            <AlertCircle className="w-5 h-5 text-cyan-600" />
          </div>
          <div>
            <h3 className="font-medium text-slate-900">Return Policy</h3>
            <p className="text-sm text-slate-600 mt-1">
              Returns can be requested within 30 days of shipment. Once approved,
              you&apos;ll receive instructions for sending items back. Credits are
              issued after items are received and inspected.
            </p>
            <a
              href="/portal/messages"
              className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-cyan-600 hover:text-cyan-700"
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
            <label className="block text-sm font-medium text-slate-700 mb-1">
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
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
                {returnItems.map((item) => (
                  <div
                    key={item.product_id}
                    className="flex items-center justify-between p-3"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {item.product_sku}
                      </p>
                      <p className="text-sm text-slate-500">
                        {item.product_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-600">
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
              <div className="text-center py-6 border border-dashed border-slate-300 rounded-lg text-slate-500">
                <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
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
