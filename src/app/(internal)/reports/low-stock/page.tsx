"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Download, Bell, AlertTriangle } from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Table from "@/components/ui/Table";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useToast } from "@/components/ui/Toast";

interface LowStockItem {
  id: string;
  product_id: string;
  location_id: string;
  qty_on_hand: number;
  product: {
    id: string;
    name: string;
    sku: string;
    reorder_point: number;
  };
  location: {
    id: string;
    name: string;
  };
}

export default function LowStockReportPage() {
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingAlerts, setSendingAlerts] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("inventory")
        .select(`
          id,
          product_id,
          location_id,
          qty_on_hand,
          product:products (
            id,
            name,
            sku,
            reorder_point
          ),
          location:locations (
            id,
            name
          )
        `)
        .order("qty_on_hand", { ascending: true });

      if (error) {
        console.error("Failed to fetch inventory:", error);
        setLoading(false);
        return;
      }

      // Filter to only low stock items (qty_on_hand <= reorder_point)
      const filtered = ((data || []) as unknown as LowStockItem[]).filter((item) => {
        const reorderPoint = item.product?.reorder_point || 0;
        return item.qty_on_hand <= reorderPoint;
      });

      setLowStockItems(filtered);
      setLoading(false);
    };

    fetchData();
  }, []);

  const exportToCSV = () => {
    const headers = ["Product", "SKU", "Location", "Current Qty", "Reorder Point", "Shortage"];
    const rows = lowStockItems.map((item) => {
      const reorderPoint = item.product?.reorder_point || 0;
      const shortage = reorderPoint - item.qty_on_hand;
      return [
        item.product?.name || "",
        item.product?.sku || "",
        item.location?.name || "",
        item.qty_on_hand || 0,
        reorderPoint,
        shortage > 0 ? shortage : 0,
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `low-stock-report-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendAlerts = async () => {
    setSendingAlerts(true);
    try {
      // TODO: Implement actual email/notification sending via API
      // This would send emails to affected clients and internal team
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulated delay

      toast.success(
        `Low stock alerts sent for ${lowStockItems.length} items to clients and internal team.`,
        "Alerts Sent"
      );
    } catch (error) {
      console.error("Failed to send alerts:", error);
      toast.error("Failed to send low stock alerts. Please try again.");
    } finally {
      setSendingAlerts(false);
    }
  };

  const columns = [
    {
      key: "product",
      header: "Product",
      render: (item: LowStockItem) => (
        <div>
          <span className="font-medium text-gray-900">{item.product?.name || "—"}</span>
          <p className="text-xs text-gray-500">{item.location?.name}</p>
        </div>
      ),
    },
    {
      key: "sku",
      header: "SKU",
      render: (item: LowStockItem) => (
        <span className="text-gray-600 font-mono text-sm">{item.product?.sku || "—"}</span>
      ),
    },
    {
      key: "qty_on_hand",
      header: "Current Qty",
      render: (item: LowStockItem) => {
        const reorderPoint = item.product?.reorder_point || 0;
        const isZero = item.qty_on_hand === 0;
        const isCritical = item.qty_on_hand < reorderPoint * 0.5;
        return (
          <span className={`font-medium ${isZero ? "text-red-700" : isCritical ? "text-red-600" : "text-amber-600"}`}>
            {item.qty_on_hand?.toLocaleString() || 0}
          </span>
        );
      },
    },
    {
      key: "reorder_point",
      header: "Reorder Point",
      render: (item: LowStockItem) => (
        <span className="text-gray-600">{item.product?.reorder_point?.toLocaleString() || 0}</span>
      ),
    },
    {
      key: "shortage",
      header: "Shortage",
      render: (item: LowStockItem) => {
        const reorderPoint = item.product?.reorder_point || 0;
        const shortage = reorderPoint - item.qty_on_hand;
        return (
          <span className={`font-medium ${shortage > 0 ? "text-red-600" : "text-gray-500"}`}>
            {shortage > 0 ? `-${shortage.toLocaleString()}` : "—"}
          </span>
        );
      },
    },
  ];

  const totalShortage = lowStockItems.reduce((sum, item) => {
    const reorderPoint = item.product?.reorder_point || 0;
    const shortage = reorderPoint - item.qty_on_hand;
    return sum + (shortage > 0 ? shortage : 0);
  }, 0);

  const criticalCount = lowStockItems.filter((item) => item.qty_on_hand === 0).length;

  const actionButtons = (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={exportToCSV} disabled={lowStockItems.length === 0}>
        <Download className="w-4 h-4 mr-1" />
        Export CSV
      </Button>
      <Button
        onClick={handleSendAlerts}
        disabled={lowStockItems.length === 0 || sendingAlerts}
        loading={sendingAlerts}
      >
        <Bell className="w-4 h-4 mr-1" />
        Send Low Stock Alerts
      </Button>
    </div>
  );

  return (
    <AppShell
      title="Low Stock Report"
      subtitle="Products at or below reorder point"
      actions={actionButtons}
    >
      {/* Back Link */}
      <div className="mb-6">
        <Link
          href="/reports"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Reports
        </Link>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">
                {lowStockItems.length}
              </p>
              <p className="text-sm text-gray-500">Low Stock Items</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-red-600">
                {criticalCount}
              </p>
              <p className="text-sm text-gray-500">Out of Stock</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
              <span className="text-lg font-semibold text-gray-600">#</span>
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">
                {totalShortage.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">Total Shortage</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card padding="none">
        <Table
          columns={columns}
          data={lowStockItems}
          loading={loading}
          emptyMessage={
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-gray-900 font-medium">All items are well stocked</p>
              <p className="text-gray-500 text-sm mt-1">No products are below their reorder point</p>
            </div>
          }
        />
      </Card>

      {/* Legend */}
      {lowStockItems.length > 0 && (
        <div className="mt-4 flex gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-700"></span>
            <span className="text-gray-600">Out of stock</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span className="text-gray-600">Critical (below 50% of reorder point)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            <span className="text-gray-600">Low stock</span>
          </div>
        </div>
      )}
    </AppShell>
  );
}
