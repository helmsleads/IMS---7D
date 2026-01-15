"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Package,
  MapPin,
  Clock,
  ArrowRight,
  Plus,
  FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase";

interface OrderDetails {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  ship_to_address: string;
  ship_to_address2: string | null;
  ship_to_city: string;
  ship_to_state: string;
  ship_to_postal_code: string;
  ship_to_country: string;
  is_rush: boolean;
  items: {
    id: string;
    product_name: string;
    sku: string;
    qty_requested: number;
  }[];
}

export default function ShipmentConfirmationPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) {
        setError("No order ID provided");
        setLoading(false);
        return;
      }

      const supabase = createClient();

      const { data, error: fetchError } = await supabase
        .from("outbound_orders")
        .select(`
          id,
          order_number,
          status,
          created_at,
          ship_to_address,
          ship_to_address2,
          ship_to_city,
          ship_to_state,
          ship_to_postal_code,
          ship_to_country,
          is_rush,
          items:outbound_items (
            id,
            qty_requested,
            product:products (
              name,
              sku
            )
          )
        `)
        .eq("id", orderId)
        .single();

      if (fetchError || !data) {
        setError("Unable to load order details");
        setLoading(false);
        return;
      }

      // Transform the data
      const orderDetails: OrderDetails = {
        id: data.id,
        order_number: data.order_number,
        status: data.status,
        created_at: data.created_at,
        ship_to_address: data.ship_to_address,
        ship_to_address2: data.ship_to_address2,
        ship_to_city: data.ship_to_city,
        ship_to_state: data.ship_to_state,
        ship_to_postal_code: data.ship_to_postal_code,
        ship_to_country: data.ship_to_country,
        is_rush: data.is_rush || false,
        items: (data.items || []).map((item: { id: string; qty_requested: number; product: { name: string; sku: string } | { name: string; sku: string }[] }) => {
          const product = Array.isArray(item.product) ? item.product[0] : item.product;
          return {
            id: item.id,
            product_name: product?.name || "Unknown",
            sku: product?.sku || "",
            qty_requested: item.qty_requested,
          };
        }),
      };

      setOrder(orderDetails);
      setLoading(false);
    };

    fetchOrder();
  }, [orderId]);

  const totalUnits = order?.items.reduce((sum, item) => sum + item.qty_requested, 0) || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h1>
        <p className="text-gray-600 mb-6">{error || "We couldn't find the order you're looking for."}</p>
        <Link
          href="/portal/orders"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          View All Orders
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Success Header */}
      <div className="text-center py-8">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce-once">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Shipment Request Submitted!
        </h1>
        <p className="text-gray-600">
          Your order has been received and is being processed.
        </p>
      </div>

      {/* Order Number Card */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white text-center">
        <p className="text-blue-100 text-sm uppercase tracking-wide mb-1">Order Number</p>
        <p className="text-3xl font-mono font-bold">{order.order_number}</p>
        {order.is_rush && (
          <span className="inline-block mt-3 px-3 py-1 bg-orange-500 text-white text-sm font-medium rounded-full">
            Rush Order
          </span>
        )}
      </div>

      {/* Order Summary */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Order Summary</h2>
        </div>

        {/* Products */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
            <Package className="w-4 h-4" />
            <span>Products ({order.items.length} items, {totalUnits.toLocaleString()} units)</span>
          </div>
          <div className="space-y-2">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <div>
                  <p className="font-medium text-gray-900">{item.product_name}</p>
                  <p className="text-sm text-gray-500 font-mono">{item.sku}</p>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-gray-900">
                    {item.qty_requested.toLocaleString()}
                  </span>
                  <span className="text-sm text-gray-500 ml-1">units</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Shipping Address */}
        <div className="p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <MapPin className="w-4 h-4" />
            <span>Shipping To</span>
          </div>
          <p className="text-gray-900">{order.ship_to_address}</p>
          {order.ship_to_address2 && (
            <p className="text-gray-900">{order.ship_to_address2}</p>
          )}
          <p className="text-gray-900">
            {order.ship_to_city}, {order.ship_to_state} {order.ship_to_postal_code}
          </p>
          <p className="text-gray-500">{order.ship_to_country}</p>
        </div>
      </div>

      {/* What Happens Next */}
      <div className="bg-blue-50 rounded-xl p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          What Happens Next?
        </h2>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
              1
            </div>
            <div>
              <p className="font-medium text-gray-900">Order Confirmation</p>
              <p className="text-sm text-gray-600">
                Our team will review your order and confirm product availability.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
              2
            </div>
            <div>
              <p className="font-medium text-gray-900">Picking & Packing</p>
              <p className="text-sm text-gray-600">
                Products will be picked from inventory and carefully packed for shipment.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
              3
            </div>
            <div>
              <p className="font-medium text-gray-900">Shipping</p>
              <p className="text-sm text-gray-600">
                You'll receive tracking information once your order ships.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Delivery</p>
              <p className="text-sm text-gray-600">
                Your products will arrive at the specified shipping address.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href={`/portal/orders/${order.id}`}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          View Order Details
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/portal/request-shipment"
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 font-medium rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Request Another Shipment
        </Link>
      </div>

      {/* Help Text */}
      <p className="text-center text-sm text-gray-500">
        Questions about your order? Contact our support team for assistance.
      </p>
    </div>
  );
}
