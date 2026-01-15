"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Table from "@/components/ui/Table";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

interface InventoryRow {
  id: string;
  product_id: string;
  location_id: string;
  qty_on_hand: number;
  qty_reserved: number;
  product: {
    id: string;
    name: string;
    sku: string;
  };
  location: {
    id: string;
    name: string;
  };
}

interface Location {
  id: string;
  name: string;
}

export default function InventorySummaryReportPage() {
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      // Fetch locations for filter
      const { data: locationsData } = await supabase
        .from("locations")
        .select("id, name")
        .order("name");

      setLocations(locationsData || []);

      // Fetch inventory with product and location details
      const { data: inventoryData, error } = await supabase
        .from("inventory")
        .select(`
          id,
          product_id,
          location_id,
          qty_on_hand,
          qty_reserved,
          product:products (
            id,
            name,
            sku
          ),
          location:locations (
            id,
            name
          )
        `)
        .order("product_id");

      if (error) {
        console.error("Failed to fetch inventory:", error);
      } else {
        setInventory((inventoryData || []) as unknown as InventoryRow[]);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  const filteredInventory = useMemo(() => {
    if (!selectedLocation) return inventory;
    return inventory.filter((item) => item.location_id === selectedLocation);
  }, [inventory, selectedLocation]);

  const totals = useMemo(() => {
    return filteredInventory.reduce(
      (acc, item) => ({
        qty_on_hand: acc.qty_on_hand + (item.qty_on_hand || 0),
        qty_reserved: acc.qty_reserved + (item.qty_reserved || 0),
        available: acc.available + ((item.qty_on_hand || 0) - (item.qty_reserved || 0)),
      }),
      { qty_on_hand: 0, qty_reserved: 0, available: 0 }
    );
  }, [filteredInventory]);

  const locationOptions = [
    { value: "", label: "All Locations" },
    ...locations.map((loc) => ({ value: loc.id, label: loc.name })),
  ];

  const exportToCSV = () => {
    const headers = ["Product", "SKU", "Location", "Qty on Hand", "Reserved", "Available"];
    const rows = filteredInventory.map((item) => [
      item.product?.name || "",
      item.product?.sku || "",
      item.location?.name || "",
      item.qty_on_hand || 0,
      item.qty_reserved || 0,
      (item.qty_on_hand || 0) - (item.qty_reserved || 0),
    ]);

    // Add totals row
    rows.push(["TOTAL", "", "", totals.qty_on_hand, totals.qty_reserved, totals.available]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `inventory-summary-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = [
    {
      key: "product",
      header: "Product",
      render: (item: InventoryRow) => (
        <span className="font-medium text-gray-900">{item.product?.name || "—"}</span>
      ),
    },
    {
      key: "sku",
      header: "SKU",
      render: (item: InventoryRow) => (
        <span className="text-gray-600 font-mono text-sm">{item.product?.sku || "—"}</span>
      ),
    },
    {
      key: "location",
      header: "Location",
      render: (item: InventoryRow) => (
        <span className="text-gray-600">{item.location?.name || "—"}</span>
      ),
    },
    {
      key: "qty_on_hand",
      header: "Qty on Hand",
      render: (item: InventoryRow) => (
        <span className="text-gray-900 font-medium">{item.qty_on_hand?.toLocaleString() || 0}</span>
      ),
    },
    {
      key: "qty_reserved",
      header: "Reserved",
      render: (item: InventoryRow) => (
        <span className={item.qty_reserved > 0 ? "text-amber-600 font-medium" : "text-gray-500"}>
          {item.qty_reserved?.toLocaleString() || 0}
        </span>
      ),
    },
    {
      key: "available",
      header: "Available",
      render: (item: InventoryRow) => {
        const available = (item.qty_on_hand || 0) - (item.qty_reserved || 0);
        return (
          <span className={available > 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
            {available.toLocaleString()}
          </span>
        );
      },
    },
  ];

  const actionButtons = (
    <Button onClick={exportToCSV} disabled={filteredInventory.length === 0}>
      <Download className="w-4 h-4 mr-1" />
      Export CSV
    </Button>
  );

  return (
    <AppShell
      title="Inventory Summary"
      subtitle="Current stock levels by product and location"
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

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-64">
            <Select
              label="Location"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              options={locationOptions}
            />
          </div>
          <div className="text-sm text-gray-500">
            Showing {filteredInventory.length} of {inventory.length} records
          </div>
        </div>
      </Card>

      {/* Table */}
      <div className="mt-6">
        <Card padding="none">
          <Table
            columns={columns}
            data={filteredInventory}
            loading={loading}
            emptyMessage="No inventory records found"
          />
          {/* Totals Row */}
          {filteredInventory.length > 0 && (
            <div className="border-t-2 border-gray-300 bg-gray-50 px-6 py-3">
              <div className="flex">
                <div className="flex-1 font-semibold text-gray-900">TOTAL</div>
                <div className="flex-1"></div>
                <div className="flex-1"></div>
                <div className="flex-1 font-semibold text-gray-900">
                  {totals.qty_on_hand.toLocaleString()}
                </div>
                <div className="flex-1 font-semibold text-amber-600">
                  {totals.qty_reserved.toLocaleString()}
                </div>
                <div className="flex-1 font-semibold text-green-600">
                  {totals.available.toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="text-center">
            <p className="text-3xl font-semibold text-gray-900">
              {totals.qty_on_hand.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 mt-1">Total Units</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-3xl font-semibold text-amber-600">
              {totals.qty_reserved.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 mt-1">Reserved</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-3xl font-semibold text-green-600">
              {totals.available.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 mt-1">Available</p>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
