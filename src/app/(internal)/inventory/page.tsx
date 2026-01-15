"use client";

import { useEffect, useMemo, useState } from "react";
import { PackagePlus, Package, Boxes, DollarSign, AlertTriangle, XCircle, ScanLine } from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Select from "@/components/ui/Select";
import FetchError from "@/components/ui/FetchError";
import { getInventory, InventoryWithDetails } from "@/lib/api/inventory";
import { getLocations, Location } from "@/lib/api/locations";
import { handleApiError } from "@/lib/utils/error-handler";
import StockAdjustmentModal from "@/components/internal/StockAdjustmentModal";
import ScannerModal from "@/components/internal/ScannerModal";
import Pagination from "@/components/ui/Pagination";
import { BarcodeProduct } from "@/lib/api/barcode";

const ITEMS_PER_PAGE = 25;

function getStockStatus(item: InventoryWithDetails): {
  label: string;
  variant: "success" | "warning" | "error";
} {
  if (item.qty_on_hand === 0) {
    return { label: "Out", variant: "error" };
  }
  if (item.qty_on_hand <= item.product.reorder_point) {
    return { label: "Low", variant: "warning" };
  }
  return { label: "OK", variant: "success" };
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryWithDetails[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryWithDetails | null>(null);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannedProductId, setScannedProductId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [inventoryData, locationsData] = await Promise.all([
        getInventory(),
        getLocations(),
      ]);
      setInventory(inventoryData);
      setLocations(locationsData);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdjustmentComplete = () => {
    fetchData();
  };

  const openAdjustmentModal = (item?: InventoryWithDetails) => {
    setSelectedItem(item || null);
    setShowAdjustmentModal(true);
  };

  const closeAdjustmentModal = () => {
    setSelectedItem(null);
    setScannedProductId(null);
    setShowAdjustmentModal(false);
  };

  const handleProductScanned = (product: BarcodeProduct) => {
    setScannedProductId(product.id);
    setShowScannerModal(false);
    setShowAdjustmentModal(true);
  };

  const locationOptions = useMemo(() => {
    return locations.map((loc) => ({ value: loc.id, label: loc.name }));
  }, [locations]);

  const statusOptions = [
    { value: "low", label: "Low Stock" },
    { value: "out", label: "Out of Stock" },
  ];

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      // Location filter
      if (selectedLocation && item.location_id !== selectedLocation) {
        return false;
      }
      // Status filter
      if (selectedStatus) {
        const status = getStockStatus(item);
        if (selectedStatus === "low" && status.label !== "Low") {
          return false;
        }
        if (selectedStatus === "out" && status.label !== "Out") {
          return false;
        }
      }
      return true;
    });
  }, [inventory, selectedLocation, selectedStatus]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLocation, selectedStatus]);

  // Paginate the filtered results
  const paginatedInventory = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredInventory.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredInventory, currentPage]);

  const summaryStats = useMemo(() => {
    const uniqueProducts = new Set(inventory.map((item) => item.product_id));
    const totalUnits = inventory.reduce((sum, item) => sum + item.qty_on_hand, 0);
    const inventoryValue = inventory.reduce(
      (sum, item) => sum + item.qty_on_hand * item.product.unit_cost,
      0
    );
    const lowStockCount = inventory.filter(
      (item) => item.qty_on_hand > 0 && item.qty_on_hand <= item.product.reorder_point
    ).length;
    const outOfStockCount = inventory.filter((item) => item.qty_on_hand === 0).length;

    return {
      totalSKUs: uniqueProducts.size,
      totalUnits,
      inventoryValue,
      lowStockCount,
      outOfStockCount,
    };
  }, [inventory]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("en-US").format(value);
  };

  const actionButtons = (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={() => setShowScannerModal(true)}>
        <ScanLine className="w-4 h-4 mr-1" />
        Scan Barcode
      </Button>
      <Button onClick={() => openAdjustmentModal()}>
        <PackagePlus className="w-4 h-4 mr-1" />
        Stock Adjustment
      </Button>
    </div>
  );

  const columns = [
    {
      key: "product",
      header: "Product",
      render: (item: InventoryWithDetails) => (
        <div>
          <div className="font-medium text-gray-900">{item.product.name}</div>
          <div className="text-sm text-gray-500">{item.product.sku}</div>
        </div>
      ),
    },
    {
      key: "location",
      header: "Location",
      render: (item: InventoryWithDetails) => (
        <div>
          <div className="text-gray-900">{item.location.name}</div>
          {(item.location.city || item.location.state) && (
            <div className="text-sm text-gray-500">
              {[item.location.city, item.location.state].filter(Boolean).join(", ")}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "qty_on_hand",
      header: "On Hand",
      render: (item: InventoryWithDetails) => (
        <span className="font-medium">{item.qty_on_hand}</span>
      ),
    },
    {
      key: "qty_reserved",
      header: "Reserved",
      render: (item: InventoryWithDetails) => (
        <span className="text-yellow-600">{item.qty_reserved}</span>
      ),
    },
    {
      key: "available",
      header: "Available",
      render: (item: InventoryWithDetails) => {
        const available = item.qty_on_hand - item.qty_reserved;
        return (
          <span
            className={`font-semibold ${
              available <= 0 ? "text-red-600" : "text-green-600"
            }`}
          >
            {available}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (item: InventoryWithDetails) => {
        const status = getStockStatus(item);
        return <Badge variant={status.variant}>{status.label}</Badge>;
      },
    },
    {
      key: "actions",
      header: "",
      render: (item: InventoryWithDetails) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            openAdjustmentModal(item);
          }}
        >
          Adjust
        </Button>
      ),
    },
  ];

  if (error) {
    return (
      <AppShell title="Inventory">
        <FetchError message={error} onRetry={fetchData} />
      </AppShell>
    );
  }

  return (
    <AppShell title="Inventory" actions={actionButtons}>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total SKUs</p>
              <p className="text-xl font-semibold text-gray-900">
                {formatNumber(summaryStats.totalSKUs)}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Boxes className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Units</p>
              <p className="text-xl font-semibold text-gray-900">
                {formatNumber(summaryStats.totalUnits)}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Inventory Value</p>
              <p className="text-xl font-semibold text-gray-900">
                {formatCurrency(summaryStats.inventoryValue)}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Low Stock</p>
              <p className="text-xl font-semibold text-yellow-600">
                {formatNumber(summaryStats.lowStockCount)}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Out of Stock</p>
              <p className="text-xl font-semibold text-red-600">
                {formatNumber(summaryStats.outOfStockCount)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="mb-4 flex gap-4">
        <div className="w-64">
          <Select
            name="location"
            options={locationOptions}
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            placeholder="All Locations"
          />
        </div>
        <div className="w-48">
          <Select
            name="status"
            options={statusOptions}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            placeholder="All Statuses"
          />
        </div>
      </div>
      <Card padding="none">
        <Table
          columns={columns}
          data={paginatedInventory}
          loading={loading}
          emptyMessage="No inventory records found"
        />
        <Pagination
          currentPage={currentPage}
          totalItems={filteredInventory.length}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
        />
      </Card>

      <StockAdjustmentModal
        isOpen={showAdjustmentModal}
        onClose={closeAdjustmentModal}
        onComplete={handleAdjustmentComplete}
        preselectedProduct={scannedProductId || selectedItem?.product_id}
        preselectedLocation={selectedItem?.location_id}
      />

      <ScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onProductFound={handleProductScanned}
      />
    </AppShell>
  );
}
