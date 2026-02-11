"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PackagePlus, Package, Boxes, DollarSign, AlertTriangle, XCircle, ScanLine, Grid3X3, MoveRight, ChevronDown, ChevronRight, RefreshCw, ExternalLink, FileWarning, MapPin, Building2, Upload } from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import Alert from "@/components/ui/Alert";
import FetchError from "@/components/ui/FetchError";
import { getInventory, InventoryWithDetails, moveInventoryToSublocation, updateInventoryStatus } from "@/lib/api/inventory";
import { getLocations, Location, getLocationsByType } from "@/lib/api/locations";
import { getClients, Client } from "@/lib/api/clients";
import { getSublocations, SublocationWithLocation } from "@/lib/api/sublocations";
import { getDamageReportsByProduct, DamageReportWithProduct } from "@/lib/api/damage-reports";
import { handleApiError } from "@/lib/utils/error-handler";
import StockAdjustmentModal from "@/components/internal/StockAdjustmentModal";
import ScannerModal from "@/components/internal/ScannerModal";
import Pagination from "@/components/ui/Pagination";
import { BarcodeProduct } from "@/lib/api/barcode";
import { InventoryStatus, LocationType } from "@/types/database";

type InventoryTab = "all" | "damaged" | "quarantine" | "byLocation";

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

// Inventory status display helpers
function getInventoryStatusDisplay(status: InventoryStatus): {
  label: string;
  variant: "success" | "warning" | "error" | "info" | "default";
  bgClass: string;
  textClass: string;
} {
  const statusMap: Record<InventoryStatus, { label: string; variant: "success" | "warning" | "error" | "info" | "default"; bgClass: string; textClass: string }> = {
    available: { label: "Available", variant: "success", bgClass: "bg-green-100", textClass: "text-green-700" },
    damaged: { label: "Damaged", variant: "error", bgClass: "bg-red-100", textClass: "text-red-700" },
    quarantine: { label: "Quarantine", variant: "warning", bgClass: "bg-yellow-100", textClass: "text-yellow-700" },
    reserved: { label: "Reserved", variant: "info", bgClass: "bg-blue-100", textClass: "text-blue-700" },
    returned: { label: "Returned", variant: "default", bgClass: "bg-purple-100", textClass: "text-purple-700" },
  };
  return statusMap[status] || statusMap.available;
}

