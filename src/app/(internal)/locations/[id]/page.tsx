"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Pencil,
  Package,
  Grid3X3,
  Layers,
  BarChart3,
  ArrowRight,
  AlertTriangle,
  ShieldAlert,
  Truck,
  Warehouse,
  RotateCcw,
  Clock,
  Target,
} from "lucide-react";
import { LocationType } from "@/types/database";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Alert from "@/components/ui/Alert";
import Modal from "@/components/ui/Modal";
import LocationForm from "@/components/internal/LocationForm";
import {
  getLocation,
  updateLocation,
  Location,
} from "@/lib/api/locations";
import { getSublocations, SublocationWithLocation } from "@/lib/api/sublocations";
import { getInventory, InventoryWithDetails } from "@/lib/api/inventory";
import { createClient } from "@/lib/supabase";

type TabType = "overview" | "inventory" | "sublocations";

export default function LocationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locationId = params.id as string;

  const [location, setLocation] = useState<Location | null>(null);
  const [sublocations, setSublocations] = useState<SublocationWithLocation[]>([]);
  const [inventory, setInventory] = useState<InventoryWithDetails[]>([]);
  const [sublocationUsage, setSublocationUsage] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [showEditModal, setShowEditModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  // Type-specific counts
  const [damagedCount, setDamagedCount] = useState(0);
  const [quarantineCount, setQuarantineCount] = useState(0);
  const [pendingInboundCount, setPendingInboundCount] = useState(0);

  const fetchData = async () => {
    try {
      const [locationData, sublocationsData, inventoryData] = await Promise.all([
        getLocation(locationId),
        getSublocations(locationId),
        getInventory(),
      ]);

      setLocation(locationData);
      setSublocations(sublocationsData);
      setInventory(inventoryData.filter((item) => item.location_id === locationId));

      // Fetch sublocation usage (current items per sublocation)
      const supabase = createClient();
      const { data: usageData } = await supabase
        .from("inventory")
        .select("sublocation_id, qty_on_hand")
        .eq("location_id", locationId)
        .not("sublocation_id", "is", null);

      const usageMap = new Map<string, number>();
      (usageData || []).forEach((item) => {
        if (item.sublocation_id) {
          const current = usageMap.get(item.sublocation_id) || 0;
          usageMap.set(item.sublocation_id, current + (item.qty_on_hand || 0));
        }
      });
      setSublocationUsage(usageMap);

      // Fetch type-specific counts based on location type
      if (locationData) {
        // Damaged inventory count (inventory with status = 'damaged' at this location)
        const { count: damaged } = await supabase
          .from("inventory")
          .select("id", { count: "exact", head: true })
          .eq("location_id", locationId)
          .eq("status", "damaged");
        setDamagedCount(damaged || 0);

        // Quarantine inventory count
        const { count: quarantine } = await supabase
          .from("inventory")
          .select("id", { count: "exact", head: true })
          .eq("location_id", locationId)
          .eq("status", "quarantine");
        setQuarantineCount(quarantine || 0);

        // Pending inbound orders count (orders arriving at this location)
        const { count: pendingInbound } = await supabase
          .from("inbound_orders")
          .select("id", { count: "exact", head: true })
          .eq("location_id", locationId)
          .in("status", ["ordered", "in_transit", "arrived"]);
        setPendingInboundCount(pendingInbound || 0);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setErrorMessage("Failed to load location details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [locationId]);

  // Calculate sublocation stats
  const sublocationStats = useMemo(() => {
    const activeSublocations = sublocations.filter((s) => s.is_active);
    const totalCapacity = activeSublocations.reduce(
      (sum, s) => sum + (s.capacity || 0),
      0
    );
    const currentUsage = Array.from(sublocationUsage.values()).reduce(
      (sum, qty) => sum + qty,
      0
    );
    const usagePercentage = totalCapacity > 0 ? (currentUsage / totalCapacity) * 100 : 0;

    return {
      total: activeSublocations.length,
      totalCapacity,
      currentUsage,
      usagePercentage,
      pickable: activeSublocations.filter((s) => s.is_pickable).length,
    };
  }, [sublocations, sublocationUsage]);

  // Calculate inventory stats
  const inventoryStats = useMemo(() => {
    return {
      totalSKUs: inventory.length,
      totalUnits: inventory.reduce((sum, item) => sum + item.qty_on_hand, 0),
      totalReserved: inventory.reduce((sum, item) => sum + item.qty_reserved, 0),
    };
  }, [inventory]);

  // Location type display helpers
  const getLocationTypeInfo = (type: LocationType) => {
    const typeMap: Record<LocationType, { label: string; color: string; icon: React.ReactNode; bgColor: string }> = {
      primary_storage: {
        label: "Primary Storage",
        color: "text-blue-700",
        bgColor: "bg-blue-100",
        icon: <Warehouse className="w-4 h-4" />,
      },
      pick_location: {
        label: "Pick Location",
        color: "text-green-700",
        bgColor: "bg-green-100",
        icon: <Target className="w-4 h-4" />,
      },
      damaged_goods: {
        label: "Damaged Goods",
        color: "text-red-700",
        bgColor: "bg-red-100",
        icon: <AlertTriangle className="w-4 h-4" />,
      },
      quarantine: {
        label: "Quarantine",
        color: "text-orange-700",
        bgColor: "bg-orange-100",
        icon: <ShieldAlert className="w-4 h-4" />,
      },
      returns_processing: {
        label: "Returns Processing",
        color: "text-purple-700",
        bgColor: "bg-purple-100",
        icon: <RotateCcw className="w-4 h-4" />,
      },
      staging: {
        label: "Staging",
        color: "text-cyan-700",
        bgColor: "bg-cyan-100",
        icon: <Clock className="w-4 h-4" />,
      },
      receiving: {
        label: "Receiving",
        color: "text-indigo-700",
        bgColor: "bg-indigo-100",
        icon: <Truck className="w-4 h-4" />,
      },
    };
    return typeMap[type] || typeMap.primary_storage;
  };

  const handleSave = async (data: Partial<Location>) => {
    try {
      await updateLocation(locationId, data);
      setSuccessMessage("Location updated successfully");
      await fetchData();
      setShowEditModal(false);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save location");
    }
  };

  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Overview", icon: <MapPin className="w-4 h-4" /> },
    { key: "inventory", label: "Inventory", icon: <Package className="w-4 h-4" /> },
    { key: "sublocations", label: "Sublocations", icon: <Grid3X3 className="w-4 h-4" /> },
  ];

  const inventoryColumns = [
    {
      key: "product",
      header: "Product",
      render: (item: InventoryWithDetails) => (
        <div>
          <span className="font-medium text-gray-900">{item.product?.name || "Unknown"}</span>
          <span className="block text-sm text-gray-500 font-mono">{item.product?.sku}</span>
        </div>
      ),
    },
    {
      key: "qty_on_hand",
      header: "On Hand",
      render: (item: InventoryWithDetails) => (
        <span className="font-medium text-gray-900">{item.qty_on_hand.toLocaleString()}</span>
      ),
    },
    {
      key: "qty_reserved",
      header: "Reserved",
      render: (item: InventoryWithDetails) => (
        <span className={item.qty_reserved > 0 ? "text-amber-600" : "text-gray-400"}>
          {item.qty_reserved.toLocaleString()}
        </span>
      ),
    },
    {
      key: "available",
      header: "Available",
      render: (item: InventoryWithDetails) => {
        const available = item.qty_on_hand - item.qty_reserved;
        return (
          <span className={available > 0 ? "text-green-600 font-medium" : "text-gray-400"}>
            {available.toLocaleString()}
          </span>
        );
      },
    },
  ];

  if (loading) {
    return (
      <AppShell title="Loading...">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
        </div>
      </AppShell>
    );
  }

  if (!location) {
    return (
      <AppShell title="Location Not Found">
        <Card>
          <EmptyState
            icon={<MapPin className="w-12 h-12" />}
            title="Location not found"
            description="The location you're looking for doesn't exist or has been deleted."
            action={
              <Button onClick={() => router.push("/locations")}>
                Back to Locations
              </Button>
            }
          />
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={location.name}
      actions={
        <Button variant="secondary" onClick={() => setShowEditModal(true)}>
          <Pencil className="w-4 h-4 mr-2" />
          Edit Location
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Back Link */}
        <button
          onClick={() => router.push("/locations")}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Locations
        </button>

        {/* Success/Error Messages */}
        {successMessage && (
          <Alert type="success" message={successMessage} onClose={() => setSuccessMessage("")} />
        )}
        {errorMessage && (
          <Alert type="error" message={errorMessage} onClose={() => setErrorMessage("")} />
        )}

        {/* Location Header */}
        <Card>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <MapPin className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-gray-900">{location.name}</h2>
                  <Badge variant={location.active ? "success" : "default"}>
                    {location.active ? "Active" : "Inactive"}
                  </Badge>
                  {location.location_type && (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getLocationTypeInfo(location.location_type).bgColor} ${getLocationTypeInfo(location.location_type).color}`}>
                      {getLocationTypeInfo(location.location_type).icon}
                      {getLocationTypeInfo(location.location_type).label}
                    </span>
                  )}
                </div>
                {(location.city || location.state) && (
                  <p className="text-gray-500 mt-1">
                    {[location.address_line1, location.city, location.state, location.zip]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-8 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900">{inventoryStats.totalSKUs}</p>
                <p className="text-xs text-gray-500">SKUs</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {inventoryStats.totalUnits.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">Units</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{sublocationStats.total}</p>
                <p className="text-xs text-gray-500">Sublocations</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.key
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Type-Specific Information Card */}
            {location.location_type && ["damaged_goods", "quarantine", "receiving"].includes(location.location_type) && (
              <Card>
                <div className={`flex items-center gap-3 p-4 rounded-xl ${getLocationTypeInfo(location.location_type).bgColor}`}>
                  <div className={`p-3 bg-white rounded-lg shadow-sm ${getLocationTypeInfo(location.location_type).color}`}>
                    {location.location_type === "damaged_goods" && <AlertTriangle className="w-6 h-6" />}
                    {location.location_type === "quarantine" && <ShieldAlert className="w-6 h-6" />}
                    {location.location_type === "receiving" && <Truck className="w-6 h-6" />}
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-semibold ${getLocationTypeInfo(location.location_type).color}`}>
                      {getLocationTypeInfo(location.location_type).label} Area
                    </h3>
                    <p className="text-sm text-gray-600">
                      {location.location_type === "damaged_goods" && "This location stores damaged inventory awaiting inspection or disposal."}
                      {location.location_type === "quarantine" && "This location holds inventory under quarantine pending quality review."}
                      {location.location_type === "receiving" && "This location is used for receiving and processing inbound shipments."}
                    </p>
                  </div>
                  <div className="text-right">
                    {location.location_type === "damaged_goods" && (
                      <div>
                        <p className="text-3xl font-bold text-red-700">{damagedCount}</p>
                        <p className="text-sm text-red-600">Damaged Items</p>
                      </div>
                    )}
                    {location.location_type === "quarantine" && (
                      <div>
                        <p className="text-3xl font-bold text-orange-700">{quarantineCount}</p>
                        <p className="text-sm text-orange-600">Quarantined Items</p>
                      </div>
                    )}
                    {location.location_type === "receiving" && (
                      <div>
                        <p className="text-3xl font-bold text-indigo-700">{pendingInboundCount}</p>
                        <p className="text-sm text-indigo-600">Pending Inbound</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Location Details */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Location Details</h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Name</dt>
                  <dd className="font-medium text-gray-900">{location.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Status</dt>
                  <dd>
                    <Badge variant={location.active ? "success" : "default"}>
                      {location.active ? "Active" : "Inactive"}
                    </Badge>
                  </dd>
                </div>
                {location.location_type && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Type</dt>
                    <dd>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${getLocationTypeInfo(location.location_type).bgColor} ${getLocationTypeInfo(location.location_type).color}`}>
                        {getLocationTypeInfo(location.location_type).icon}
                        {getLocationTypeInfo(location.location_type).label}
                      </span>
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-500">Pickable</dt>
                  <dd>
                    <Badge variant={location.is_pickable ? "success" : "default"}>
                      {location.is_pickable ? "Yes" : "No"}
                    </Badge>
                  </dd>
                </div>
                {location.capacity && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Capacity</dt>
                    <dd className="text-gray-900">{location.capacity.toLocaleString()} units</dd>
                  </div>
                )}
                {location.address_line1 && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Address</dt>
                    <dd className="text-right text-gray-900">
                      {location.address_line1}
                      {location.address_line2 && <span className="block">{location.address_line2}</span>}
                    </dd>
                  </div>
                )}
                {(location.city || location.state || location.zip) && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">City, State ZIP</dt>
                    <dd className="text-gray-900">
                      {[location.city, location.state].filter(Boolean).join(", ")} {location.zip}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-500">Created</dt>
                  <dd className="text-gray-900">
                    {new Date(location.created_at).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </Card>

            {/* Quick Stats */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-xl">
                  <Package className="w-5 h-5 text-blue-600 mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{inventoryStats.totalSKUs}</p>
                  <p className="text-sm text-gray-500">Total SKUs</p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl">
                  <Layers className="w-5 h-5 text-green-600 mb-2" />
                  <p className="text-2xl font-bold text-gray-900">
                    {inventoryStats.totalUnits.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500">Total Units</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl">
                  <Grid3X3 className="w-5 h-5 text-purple-600 mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{sublocationStats.total}</p>
                  <p className="text-sm text-gray-500">Sublocations</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-xl">
                  <BarChart3 className="w-5 h-5 text-amber-600 mb-2" />
                  <p className="text-2xl font-bold text-gray-900">
                    {inventoryStats.totalReserved.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500">Reserved Units</p>
                </div>
              </div>
            </Card>
            </div>
          </div>
        )}

        {activeTab === "inventory" && (
          <Card padding="none">
            {inventory.length > 0 ? (
              <Table
                columns={inventoryColumns}
                data={inventory}
                emptyMessage="No inventory at this location"
              />
            ) : (
              <EmptyState
                icon={<Package className="w-12 h-12" />}
                title="No inventory"
                description="This location doesn't have any inventory yet."
              />
            )}
          </Card>
        )}

        {activeTab === "sublocations" && (
          <div className="space-y-6">
            {/* Sublocation Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Grid3X3 className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{sublocationStats.total}</p>
                    <p className="text-sm text-gray-500">Total Sublocations</p>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Layers className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {sublocationStats.totalCapacity > 0
                        ? sublocationStats.totalCapacity.toLocaleString()
                        : "Unlimited"}
                    </p>
                    <p className="text-sm text-gray-500">Total Capacity</p>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Package className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {sublocationStats.currentUsage.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500">Current Usage</p>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {sublocationStats.totalCapacity > 0
                        ? `${sublocationStats.usagePercentage.toFixed(1)}%`
                        : "N/A"}
                    </p>
                    <p className="text-sm text-gray-500">Utilization</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Capacity Progress Bar (if capacity is defined) */}
            {sublocationStats.totalCapacity > 0 && (
              <Card>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Storage Utilization</span>
                  <span className="text-sm text-gray-500">
                    {sublocationStats.currentUsage.toLocaleString()} / {sublocationStats.totalCapacity.toLocaleString()} units
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      sublocationStats.usagePercentage > 90
                        ? "bg-red-500"
                        : sublocationStats.usagePercentage > 75
                        ? "bg-amber-500"
                        : "bg-green-500"
                    }`}
                    style={{ width: `${Math.min(sublocationStats.usagePercentage, 100)}%` }}
                  />
                </div>
                {sublocationStats.usagePercentage > 90 && (
                  <p className="text-sm text-red-600 mt-2">
                    Storage is nearly full. Consider expanding capacity or redistributing inventory.
                  </p>
                )}
              </Card>
            )}

            {/* Sublocation Breakdown */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Sublocation Summary</h3>
                  <p className="text-sm text-gray-500">
                    {sublocationStats.pickable} pickable location{sublocationStats.pickable !== 1 ? "s" : ""}
                  </p>
                </div>
                <Button onClick={() => router.push(`/locations/${locationId}/sublocations`)}>
                  Manage Sublocations
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>

              {sublocations.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Zone</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Sublocations</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Capacity</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Current Items</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {/* Group by zone */}
                      {Array.from(
                        sublocations
                          .filter((s) => s.is_active)
                          .reduce((acc, subloc) => {
                            const zone = subloc.zone || "Unassigned";
                            if (!acc.has(zone)) {
                              acc.set(zone, { count: 0, capacity: 0, usage: 0 });
                            }
                            const stats = acc.get(zone)!;
                            stats.count++;
                            stats.capacity += subloc.capacity || 0;
                            stats.usage += sublocationUsage.get(subloc.id) || 0;
                            return acc;
                          }, new Map<string, { count: number; capacity: number; usage: number }>())
                      )
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([zone, stats]) => (
                          <tr key={zone} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-700 font-semibold rounded-lg">
                                {zone === "Unassigned" ? "?" : zone}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-900">{stats.count}</td>
                            <td className="px-4 py-3 text-gray-600">
                              {stats.capacity > 0 ? stats.capacity.toLocaleString() : "Unlimited"}
                            </td>
                            <td className="px-4 py-3">
                              <span className={stats.usage > 0 ? "font-medium text-gray-900" : "text-gray-400"}>
                                {stats.usage.toLocaleString()}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={<Grid3X3 className="w-12 h-12" />}
                  title="No sublocations"
                  description="Create sublocations to organize inventory within this location."
                  action={
                    <Button onClick={() => router.push(`/locations/${locationId}/sublocations`)}>
                      <Grid3X3 className="w-4 h-4 mr-2" />
                      Add Sublocations
                    </Button>
                  }
                />
              )}
            </Card>
          </div>
        )}

        {/* Edit Modal */}
        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title="Edit Location"
          size="md"
        >
          <LocationForm
            location={location}
            onSave={handleSave}
            onCancel={() => setShowEditModal(false)}
          />
        </Modal>
      </div>
    </AppShell>
  );
}
