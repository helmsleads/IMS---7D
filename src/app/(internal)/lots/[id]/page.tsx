"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  Calendar,
  MapPin,
  Truck,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  History,
  Pencil,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import FetchError from "@/components/ui/FetchError";
import EmptyState from "@/components/ui/EmptyState";
import { getLot, getLotInventory, LotWithInventory, LotInventoryWithLocation } from "@/lib/api/lots";
import { LotStatus } from "@/types/database";
import { handleApiError } from "@/lib/utils/error-handler";

const getStatusBadge = (status: LotStatus) => {
  switch (status) {
    case "active":
      return (
        <Badge variant="success">
          <CheckCircle className="w-3 h-3 mr-1" />
          Active
        </Badge>
      );
    case "expired":
      return (
        <Badge variant="error">
          <XCircle className="w-3 h-3 mr-1" />
          Expired
        </Badge>
      );
    case "recalled":
      return (
        <Badge variant="error">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Recalled
        </Badge>
      );
    case "depleted":
      return (
        <Badge variant="default">
          <Package className="w-3 h-3 mr-1" />
          Depleted
        </Badge>
      );
    default:
      return <Badge>{status}</Badge>;
  }
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getDaysUntilExpiration = (expirationDate: string | null) => {
  if (!expirationDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = new Date(expirationDate);
  expDate.setHours(0, 0, 0, 0);
  const diffTime = expDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export default function LotDetailPage() {
  const params = useParams();
  const lotId = params.id as string;

  const [lot, setLot] = useState<LotWithInventory | null>(null);
  const [inventory, setInventory] = useState<LotInventoryWithLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [lotData, inventoryData] = await Promise.all([
        getLot(lotId),
        getLotInventory(lotId),
      ]);
      setLot(lotData);
      setInventory(inventoryData);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [lotId]);

  const getTotalQty = () => {
    return inventory.reduce((sum, inv) => sum + inv.qty_on_hand, 0);
  };

  const getTotalReserved = () => {
    return inventory.reduce((sum, inv) => sum + inv.qty_reserved, 0);
  };

  if (loading) {
    return (
      <AppShell title="Loading..." subtitle="Lot details">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-gray-200 rounded"></div>
          <Card>
            <div className="h-64 bg-gray-100 rounded"></div>
          </Card>
        </div>
      </AppShell>
    );
  }

  if (error || !lot) {
    return (
      <AppShell title="Lot Details" subtitle="View lot information">
        <FetchError
          message={error || "Lot not found"}
          onRetry={fetchData}
        />
      </AppShell>
    );
  }

  const daysUntil = getDaysUntilExpiration(lot.expiration_date);
  const isExpired = daysUntil !== null && daysUntil < 0;
  const isCritical = daysUntil !== null && daysUntil >= 0 && daysUntil <= 7;
  const isExpiringSoon = daysUntil !== null && daysUntil > 7 && daysUntil <= 30;

  return (
    <AppShell
      title={`Lot ${lot.lot_number}`}
      subtitle="Lot details and inventory"
      actions={
        <Link href={`/lots/${lot.id}/edit`}>
          <Button variant="secondary">Edit Lot</Button>
        </Link>
      }
    >
      <Breadcrumbs items={[
        { label: "Lots", href: "/lots" },
        { label: lot.lot_number || "Lot Details" }
      ]} />
      {/* Back Link */}
      <div className="mb-6">
        <Link
          href="/lots"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Lots
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lot Information */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Lot Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Lot Number</p>
                  <p className="text-gray-900 font-medium">{lot.lot_number}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Batch Number</p>
                  <p className="text-gray-900">{lot.batch_number || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Product</p>
                  <div>
                    <Link
                      href={`/products/${lot.product?.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {lot.product?.name}
                    </Link>
                    <p className="text-sm text-gray-500">{lot.product?.sku}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <div className="mt-1">{getStatusBadge(lot.status)}</div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Supplier</p>
                  <p className="text-gray-900">{lot.supplier || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Received Date</p>
                  <p className="text-gray-900">{formatDate(lot.received_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Manufacture Date</p>
                  <p className="text-gray-900">{formatDate(lot.manufacture_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Expiration Date</p>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        isExpired || isCritical
                          ? "text-red-600 font-medium"
                          : isExpiringSoon
                          ? "text-orange-600 font-medium"
                          : "text-gray-900"
                      }
                    >
                      {formatDate(lot.expiration_date)}
                    </span>
                    {daysUntil !== null && (
                      <span
                        className={`text-sm ${
                          isExpired
                            ? "text-red-600"
                            : isCritical
                            ? "text-red-600"
                            : isExpiringSoon
                            ? "text-orange-600"
                            : "text-gray-500"
                        }`}
                      >
                        {isExpired
                          ? `(${Math.abs(daysUntil)} days ago)`
                          : daysUntil === 0
                          ? "(Today)"
                          : `(${daysUntil} days)`}
                      </span>
                    )}
                    {isCritical && (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            {lot.notes && (
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm text-gray-500 mb-1">Notes</p>
                <p className="text-gray-900 whitespace-pre-wrap">{lot.notes}</p>
              </div>
            )}
          </Card>

          {/* Inventory by Location */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Inventory by Location
            </h2>
            {inventory.length === 0 ? (
              <EmptyState
                icon={<MapPin className="w-12 h-12" />}
                title="No inventory"
                description="This lot has no inventory at any location"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Location
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Sublocation
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">
                        Qty On Hand
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">
                        Qty Reserved
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">
                        Available
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((inv) => (
                      <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <Link
                            href={`/locations/${inv.location?.id}`}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {inv.location?.name || "-"}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {inv.sublocation ? (
                            <span title={inv.sublocation.name || inv.sublocation.code}>
                              {inv.sublocation.code}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-900 font-medium">
                          {inv.qty_on_hand.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600">
                          {inv.qty_reserved.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-900 font-medium">
                          {(inv.qty_on_hand - inv.qty_reserved).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                            onClick={() => {
                              // TODO: Open adjust inventory modal
                            }}
                          >
                            <Pencil className="w-4 h-4 mr-1" />
                            Adjust
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        Total
                      </td>
                      <td className="py-3 px-4"></td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-900">
                        {getTotalQty().toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-600">
                        {getTotalReserved().toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-900">
                        {(getTotalQty() - getTotalReserved()).toLocaleString()}
                      </td>
                      <td className="py-3 px-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>

          {/* Transaction History */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Transaction History
            </h2>
            <EmptyState
              icon={<History className="w-12 h-12" />}
              title="No transactions yet"
              description="Transaction history will appear here as inventory moves"
            />
          </Card>
        </div>

        {/* Sidebar - Quick Stats */}
        <div className="space-y-6">
          {/* Quick Stats Card */}
          <Card>
            <h3 className="text-sm font-medium text-gray-500 mb-4">Quick Stats</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-600">
                  <Package className="w-4 h-4" />
                  <span>Total Qty</span>
                </div>
                <span className="text-lg font-semibold text-gray-900">
                  {getTotalQty().toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>Reserved</span>
                </div>
                <span className="text-lg font-semibold text-gray-900">
                  {getTotalReserved().toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-600">
                  <CheckCircle className="w-4 h-4" />
                  <span>Available</span>
                </div>
                <span className="text-lg font-semibold text-green-600">
                  {(getTotalQty() - getTotalReserved()).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span>Locations</span>
                </div>
                <span className="text-lg font-semibold text-gray-900">
                  {inventory.length}
                </span>
              </div>
            </div>
          </Card>

          {/* Expiration Alert */}
          {lot.expiration_date && (isExpired || isCritical || isExpiringSoon) && (
            <Card>
              <div
                className={`p-4 rounded-lg ${
                  isExpired || isCritical
                    ? "bg-red-50 border border-red-200"
                    : "bg-orange-50 border border-orange-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    className={`w-5 h-5 mt-0.5 ${
                      isExpired || isCritical ? "text-red-500" : "text-orange-500"
                    }`}
                  />
                  <div>
                    <h4
                      className={`font-medium ${
                        isExpired || isCritical ? "text-red-800" : "text-orange-800"
                      }`}
                    >
                      {isExpired ? "Lot Expired" : "Expiring Soon"}
                    </h4>
                    <p
                      className={`text-sm mt-1 ${
                        isExpired || isCritical ? "text-red-600" : "text-orange-600"
                      }`}
                    >
                      {isExpired
                        ? `This lot expired ${Math.abs(daysUntil!)} days ago.`
                        : daysUntil === 0
                        ? "This lot expires today."
                        : `This lot expires in ${daysUntil} days.`}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Dates Card */}
          <Card>
            <h3 className="text-sm font-medium text-gray-500 mb-4">Key Dates</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Created</p>
                  <p className="text-sm text-gray-900">{formatDate(lot.created_at)}</p>
                </div>
              </div>
              {lot.received_date && (
                <div className="flex items-center gap-3">
                  <Truck className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Received</p>
                    <p className="text-sm text-gray-900">{formatDate(lot.received_date)}</p>
                  </div>
                </div>
              )}
              {lot.manufacture_date && (
                <div className="flex items-center gap-3">
                  <Package className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Manufactured</p>
                    <p className="text-sm text-gray-900">{formatDate(lot.manufacture_date)}</p>
                  </div>
                </div>
              )}
              {lot.expiration_date && (
                <div className="flex items-center gap-3">
                  <AlertTriangle
                    className={`w-4 h-4 ${
                      isExpired || isCritical
                        ? "text-red-500"
                        : isExpiringSoon
                        ? "text-orange-500"
                        : "text-gray-400"
                    }`}
                  />
                  <div>
                    <p className="text-xs text-gray-500">Expires</p>
                    <p
                      className={`text-sm ${
                        isExpired || isCritical
                          ? "text-red-600 font-medium"
                          : isExpiringSoon
                          ? "text-orange-600 font-medium"
                          : "text-gray-900"
                      }`}
                    >
                      {formatDate(lot.expiration_date)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