export default function InventoryPage() {
  const router = useRouter();
  const [inventory, setInventory] = useState<InventoryWithDetails[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [sublocations, setSublocations] = useState<SublocationWithLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedSublocation, setSelectedSublocation] = useState("");
  const [selectedStockLevel, setSelectedStockLevel] = useState("");
  const [selectedInventoryStatus, setSelectedInventoryStatus] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryWithDetails | null>(null);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannedProductId, setScannedProductId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  // Tab navigation
  const [activeTab, setActiveTab] = useState<InventoryTab>("all");
  const [damagedGoodsLocations, setDamagedGoodsLocations] = useState<Location[]>([]);
  const [damageReports, setDamageReports] = useState<Map<string, DamageReportWithProduct[]>>(new Map());
  // Move to sublocation modal
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveItem, setMoveItem] = useState<InventoryWithDetails | null>(null);
  const [moveTargetSublocation, setMoveTargetSublocation] = useState("");
  const [moveQuantity, setMoveQuantity] = useState<number>(0);
  const [moveNotes, setMoveNotes] = useState("");
  const [moveLoading, setMoveLoading] = useState(false);
  const [moveSuccess, setMoveSuccess] = useState("");
  const [moveError, setMoveError] = useState("");
  // Collapse sublocation column on smaller screens
  const [showSublocationColumn, setShowSublocationColumn] = useState(true);
  // Change status modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusItem, setStatusItem] = useState<InventoryWithDetails | null>(null);
  const [newStatus, setNewStatus] = useState<InventoryStatus>("available");
  const [statusNotes, setStatusNotes] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [statusSuccess, setStatusSuccess] = useState("");
  // Move to damaged goods location modal
  const [showMoveToDamagedModal, setShowMoveToDamagedModal] = useState(false);
  const [moveToDamagedItem, setMoveToDamagedItem] = useState<InventoryWithDetails | null>(null);
  const [selectedDamagedLocation, setSelectedDamagedLocation] = useState("");
  const [moveToDamagedLoading, setMoveToDamagedLoading] = useState(false);
  const [moveToDamagedError, setMoveToDamagedError] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [inventoryData, locationsData, sublocationsData, damagedLocationsData, clientsData] = await Promise.all([
        getInventory(),
        getLocations(),
        getSublocations(),
        getLocationsByType("damaged_goods" as LocationType),
        getClients(),
      ]);
      setInventory(inventoryData);
      setLocations(locationsData);
      setSublocations(sublocationsData);
      setDamagedGoodsLocations(damagedLocationsData);
      setClients(clientsData.filter(c => c.active));

      // Fetch damage reports for damaged items
      const damagedItems = inventoryData.filter(item => item.status === "damaged");
      const productIds = [...new Set(damagedItems.map(item => item.product_id))];

      const reportsMap = new Map<string, DamageReportWithProduct[]>();
      await Promise.all(
        productIds.map(async (productId) => {
          try {
            const reports = await getDamageReportsByProduct(productId);
            reportsMap.set(productId, reports);
          } catch {
            // Ignore errors for individual product reports
          }
        })
      );
      setDamageReports(reportsMap);
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

  // Filter sublocations based on selected location
  const sublocationOptions = useMemo(() => {
    let filtered = sublocations.filter((s) => s.is_active);
    if (selectedLocation) {
      filtered = filtered.filter((s) => s.location_id === selectedLocation);
    }
    return [
      { value: "unassigned", label: "Unassigned" },
      ...filtered.map((s) => ({
        value: s.id,
        label: s.zone ? `${s.zone} - ${s.code}` : s.code,
      })),
    ];
  }, [sublocations, selectedLocation]);

  // Sublocations available for move modal (filtered by the item's location)
  const moveSublocationsOptions = useMemo(() => {
    if (!moveItem) return [];
    return sublocations
      .filter((s) => s.is_active && s.location_id === moveItem.location_id)
      .map((s) => ({
        value: s.id,
        label: `${s.code}${s.name ? ` - ${s.name}` : ""}${s.zone ? ` (Zone ${s.zone})` : ""}`,
      }));
  }, [sublocations, moveItem]);

  const clientOptions = useMemo(() => {
    // Only show clients that have inventory
    const clientIdsInInventory = new Set(
      inventory.map((item) => item.product.client_id).filter(Boolean)
    );
    const hasUnassigned = inventory.some((item) => !item.product.client_id);
    const opts = clients
      .filter((c) => clientIdsInInventory.has(c.id))
      .map((c) => ({ value: c.id, label: c.company_name }));
    if (hasUnassigned) {
      opts.push({ value: "no_client", label: "No Client" });
    }
    return opts;
  }, [clients, inventory]);

  const stockLevelOptions = [
    { value: "low", label: "Low Stock" },
    { value: "out", label: "Out of Stock" },
  ];

  const inventoryStatusOptions = [
    { value: "available", label: "Available" },
    { value: "damaged", label: "Damaged" },
    { value: "quarantine", label: "Quarantine" },
    { value: "reserved", label: "Reserved" },
    { value: "returned", label: "Returned" },
  ];

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      // Tab-based filtering first
      if (activeTab === "damaged" && item.status !== "damaged") {
        return false;
      }
      if (activeTab === "quarantine" && item.status !== "quarantine") {
        return false;
      }
      // Location filter
      if (selectedLocation && item.location_id !== selectedLocation) {
        return false;
      }
      // Sublocation filter
      if (selectedSublocation) {
        if (selectedSublocation === "unassigned") {
          if (item.sublocation_id !== null) return false;
        } else {
          if (item.sublocation_id !== selectedSublocation) return false;
        }
      }
      // Stock level filter (only apply on "all" tab)
      if (activeTab === "all" && selectedStockLevel) {
        const status = getStockStatus(item);
        if (selectedStockLevel === "low" && status.label !== "Low") {
          return false;
        }
        if (selectedStockLevel === "out" && status.label !== "Out") {
          return false;
        }
      }
      // Inventory status filter (only apply on "all" tab since other tabs already filter by status)
      if (activeTab === "all" && selectedInventoryStatus && item.status !== selectedInventoryStatus) {
        return false;
      }
      // Client filter
      if (selectedClient) {
        if (selectedClient === "no_client") {
          if (item.product.client_id !== null) return false;
        } else {
          if (item.product.client_id !== selectedClient) return false;
        }
      }
      return true;
    });
  }, [inventory, selectedLocation, selectedSublocation, selectedStockLevel, selectedInventoryStatus, selectedClient, activeTab]);

  // Group inventory by location for "By Location" tab
  const inventoryByLocation = useMemo(() => {
    const grouped = new Map<string, { location: Location; items: InventoryWithDetails[] }>();

    inventory.forEach(item => {
      const locationId = item.location_id;
      if (!grouped.has(locationId)) {
        const location = locations.find(l => l.id === locationId);
        if (location) {
          grouped.set(locationId, { location, items: [] });
        }
      }
      grouped.get(locationId)?.items.push(item);
    });

    return Array.from(grouped.values()).sort((a, b) => a.location.name.localeCompare(b.location.name));
  }, [inventory, locations]);

  // Reset to page 1 when filters or tab change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLocation, selectedSublocation, selectedStockLevel, selectedInventoryStatus, selectedClient, activeTab]);

  // Clear status filter when switching to damaged/quarantine tabs
  useEffect(() => {
    if (activeTab === "damaged" || activeTab === "quarantine") {
      setSelectedInventoryStatus("");
    }
  }, [activeTab]);

  // Reset sublocation filter when location changes
  useEffect(() => {
    setSelectedSublocation("");
  }, [selectedLocation]);

  // Move to sublocation handlers
  const openMoveModal = (item: InventoryWithDetails) => {
    setMoveItem(item);
    setMoveTargetSublocation("");
    setMoveQuantity(item.qty_on_hand); // Default to all units
    setMoveNotes("");
    setMoveError("");
    setShowMoveModal(true);
  };

  const closeMoveModal = () => {
    setShowMoveModal(false);
    setMoveItem(null);
    setMoveTargetSublocation("");
    setMoveQuantity(0);
    setMoveNotes("");
    setMoveError("");
  };

  const handleMove = async () => {
    if (!moveItem) return;

    if (moveQuantity <= 0) {
      setMoveError("Please enter a quantity greater than 0");
      return;
    }

    if (moveQuantity > moveItem.qty_on_hand) {
      setMoveError(`Cannot move more than ${moveItem.qty_on_hand} units`);
      return;
    }

    setMoveLoading(true);
    setMoveError("");

    try {
      const result = await moveInventoryToSublocation({
        sourceInventoryId: moveItem.id,
        targetSublocationId: moveTargetSublocation || null,
        quantity: moveQuantity,
        notes: moveNotes || undefined,
      });
      setMoveSuccess(result.message);
      setTimeout(() => setMoveSuccess(""), 3000);
      closeMoveModal();
      fetchData();
    } catch (err) {
      setMoveError(handleApiError(err));
    } finally {
      setMoveLoading(false);
    }
  };

  // Change status handlers
  const openStatusModal = (item: InventoryWithDetails) => {
    setStatusItem(item);
    setNewStatus(item.status || "available");
    setStatusNotes("");
    setStatusError("");
    setShowStatusModal(true);
  };

  const closeStatusModal = () => {
    setShowStatusModal(false);
    setStatusItem(null);
    setNewStatus("available");
    setStatusNotes("");
    setStatusError("");
  };

  const handleStatusChange = async () => {
    if (!statusItem) return;

    // Require notes for damaged and quarantine status
    if ((newStatus === "damaged" || newStatus === "quarantine") && !statusNotes.trim()) {
      setStatusError(`Notes are required when changing status to ${newStatus}`);
      return;
    }

    // No change needed
    if (newStatus === statusItem.status) {
      setStatusError("Please select a different status");
      return;
    }

    setStatusLoading(true);
    setStatusError("");

    try {
      await updateInventoryStatus(
        statusItem.id,
        newStatus,
        statusNotes.trim() || null
      );
      setStatusSuccess(`Status changed to ${getInventoryStatusDisplay(newStatus).label}`);
      setTimeout(() => setStatusSuccess(""), 3000);
      closeStatusModal();
      fetchData();
    } catch (err) {
      setStatusError(handleApiError(err));
    } finally {
      setStatusLoading(false);
    }
  };

  // Move to Damaged Goods Location handlers
  const openMoveToDamagedModal = (item: InventoryWithDetails) => {
    setMoveToDamagedItem(item);
    setSelectedDamagedLocation("");
    setMoveToDamagedError("");
    setShowMoveToDamagedModal(true);
  };

  const closeMoveToDamagedModal = () => {
    setShowMoveToDamagedModal(false);
    setMoveToDamagedItem(null);
    setSelectedDamagedLocation("");
    setMoveToDamagedError("");
  };

  const handleMoveToDamagedLocation = async () => {
    if (!moveToDamagedItem || !selectedDamagedLocation) return;

    setMoveToDamagedLoading(true);
    setMoveToDamagedError("");

    try {
      // Use the same inventory transfer approach - update location_id directly
      const supabase = (await import("@/lib/supabase")).createClient();

      const { error: updateError } = await supabase
        .from("inventory")
        .update({
          location_id: selectedDamagedLocation,
          sublocation_id: null, // Clear sublocation when moving to different location
        })
        .eq("id", moveToDamagedItem.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Log the move
      await supabase.from("activity_log").insert({
        entity_type: "inventory",
        entity_id: moveToDamagedItem.id,
        action: "moved_to_damaged_goods",
        details: {
          product_id: moveToDamagedItem.product_id,
          from_location_id: moveToDamagedItem.location_id,
          to_location_id: selectedDamagedLocation,
          quantity: moveToDamagedItem.qty_on_hand,
        },
      });

      setMoveSuccess("Inventory moved to damaged goods location");
      setTimeout(() => setMoveSuccess(""), 3000);
      closeMoveToDamagedModal();
      fetchData();
    } catch (err) {
      setMoveToDamagedError(handleApiError(err));
    } finally {
      setMoveToDamagedLoading(false);
    }
  };

  // Get damage report for a product
  const getDamageReportForProduct = (productId: string): DamageReportWithProduct | null => {
    const reports = damageReports.get(productId);
    if (reports && reports.length > 0) {
      return reports[0]; // Return most recent report
    }
    return null;
  };

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
    const damagedCount = inventory.filter((item) => item.status === "damaged").length;
    const quarantineCount = inventory.filter((item) => item.status === "quarantine").length;

    return {
      totalSKUs: uniqueProducts.size,
      totalUnits,
      inventoryValue,
      lowStockCount,
      outOfStockCount,
      damagedCount,
      quarantineCount,
    };
  }, [inventory]);

  const tabs: { key: InventoryTab; label: string; count?: number; icon: React.ReactNode }[] = [
    { key: "all", label: "All Inventory", icon: <Boxes className="w-4 h-4" /> },
    { key: "damaged", label: "Damaged", count: summaryStats.damagedCount, icon: <AlertTriangle className="w-4 h-4" /> },
    { key: "quarantine", label: "Quarantine", count: summaryStats.quarantineCount, icon: <XCircle className="w-4 h-4" /> },
    { key: "byLocation", label: "By Location", icon: <MapPin className="w-4 h-4" /> },
  ];

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
      <Button variant="secondary" onClick={() => router.push("/inventory/import")}>
        <Upload className="w-4 h-4 mr-1" />
        Import Spreadsheet
      </Button>
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

  const columns = useMemo(() => {
    const baseColumns = [
      {
        key: "product",
        header: "Product",
        mobilePriority: 1,
        render: (item: InventoryWithDetails) => {
          const client = item.product.client_id ? clients.find(c => c.id === item.product.client_id) : null;
          return (
            <div>
              <div className="font-medium text-gray-900">{item.product.name}</div>
              <div className="text-sm text-gray-500">
                {item.product.sku}
                {client && <span className="ml-2 text-gray-400">· {client.company_name}</span>}
              </div>
            </div>
          );
        },
      },
      {
        key: "location",
        header: "Location",
        mobilePriority: 2,
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
    ];

    // Add sublocation column if enabled
    const sublocationColumn = showSublocationColumn ? [
      {
        key: "sublocation",
        header: (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSublocationColumn(false);
            }}
            className="flex items-center gap-1 text-gray-900 hover:text-gray-600"
            title="Hide sublocation column"
          >
            Sublocation
            <ChevronDown className="w-3 h-3" />
          </button>
        ),
        hideOnMobile: true,
        render: (item: InventoryWithDetails) => (
          <div className="flex items-center gap-2">
            {item.sublocation ? (
              <div>
                <div className="flex items-center gap-1.5">
                  <Grid3X3 className="w-3.5 h-3.5 text-purple-500" />
                  <span className="font-mono text-sm font-medium text-gray-900">
                    {item.sublocation.code}
                  </span>
                </div>
                {item.sublocation.zone && (
                  <span className="text-xs text-gray-500">Zone {item.sublocation.zone}</span>
                )}
              </div>
            ) : (
              <span className="text-gray-400 text-sm">Unassigned</span>
            )}
          </div>
        ),
      },
    ] : [];

    const typeColumn = [
      {
        key: "containerType",
        header: "Type",
        hideOnMobile: true,
        render: (item: InventoryWithDetails) => {
          const ct = item.product.container_type || "other";
          const labels: Record<string, { label: string; color: string }> = {
            bottle: { label: "Bottle", color: "bg-blue-100 text-blue-700" },
            can: { label: "Can/RTD", color: "bg-orange-100 text-orange-700" },
            keg: { label: "Keg", color: "bg-amber-100 text-amber-700" },
            bag_in_box: { label: "BIB", color: "bg-teal-100 text-teal-700" },
            gift_box: { label: "Box", color: "bg-pink-100 text-pink-700" },
            raw_materials: { label: "Raw Mat", color: "bg-stone-100 text-stone-700" },
            empty_bottle: { label: "Empty", color: "bg-gray-100 text-gray-600" },
            merchandise: { label: "Merch", color: "bg-purple-100 text-purple-700" },
            sample: { label: "Sample", color: "bg-cyan-100 text-cyan-700" },
            other: { label: "Other", color: "bg-gray-100 text-gray-600" },
          };
          const info = labels[ct] || labels.other;
          return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${info.color}`}>
              {info.label}
            </span>
          );
        },
      },
    ];

    const quantityColumns = [
      {
        key: "qty_on_hand",
        header: "On Hand",
        mobilePriority: 3,
        render: (item: InventoryWithDetails) => {
          const ct = item.product.container_type || "other";
          const unitLabels: Record<string, string> = {
            bottle: "Bottles",
            can: "Cans",
            keg: "Kegs",
            bag_in_box: "Units",
            gift_box: "Units",
            raw_materials: "Units",
            empty_bottle: "Bottles",
            merchandise: "Units",
            sample: "ML",
            other: "Units",
          };
          const label = unitLabels[ct] || "Units";
          return (
            <span className="font-medium">
              {item.qty_on_hand} <span className="text-gray-500 font-normal text-xs">{label}</span>
            </span>
          );
        },
      },
      {
        key: "cases",
        header: "Cases",
        hideOnMobile: true,
        render: (item: InventoryWithDetails) => {
          const upc = item.product.units_per_case || 1;
          if (upc <= 1) return <span className="text-gray-400">—</span>;
          const cases = item.qty_on_hand / upc;
          return (
            <span className="text-gray-600" title={`${upc} per case`}>
              {cases % 1 === 0 ? cases : cases.toFixed(1)}
            </span>
          );
        },
      },
      {
        key: "qty_reserved",
        header: "Reserved",
        hideOnMobile: true,
        render: (item: InventoryWithDetails) => (
          <span className="text-yellow-600">{item.qty_reserved}</span>
        ),
      },
      {
        key: "available",
        header: "Available",
        hideOnMobile: true,
        render: (item: InventoryWithDetails) => {
          const available = item.qty_on_hand - item.qty_reserved;
          const ct = item.product.container_type || "other";
          const unitLabels: Record<string, string> = {
            bottle: "Bottles", can: "Cans", keg: "Kegs", bag_in_box: "Units",
            gift_box: "Units", raw_materials: "Units", empty_bottle: "Bottles",
            merchandise: "Units", sample: "ML", other: "Units",
          };
          const label = unitLabels[ct] || "Units";
          return (
            <span
              className={`font-semibold ${
                available <= 0 ? "text-red-600" : "text-green-600"
              }`}
            >
              {available} <span className="font-normal text-xs opacity-70">{label}</span>
            </span>
          );
        },
      },
    ];

    // Damage report column (only for damaged tab)
    const damageReportColumn = activeTab === "damaged" ? [
      {
        key: "damageReport",
        header: "Damage Report",
        hideOnMobile: true,
        render: (item: InventoryWithDetails) => {
          const report = getDamageReportForProduct(item.product_id);
          if (report) {
            return (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/damage-reports/${report.id}`);
                }}
                className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800"
              >
                <FileWarning className="w-4 h-4" />
                View Report
              </button>
            );
          }
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/damage-reports/new?product_id=${item.product_id}`);
              }}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
            >
              <FileWarning className="w-4 h-4" />
              Create Report
            </button>
          );
        },
      },
    ] : [];

    // Status column (hide on damaged/quarantine tabs since it's redundant)
    const statusColumns = activeTab === "all" ? [
      {
        key: "inventoryStatus",
        header: "Status",
        mobilePriority: 2,
        render: (item: InventoryWithDetails) => {
          const statusInfo = getInventoryStatusDisplay(item.status || "available");
          return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.bgClass} ${statusInfo.textClass}`}>
              {statusInfo.label}
            </span>
          );
        },
      },
      {
        key: "stockLevel",
        header: "Stock",
        hideOnMobile: true,
        render: (item: InventoryWithDetails) => {
          const status = getStockStatus(item);
          return <Badge variant={status.variant} size="sm">{status.label}</Badge>;
        },
      },
    ] : [];

    // Actions column - different actions based on tab
    const actionsColumn = [
      {
        key: "actions",
        header: "",
        render: (item: InventoryWithDetails) => (
          <div className="flex items-center gap-1">
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
            {activeTab === "damaged" && damagedGoodsLocations.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  openMoveToDamagedModal(item);
                }}
                title="Move to Damaged Goods Location"
                className="text-red-600 hover:text-red-800"
              >
                <Building2 className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                openMoveModal(item);
              }}
              title="Move to sublocation"
            >
              <MoveRight className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                openStatusModal(item);
              }}
              title="Change status"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        ),
      },
    ];

    return [...baseColumns, ...sublocationColumn, ...typeColumn, ...quantityColumns, ...damageReportColumn, ...statusColumns, ...actionsColumn];
  }, [showSublocationColumn, activeTab, damageReports, damagedGoodsLocations.length, clients, router]);

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

      {moveSuccess && (
        <div className="mb-4">
          <Alert type="success" message={moveSuccess} onClose={() => setMoveSuccess("")} />
        </div>
      )}

      {statusSuccess && (
        <div className="mb-4">
          <Alert type="success" message={statusSuccess} onClose={() => setStatusSuccess("")} />
        </div>
      )}

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-6" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <span className={activeTab === tab.key ? "text-blue-500" : "text-gray-400"}>
                {tab.icon}
              </span>
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
                  activeTab === tab.key
                    ? "bg-blue-100 text-blue-600"
                    : tab.key === "damaged"
                    ? "bg-red-100 text-red-600"
                    : tab.key === "quarantine"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-gray-100 text-gray-600"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* By Location View */}
      {activeTab === "byLocation" ? (
        <div className="space-y-6">
          {inventoryByLocation.map(({ location, items }) => {
            const totalUnits = items.reduce((sum, item) => sum + item.qty_on_hand, 0);
            const totalValue = items.reduce((sum, item) => sum + item.qty_on_hand * item.product.unit_cost, 0);

            return (
              <Card key={location.id} padding="none">
                <div
                  className="p-4 bg-gray-50 border-b cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => router.push(`/locations/${location.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <MapPin className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{location.name}</h3>
                        {(location.city || location.state) && (
                          <p className="text-sm text-gray-500">
                            {[location.city, location.state].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <p className="text-gray-500">SKUs</p>
                        <p className="font-semibold text-gray-900">{items.length}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-500">Units</p>
                        <p className="font-semibold text-gray-900">{formatNumber(totalUnits)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-500">Value</p>
                        <p className="font-semibold text-gray-900">{formatCurrency(totalValue)}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </div>
                <Table
                  columns={columns.filter(col => col.key !== "location")}
                  data={items.slice(0, 5)}
                  loading={loading}
                  emptyMessage="No inventory at this location"
                />
                {items.length > 5 && (
                  <div className="p-3 text-center border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/locations/${location.id}`)}
                    >
                      View all {items.length} items at this location
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
          {inventoryByLocation.length === 0 && !loading && (
            <Card>
              <div className="text-center py-8 text-gray-500">
                No inventory found at any location
              </div>
            </Card>
          )}
        </div>
      ) : (
        <>
          {/* Filters (not shown on By Location tab) */}
          <div className="mb-4 flex flex-wrap gap-3 items-center">
            <div className="w-56">
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
                name="sublocation"
                options={sublocationOptions}
                value={selectedSublocation}
                onChange={(e) => setSelectedSublocation(e.target.value)}
                placeholder="All Sublocations"
                disabled={sublocationOptions.length <= 1}
              />
            </div>
            <div className="w-48">
              <Select
                name="client"
                options={clientOptions}
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                placeholder="All Clients"
              />
            </div>
            {/* Hide status filter on damaged/quarantine tabs (they already filter by status) */}
            {activeTab === "all" && (
              <div className="w-40">
                <Select
                  name="inventoryStatus"
                  options={inventoryStatusOptions}
                  value={selectedInventoryStatus}
                  onChange={(e) => setSelectedInventoryStatus(e.target.value)}
                  placeholder="All Status"
                />
              </div>
            )}
            {activeTab === "all" && (
              <div className="w-40">
                <Select
                  name="stockLevel"
                  options={stockLevelOptions}
                  value={selectedStockLevel}
                  onChange={(e) => setSelectedStockLevel(e.target.value)}
                  placeholder="Stock Level"
                />
              </div>
            )}
            {!showSublocationColumn && (
              <button
                onClick={() => setShowSublocationColumn(true)}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
              >
                <ChevronRight className="w-4 h-4" />
                Show Sublocation Column
              </button>
            )}
          </div>
          <Card padding="none">
            <Table
              columns={columns}
              data={paginatedInventory}
              loading={loading}
              emptyMessage={
                activeTab === "damaged"
                  ? "No damaged inventory found"
                  : activeTab === "quarantine"
                  ? "No quarantined inventory found"
                  : "No inventory records found"
              }
              onRowClick={(item) => router.push(`/inventory/${item.id}`)}
            />
            <Pagination
              currentPage={currentPage}
              totalItems={filteredInventory.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          </Card>
        </>
      )}

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

      {/* Move to Sublocation Modal */}
      <Modal
        isOpen={showMoveModal}
        onClose={closeMoveModal}
        title="Move Inventory"
        size="md"
      >
        <div className="space-y-4">
          {moveError && (
            <Alert type="error" message={moveError} onClose={() => setMoveError("")} />
          )}

          {moveItem && (
            <>
              {/* Product Info */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-900">{moveItem.product.name}</p>
                <p className="text-sm text-gray-500 font-mono">{moveItem.product.sku}</p>
              </div>

              {/* Current Location/Sublocation Display */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-blue-50 rounded-lg">
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">
                    Current Location
                  </label>
                  <p className="text-sm text-gray-900 font-medium">{moveItem.location.name}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">
                    Current Sublocation
                  </label>
                  <p className="text-sm text-gray-900">
                    {moveItem.sublocation ? (
                      <span className="flex items-center gap-1.5">
                        <Grid3X3 className="w-3.5 h-3.5 text-purple-500" />
                        {moveItem.sublocation.code}
                        {moveItem.sublocation.zone && ` (Zone ${moveItem.sublocation.zone})`}
                      </span>
                    ) : (
                      <span className="text-gray-400">Unassigned</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Available Quantity */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Available to move:</span>
                <span className="font-semibold text-gray-900">{moveItem.qty_on_hand} units</span>
              </div>

              {/* Quantity to Move */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity to Move *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={moveItem.qty_on_hand}
                    value={moveQuantity}
                    onChange={(e) => setMoveQuantity(parseInt(e.target.value) || 0)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setMoveQuantity(moveItem.qty_on_hand)}
                  >
                    All
                  </Button>
                </div>
                {moveQuantity > 0 && moveQuantity < moveItem.qty_on_hand && (
                  <p className="text-xs text-gray-500 mt-1">
                    {moveItem.qty_on_hand - moveQuantity} units will remain at current sublocation
                  </p>
                )}
              </div>

              {/* Target Sublocation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Sublocation *
                </label>
                {moveSublocationsOptions.length > 0 ? (
                  <Select
                    name="target_sublocation"
                    options={moveSublocationsOptions}
                    value={moveTargetSublocation}
                    onChange={(e) => setMoveTargetSublocation(e.target.value)}
                    placeholder="Select sublocation (or leave empty to unassign)"
                  />
                ) : (
                  <p className="text-sm text-amber-600 p-2 bg-amber-50 rounded-lg">
                    No sublocations available for this location. Create sublocations first.
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={moveNotes}
                  onChange={(e) => setMoveNotes(e.target.value)}
                  placeholder="Reason for move, special instructions..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="secondary" onClick={closeMoveModal}>
                  Cancel
                </Button>
                <Button
                  onClick={handleMove}
                  loading={moveLoading}
                  disabled={
                    moveLoading ||
                    moveQuantity <= 0 ||
                    moveQuantity > moveItem.qty_on_hand ||
                    (moveTargetSublocation === (moveItem.sublocation_id || "") && moveQuantity === moveItem.qty_on_hand)
                  }
                >
                  <MoveRight className="w-4 h-4 mr-2" />
                  Move {moveQuantity > 0 ? `${moveQuantity} Units` : ""}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Change Status Modal */}
      <Modal
        isOpen={showStatusModal}
        onClose={closeStatusModal}
        title="Change Inventory Status"
        size="md"
      >
        <div className="space-y-4">
          {statusError && (
            <Alert type="error" message={statusError} onClose={() => setStatusError("")} />
          )}

          {statusItem && (
            <>
              {/* Product Info */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-900">{statusItem.product.name}</p>
                <p className="text-sm text-gray-500 font-mono">{statusItem.product.sku}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {statusItem.qty_on_hand} units at {statusItem.location.name}
                </p>
              </div>

              {/* Current Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Status
                </label>
                <div className="flex items-center gap-2">
                  {(() => {
                    const statusInfo = getInventoryStatusDisplay(statusItem.status || "available");
                    return (
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusInfo.bgClass} ${statusInfo.textClass}`}>
                        {statusInfo.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* New Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Status *
                </label>
                <Select
                  name="newStatus"
                  options={inventoryStatusOptions}
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as InventoryStatus)}
                />
                {newStatus !== statusItem.status && (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="text-gray-500">Will change to:</span>
                    {(() => {
                      const statusInfo = getInventoryStatusDisplay(newStatus);
                      return (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.bgClass} ${statusInfo.textClass}`}>
                          {statusInfo.label}
                        </span>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Notes/Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason / Notes {(newStatus === "damaged" || newStatus === "quarantine") && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder={
                    newStatus === "damaged"
                      ? "Describe the damage, how it occurred, etc."
                      : newStatus === "quarantine"
                      ? "Reason for quarantine, inspection notes, etc."
                      : "Optional notes about this status change"
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                {(newStatus === "damaged" || newStatus === "quarantine") && (
                  <p className="text-xs text-amber-600 mt-1">
                    Notes are required when changing to {newStatus} status
                  </p>
                )}
              </div>

              {/* Link to damage report for damaged status */}
              {newStatus === "damaged" && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-800">
                        Creating a damage report is recommended
                      </p>
                      <p className="text-xs text-red-600 mt-1">
                        After changing the status, you can create a detailed damage report for tracking and resolution.
                      </p>
                      <a
                        href="/damage-reports/new"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-red-700 hover:text-red-800 font-medium mt-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Create Damage Report
                      </a>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="secondary" onClick={closeStatusModal}>
                  Cancel
                </Button>
                <Button
                  onClick={handleStatusChange}
                  loading={statusLoading}
                  disabled={
                    statusLoading ||
                    newStatus === statusItem.status ||
                    ((newStatus === "damaged" || newStatus === "quarantine") && !statusNotes.trim())
                  }
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Change Status
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Move to Damaged Goods Location Modal */}
      <Modal
        isOpen={showMoveToDamagedModal}
        onClose={closeMoveToDamagedModal}
        title="Move to Damaged Goods Location"
        size="md"
      >
        <div className="space-y-4">
          {moveToDamagedError && (
            <Alert type="error" message={moveToDamagedError} onClose={() => setMoveToDamagedError("")} />
          )}

          {moveToDamagedItem && (
            <>
              {/* Product Info */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-900">{moveToDamagedItem.product.name}</p>
                <p className="text-sm text-gray-500 font-mono">{moveToDamagedItem.product.sku}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {moveToDamagedItem.qty_on_hand} units
                </p>
              </div>

              {/* Current Location */}
              <div className="p-3 bg-blue-50 rounded-lg">
                <label className="block text-xs font-medium text-blue-700 mb-1">
                  Current Location
                </label>
                <p className="text-sm text-gray-900 font-medium">{moveToDamagedItem.location.name}</p>
                {moveToDamagedItem.sublocation && (
                  <p className="text-sm text-gray-600 mt-1">
                    Sublocation: {moveToDamagedItem.sublocation.code}
                  </p>
                )}
              </div>

              {/* Warning */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">Moving Damaged Inventory</p>
                    <p className="mt-1">
                      This will move all {moveToDamagedItem.qty_on_hand} units to the selected damaged goods location.
                      The sublocation assignment will be cleared.
                    </p>
                  </div>
                </div>
              </div>

              {/* Target Damaged Goods Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Damaged Goods Location *
                </label>
                {damagedGoodsLocations.length > 0 ? (
                  <Select
                    name="damaged_location"
                    options={damagedGoodsLocations.map(loc => ({
                      value: loc.id,
                      label: loc.name + (loc.city ? ` (${loc.city})` : ""),
                    }))}
                    value={selectedDamagedLocation}
                    onChange={(e) => setSelectedDamagedLocation(e.target.value)}
                    placeholder="Select damaged goods location"
                  />
                ) : (
                  <p className="text-sm text-amber-600 p-2 bg-amber-50 rounded-lg">
                    No damaged goods locations configured. Create a location with type &quot;Damaged Goods&quot; first.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="secondary" onClick={closeMoveToDamagedModal}>
                  Cancel
                </Button>
                <Button
                  onClick={handleMoveToDamagedLocation}
                  loading={moveToDamagedLoading}
                  disabled={moveToDamagedLoading || !selectedDamagedLocation}
                  variant="primary"
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  Move to Damaged Goods
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </AppShell>
  );
}
