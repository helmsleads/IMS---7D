"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  Truck,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Layers,
} from "lucide-react";
import { ProductImageCard } from "@/components/ui/ProductImage";
import { useClient } from "@/lib/client-auth";
import { createClient } from "@/lib/supabase";
import Card from "@/components/ui/Card";

interface ProductDetail {
  id: string;
  inventory_id: string;
  product_name: string;
  sku: string;
  description: string | null;
  category: string | null;
  qty_on_hand: number;
  reorder_point: number;
  image_url: string | null;
  lot_tracking_enabled: boolean;
}

interface LotInfo {
  id: string;
  lot_number: string;
  expiration_date: string | null;
  manufacture_date: string | null;
  status: string;
  qty_available: number;
}

export default function PortalInventoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { client } = useClient();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [lots, setLots] = useState<LotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lotsLoading, setLotsLoading] = useState(false);

  const productId = params.id as string;

  useEffect(() => {
    const fetchProduct = async () => {
      if (!client || !productId) return;

      const supabase = createClient();

      // Fetch product with inventory
      const { data: inventoryData, error: inventoryError } = await supabase
        .from("inventory")
        .select(`
          id,
          qty_on_hand,
          product:products!inner (
            id,
            name,
            sku,
            description,
            category,
            image_url,
            reorder_point,
            lot_tracking_enabled,
            client_id
          )
        `)
        .eq("product.id", productId)
        .eq("product.client_id", client.id)
        .single();

      if (inventoryError) {
        console.error("Failed to fetch product:", inventoryError);
        setLoading(false);
        return;
      }

      if (inventoryData) {
        const prod = Array.isArray(inventoryData.product)
          ? inventoryData.product[0]
          : inventoryData.product;

        setProduct({
          id: prod.id,
          inventory_id: inventoryData.id,
          product_name: prod.name,
          sku: prod.sku,
          description: prod.description,
          category: prod.category,
          qty_on_hand: inventoryData.qty_on_hand,
          reorder_point: prod.reorder_point || 0,
          image_url: prod.image_url,
          lot_tracking_enabled: prod.lot_tracking_enabled || false,
        });

        // If lot tracking is enabled, fetch lots
        if (prod.lot_tracking_enabled) {
          fetchLots(prod.id);
        }
      }

      setLoading(false);
    };

    fetchProduct();
  }, [client, productId]);

  const fetchLots = async (prodId: string) => {
    setLotsLoading(true);
    const supabase = createClient();

    // Fetch lots for this product with inventory quantities
    const { data: lotsData, error: lotsError } = await supabase
      .from("lots")
      .select(`
        id,
        lot_number,
        expiration_date,
        manufacture_date,
        status,
        lot_inventory (
          qty_on_hand
        )
      `)
      .eq("product_id", prodId)
      .eq("status", "active")
      .order("expiration_date", { ascending: true, nullsFirst: false });

    if (lotsError) {
      console.error("Failed to fetch lots:", lotsError);
      setLotsLoading(false);
      return;
    }

    const lotsWithQty = (lotsData || []).map((lot) => {
      const totalQty = (lot.lot_inventory || []).reduce(
        (sum: number, inv: { qty_on_hand: number }) => sum + inv.qty_on_hand,
        0
      );
      return {
        id: lot.id,
        lot_number: lot.lot_number,
        expiration_date: lot.expiration_date,
        manufacture_date: lot.manufacture_date,
        status: lot.status,
        qty_available: totalQty,
      };
    }).filter((lot) => lot.qty_available > 0);

    setLots(lotsWithQty);
    setLotsLoading(false);
  };

  const getDaysUntilExpiry = (expirationDate: string | null): number | null => {
    if (!expirationDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expirationDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpiryStatus = (days: number | null) => {
    if (days === null) {
      return { label: "No Expiry", color: "text-gray-500", bg: "bg-gray-100" };
    }
    if (days < 0) {
      return { label: "Expired", color: "text-red-700", bg: "bg-red-100", icon: XCircle };
    }
    if (days <= 30) {
      return { label: "Expiring Soon", color: "text-orange-700", bg: "bg-orange-100", icon: AlertTriangle };
    }
    if (days <= 90) {
      return { label: "Good", color: "text-yellow-700", bg: "bg-yellow-100", icon: Clock };
    }
    return { label: "Fresh", color: "text-green-700", bg: "bg-green-100", icon: CheckCircle };
  };

  const formatDate = (date: string | null): string => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStockStatus = (qty: number, reorderPoint: number) => {
    if (qty === 0) {
      return { label: "Out of Stock", color: "bg-red-100 text-red-700" };
    }
    if (qty <= reorderPoint) {
      return { label: "Low Stock", color: "bg-yellow-100 text-yellow-700" };
    }
    return { label: "In Stock", color: "bg-green-100 text-green-700" };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="space-y-6">
        <Link
          href="/portal/inventory"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Inventory
        </Link>
        <Card>
          <div className="text-center py-12 text-gray-500">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">Product not found</p>
            <p className="text-sm mt-1">
              This product may not exist or you don&apos;t have access to it.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const stockStatus = getStockStatus(product.qty_on_hand, product.reorder_point);

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href="/portal/inventory"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Inventory
      </Link>

      {/* Product Header */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Image */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <ProductImageCard
              src={product.image_url}
              alt={product.product_name}
              aspectRatio="square"
            />
          </div>
        </div>

        {/* Product Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {product.product_name}
                </h1>
                <p className="text-gray-500 font-mono mt-1">{product.sku}</p>
                {product.category && (
                  <p className="text-sm text-gray-400 mt-1">{product.category}</p>
                )}
              </div>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${stockStatus.color}`}
              >
                {stockStatus.label}
              </span>
            </div>

            {product.description && (
              <p className="text-gray-600 mt-4">{product.description}</p>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
              <div>
                <p className="text-sm text-gray-500">Available Quantity</p>
                <p className="text-3xl font-bold text-gray-900">
                  {product.qty_on_hand.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Reorder Point</p>
                <p className="text-2xl font-semibold text-gray-700">
                  {product.reorder_point.toLocaleString()}
                </p>
              </div>
              {product.lot_tracking_enabled && (
                <div>
                  <p className="text-sm text-gray-500">Active Lots</p>
                  <p className="text-2xl font-semibold text-gray-700">
                    {lots.length}
                  </p>
                </div>
              )}
            </div>

            {/* Lot Tracking Badge */}
            {product.lot_tracking_enabled && (
              <div className="mt-4 flex items-center gap-2 text-sm">
                <Layers className="w-4 h-4 text-blue-600" />
                <span className="text-blue-600 font-medium">Lot Tracking Enabled</span>
              </div>
            )}
          </Card>

          {/* Action Button */}
          <Link
            href={`/portal/request-shipment?productId=${product.id}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
          >
            <Truck className="w-5 h-5" />
            Request Shipment
          </Link>
        </div>
      </div>

      {/* Lots Table (if lot tracking enabled) */}
      {product.lot_tracking_enabled && (
        <Card>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Lot Inventory</h2>
              <p className="text-sm text-gray-500">
                Track expiration dates and quantities by lot
              </p>
            </div>
          </div>

          {lotsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full"></div>
            </div>
          ) : lots.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                      Lot Number
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                      Expiration Date
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">
                      Quantity Available
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">
                      Days Until Expiry
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lots.map((lot) => {
                    const daysUntilExpiry = getDaysUntilExpiry(lot.expiration_date);
                    const expiryStatus = getExpiryStatus(daysUntilExpiry);
                    const StatusIcon = expiryStatus.icon;

                    return (
                      <tr
                        key={lot.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                      >
                        <td className="py-4 px-4">
                          <span className="font-medium text-gray-900 font-mono">
                            {lot.lot_number}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-700">
                              {formatDate(lot.expiration_date)}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className="font-semibold text-gray-900">
                            {lot.qty_available.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          {daysUntilExpiry !== null ? (
                            <span
                              className={`font-medium ${
                                daysUntilExpiry < 0
                                  ? "text-red-600"
                                  : daysUntilExpiry <= 30
                                  ? "text-orange-600"
                                  : daysUntilExpiry <= 90
                                  ? "text-yellow-600"
                                  : "text-green-600"
                              }`}
                            >
                              {daysUntilExpiry < 0
                                ? `${Math.abs(daysUntilExpiry)} days ago`
                                : `${daysUntilExpiry} days`}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${expiryStatus.bg} ${expiryStatus.color}`}
                          >
                            {StatusIcon && <StatusIcon className="w-3.5 h-3.5" />}
                            {expiryStatus.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Layers className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No active lots</p>
              <p className="text-sm mt-1">
                There are no lots with available inventory for this product.
              </p>
            </div>
          )}

          {/* Lot Summary */}
          {lots.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Lots</p>
                  <p className="text-2xl font-bold text-gray-900">{lots.length}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Qty</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {lots.reduce((sum, lot) => sum + lot.qty_available, 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <p className="text-xs text-orange-600 uppercase tracking-wide">Expiring Soon</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {lots.filter((lot) => {
                      const days = getDaysUntilExpiry(lot.expiration_date);
                      return days !== null && days >= 0 && days <= 30;
                    }).length}
                  </p>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-xs text-red-600 uppercase tracking-wide">Expired</p>
                  <p className="text-2xl font-bold text-red-600">
                    {lots.filter((lot) => {
                      const days = getDaysUntilExpiry(lot.expiration_date);
                      return days !== null && days < 0;
                    }).length}
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
