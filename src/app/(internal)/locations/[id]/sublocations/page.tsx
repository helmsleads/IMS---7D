"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, MapPin, Pencil, Grid3X3, Barcode, Printer, Package } from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Alert from "@/components/ui/Alert";
import Modal from "@/components/ui/Modal";
import { getLocation, Location } from "@/lib/api/locations";
import {
  getSublocations,
  createSublocation,
  updateSublocation,
  SublocationWithLocation,
} from "@/lib/api/sublocations";
import { Sublocation } from "@/types/database";
import { createClient } from "@/lib/supabase";

interface SublocationFormData {
  code: string;
  name: string;
  zone: string;
  aisle: string;
  rack: string;
  shelf: string;
  bin: string;
  barcode: string;
  capacity: number | null;
  is_pickable: boolean;
  autoGenerateBarcode: boolean;
}

const ZONES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];

export default function LocationSublocationsPage() {
  const params = useParams();
  const router = useRouter();
  const locationId = params.id as string;

  const [location, setLocation] = useState<Location | null>(null);
  const [sublocations, setSublocations] = useState<SublocationWithLocation[]>([]);
  const [sublocationItemCounts, setSublocationItemCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSublocation, setEditingSublocation] = useState<SublocationWithLocation | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedSublocations, setSelectedSublocations] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState<SublocationFormData>({
    code: "",
    name: "",
    zone: "",
    aisle: "",
    rack: "",
    shelf: "",
    bin: "",
    barcode: "",
    capacity: null,
    is_pickable: true,
    autoGenerateBarcode: true,
  });

  const fetchData = async () => {
    try {
      const [locationData, sublocationsData] = await Promise.all([
        getLocation(locationId),
        getSublocations(locationId),
      ]);
      setLocation(locationData);
      setSublocations(sublocationsData);

      // Fetch inventory counts by sublocation
      const supabase = createClient();
      const { data: inventoryData } = await supabase
        .from("inventory")
        .select("sublocation_id, qty_on_hand")
        .eq("location_id", locationId)
        .not("sublocation_id", "is", null);

      // Build map of sublocation_id -> total items
      const countsMap = new Map<string, number>();
      (inventoryData || []).forEach((item) => {
        if (item.sublocation_id) {
          const current = countsMap.get(item.sublocation_id) || 0;
          countsMap.set(item.sublocation_id, current + (item.qty_on_hand || 0));
        }
      });
      setSublocationItemCounts(countsMap);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setErrorMessage("Failed to load sublocations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [locationId]);

  const openAddModal = () => {
    setEditingSublocation(null);
    setFormData({
      code: "",
      name: "",
      zone: "",
      aisle: "",
      rack: "",
      shelf: "",
      bin: "",
      barcode: "",
      capacity: null,
      is_pickable: true,
      autoGenerateBarcode: true,
    });
    setShowModal(true);
  };

  const openEditModal = (sublocation: SublocationWithLocation) => {
    setEditingSublocation(sublocation);
    setFormData({
      code: sublocation.code,
      name: sublocation.name || "",
      zone: sublocation.zone || "",
      aisle: sublocation.aisle || "",
      rack: sublocation.rack || "",
      shelf: sublocation.shelf || "",
      bin: sublocation.bin || "",
      barcode: sublocation.barcode || "",
      capacity: sublocation.capacity,
      is_pickable: sublocation.is_pickable,
      autoGenerateBarcode: false, // Don't auto-generate when editing existing
    });
    setShowModal(true);
  };

  // Auto-suggest code based on zone/aisle/rack/shelf/bin
  const suggestCode = (zone: string, aisle: string, rack: string, shelf: string, bin: string) => {
    const parts = [zone, aisle, rack, shelf, bin].filter(Boolean);
    return parts.length > 0 ? parts.join("-") : "";
  };

  // Generate barcode from location name and code
  const generateBarcode = (code: string) => {
    if (!location || !code) return "";
    const locationPrefix = location.name
      .substring(0, 3)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    return `LOC-${locationPrefix}-${code.replace(/[^A-Z0-9-]/gi, "").toUpperCase()}`;
  };

  // Handle form field changes with auto-suggestions
  const handleFieldChange = (field: keyof SublocationFormData, value: string | number | boolean | null) => {
    const newFormData = { ...formData, [field]: value };

    // Auto-suggest code when location fields change
    if (["zone", "aisle", "rack", "shelf", "bin"].includes(field)) {
      const suggestedCode = suggestCode(
        field === "zone" ? (value as string) : newFormData.zone,
        field === "aisle" ? (value as string) : newFormData.aisle,
        field === "rack" ? (value as string) : newFormData.rack,
        field === "shelf" ? (value as string) : newFormData.shelf,
        field === "bin" ? (value as string) : newFormData.bin
      );
      // Only auto-fill code if it's empty or matches the previous suggestion
      const previousSuggested = suggestCode(formData.zone, formData.aisle, formData.rack, formData.shelf, formData.bin);
      if (!formData.code || formData.code === previousSuggested) {
        newFormData.code = suggestedCode;
      }

      // Auto-generate barcode if enabled
      if (newFormData.autoGenerateBarcode && suggestedCode) {
        newFormData.barcode = generateBarcode(suggestedCode);
      }
    }

    // Update barcode when code changes and auto-generate is enabled
    if (field === "code" && newFormData.autoGenerateBarcode) {
      newFormData.barcode = generateBarcode(value as string);
    }

    setFormData(newFormData);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSublocation(null);
    setErrorMessage("");
  };

  const handleSave = async () => {
    if (!formData.code.trim()) {
      setErrorMessage("Code is required");
      return;
    }

    try {
      const data: Partial<Sublocation> = {
        location_id: locationId,
        code: formData.code.trim(),
        name: formData.name.trim() || null,
        zone: formData.zone.trim() || null,
        aisle: formData.aisle.trim() || null,
        rack: formData.rack.trim() || null,
        shelf: formData.shelf.trim() || null,
        bin: formData.bin.trim() || null,
        barcode: formData.barcode.trim() || null,
        capacity: formData.capacity,
        is_pickable: formData.is_pickable,
      };

      if (editingSublocation) {
        await updateSublocation(editingSublocation.id, data);
        setSuccessMessage("Sublocation updated successfully");
      } else {
        await createSublocation(data);
        setSuccessMessage("Sublocation created successfully");
      }

      await fetchData();
      closeModal();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save sublocation");
    }
  };

  // Selection handlers for bulk operations
  const toggleSelectAll = () => {
    if (selectedSublocations.size === sublocations.length) {
      setSelectedSublocations(new Set());
    } else {
      setSelectedSublocations(new Set(sublocations.map((s) => s.id)));
    }
  };

  const toggleSelectSublocation = (id: string) => {
    const newSelected = new Set(selectedSublocations);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedSublocations(newSelected);
  };

  // Generate barcode label HTML for a sublocation
  const generateLabelHtml = (subloc: SublocationWithLocation, index: number) => {
    const barcodeValue = subloc.barcode || subloc.code;
    const barcodeId = `barcode-${index}`;
    return `
      <div class="label">
        <div class="code">${subloc.code}</div>
        ${subloc.name ? `<div class="name">${subloc.name}</div>` : ""}
        <svg id="${barcodeId}"></svg>
        <div class="barcode-text">${barcodeValue}</div>
        <div class="location">${location?.name || ""}</div>
      </div>
    `;
  };

  // Generate barcode script for JsBarcode
  const generateBarcodeScript = (sublocsToprint: SublocationWithLocation[]) => {
    return sublocsToprint
      .map((subloc, index) => {
        const barcodeValue = subloc.barcode || subloc.code;
        return `JsBarcode("#barcode-${index}", "${barcodeValue}", {
          format: "CODE128",
          width: 2,
          height: 60,
          displayValue: false,
          margin: 10
        });`;
      })
      .join("\n");
  };

  const handlePrintBarcode = (subloc: SublocationWithLocation) => {
    printBarcodeLabels([subloc]);
  };

  const handleBulkPrint = () => {
    const selectedSublocs = sublocations.filter((s) => selectedSublocations.has(s.id));
    if (selectedSublocs.length === 0) {
      setErrorMessage("Please select at least one sublocation to print");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }
    printBarcodeLabels(selectedSublocs);
  };

  const printBarcodeLabels = (sublocsToprint: SublocationWithLocation[]) => {
    const printWindow = window.open("", "_blank", "width=600,height=800");
    if (printWindow) {
      const labelsHtml = sublocsToprint.map((subloc, index) => generateLabelHtml(subloc, index)).join("");
      const barcodeScripts = generateBarcodeScript(sublocsToprint);

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Print Barcode Labels - ${location?.name || "Sublocations"}</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
          <style>
            * {
              box-sizing: border-box;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background: #f5f5f5;
            }
            .labels-container {
              display: flex;
              flex-wrap: wrap;
              gap: 16px;
              justify-content: center;
            }
            .label {
              background: white;
              border: 2px solid #000;
              padding: 16px 20px;
              text-align: center;
              width: 280px;
              page-break-inside: avoid;
            }
            .code {
              font-size: 20px;
              font-weight: bold;
              margin-bottom: 4px;
              letter-spacing: 1px;
            }
            .name {
              font-size: 12px;
              color: #444;
              margin-bottom: 8px;
            }
            .barcode-text {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              letter-spacing: 2px;
              margin-top: 4px;
            }
            .location {
              font-size: 11px;
              color: #666;
              margin-top: 8px;
              padding-top: 8px;
              border-top: 1px solid #ddd;
            }
            svg {
              max-width: 100%;
              height: auto;
            }
            @media print {
              body {
                background: white;
                padding: 0;
              }
              .labels-container {
                gap: 8mm;
              }
              .label {
                border: 1px solid #000;
                width: 70mm;
                padding: 4mm;
                margin: 0;
              }
              .no-print {
                display: none !important;
              }
            }
            .print-header {
              text-align: center;
              margin-bottom: 20px;
              padding-bottom: 16px;
              border-bottom: 1px solid #ddd;
            }
            .print-header h1 {
              margin: 0 0 8px 0;
              font-size: 18px;
              color: #333;
            }
            .print-header p {
              margin: 0;
              color: #666;
              font-size: 14px;
            }
            .print-btn {
              display: inline-block;
              background: #2563eb;
              color: white;
              padding: 10px 24px;
              border: none;
              border-radius: 6px;
              font-size: 14px;
              cursor: pointer;
              margin-top: 12px;
            }
            .print-btn:hover {
              background: #1d4ed8;
            }
          </style>
        </head>
        <body>
          <div class="print-header no-print">
            <h1>Barcode Labels</h1>
            <p>${sublocsToprint.length} label${sublocsToprint.length > 1 ? "s" : ""} for ${location?.name || "Location"}</p>
            <button class="print-btn" onclick="window.print()">Print Labels</button>
          </div>
          <div class="labels-container">
            ${labelsHtml}
          </div>
          <script>
            document.addEventListener('DOMContentLoaded', function() {
              ${barcodeScripts}
            });
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const formatAisleRackShelfBin = (subloc: SublocationWithLocation) => {
    const parts = [
      subloc.aisle,
      subloc.rack,
      subloc.shelf,
      subloc.bin,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join("-") : "—";
  };

  const columns = [
    {
      key: "select",
      header: (
        <input
          type="checkbox"
          checked={sublocations.length > 0 && selectedSublocations.size === sublocations.length}
          onChange={toggleSelectAll}
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
      ),
      render: (subloc: SublocationWithLocation) => (
        <input
          type="checkbox"
          checked={selectedSublocations.has(subloc.id)}
          onChange={() => toggleSelectSublocation(subloc.id)}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
      ),
      hideOnMobile: true,
    },
    {
      key: "code",
      header: "Code",
      render: (subloc: SublocationWithLocation) => (
        <span className="font-mono font-medium text-gray-900">{subloc.code}</span>
      ),
    },
    {
      key: "name",
      header: "Name",
      render: (subloc: SublocationWithLocation) => (
        <span className="text-gray-900">{subloc.name || "—"}</span>
      ),
    },
    {
      key: "zone",
      header: "Zone",
      render: (subloc: SublocationWithLocation) => (
        <span className="text-gray-600">{subloc.zone || "—"}</span>
      ),
    },
    {
      key: "path",
      header: "Aisle-Rack-Shelf-Bin",
      render: (subloc: SublocationWithLocation) => (
        <span className="font-mono text-sm text-gray-600">{formatAisleRackShelfBin(subloc)}</span>
      ),
    },
    {
      key: "barcode",
      header: "Barcode",
      render: (subloc: SublocationWithLocation) => (
        subloc.barcode ? (
          <div className="flex items-center gap-1.5">
            <Barcode className="w-4 h-4 text-gray-400" />
            <span className="font-mono text-sm text-gray-600">{subloc.barcode}</span>
          </div>
        ) : (
          <span className="text-gray-400">—</span>
        )
      ),
    },
    {
      key: "capacity",
      header: "Capacity",
      render: (subloc: SublocationWithLocation) => (
        <span className="text-gray-600">
          {subloc.capacity ? subloc.capacity.toLocaleString() : "—"}
        </span>
      ),
    },
    {
      key: "items",
      header: "Current Items",
      render: (subloc: SublocationWithLocation) => {
        const itemCount = sublocationItemCounts.get(subloc.id) || 0;
        return (
          <div className="flex items-center gap-1.5">
            <Package className="w-4 h-4 text-gray-400" />
            <span className={`font-medium ${itemCount > 0 ? "text-gray-900" : "text-gray-400"}`}>
              {itemCount.toLocaleString()}
            </span>
          </div>
        );
      },
    },
    {
      key: "is_pickable",
      header: "Pickable",
      render: (subloc: SublocationWithLocation) => (
        subloc.is_pickable ? (
          <Badge variant="success" size="sm">Yes</Badge>
        ) : (
          <Badge variant="default" size="sm">No</Badge>
        )
      ),
    },
    {
      key: "is_active",
      header: "Active",
      render: (subloc: SublocationWithLocation) => (
        subloc.is_active ? (
          <Badge variant="success" size="sm">Yes</Badge>
        ) : (
          <Badge variant="default" size="sm">No</Badge>
        )
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (subloc: SublocationWithLocation) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEditModal(subloc)}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => handlePrintBarcode(subloc)}
            className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            title="Print Barcode"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      ),
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

  const activeSublocations = sublocations.filter((s) => s.is_active);
  const inactiveSublocations = sublocations.filter((s) => !s.is_active);

  return (
    <AppShell
      title={`${location.name} Sublocations`}
      actions={
        <div className="flex items-center gap-3">
          {selectedSublocations.size > 0 && (
            <Button variant="secondary" onClick={handleBulkPrint}>
              <Printer className="w-4 h-4 mr-2" />
              Print Selected ({selectedSublocations.size})
            </Button>
          )}
          <Button onClick={openAddModal}>
            <Plus className="w-4 h-4 mr-2" />
            Add Sublocation
          </Button>
        </div>
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
        {errorMessage && !showModal && (
          <Alert type="error" message={errorMessage} onClose={() => setErrorMessage("")} />
        )}

        {/* Location Summary */}
        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <MapPin className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{location.name}</h2>
              {location.city && location.state && (
                <p className="text-sm text-gray-500">
                  {location.city}, {location.state}
                </p>
              )}
            </div>
            <div className="ml-auto flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{activeSublocations.length}</p>
                <p className="text-xs text-gray-500">Active Sublocations</p>
              </div>
              {inactiveSublocations.length > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-400">{inactiveSublocations.length}</p>
                  <p className="text-xs text-gray-500">Inactive</p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Sublocations List */}
        <Card>
          {/* Selection Actions Bar */}
          {sublocations.length > 0 && (
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500">
                  {selectedSublocations.size > 0
                    ? `${selectedSublocations.size} of ${sublocations.length} selected`
                    : `${sublocations.length} sublocation${sublocations.length !== 1 ? "s" : ""}`}
                </span>
                {selectedSublocations.size > 0 && (
                  <button
                    onClick={() => setSelectedSublocations(new Set())}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Clear selection
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedSublocations.size === 0 && sublocations.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSelectedSublocations(new Set(sublocations.map((s) => s.id)));
                    }}
                  >
                    Select All
                  </Button>
                )}
                {sublocations.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => printBarcodeLabels(sublocations)}
                  >
                    <Printer className="w-4 h-4 mr-1.5" />
                    Print All
                  </Button>
                )}
              </div>
            </div>
          )}
          {sublocations.length > 0 ? (
            <Table
              columns={columns}
              data={sublocations}
              emptyMessage="No sublocations found"
            />
          ) : (
            <EmptyState
              icon={<Grid3X3 className="w-12 h-12" />}
              title="No sublocations"
              description="Create sublocations to organize inventory within this location."
              action={
                <Button onClick={openAddModal}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Sublocation
                </Button>
              }
            />
          )}
        </Card>

        {/* Add/Edit Modal */}
        <Modal
          isOpen={showModal}
          onClose={closeModal}
          title={editingSublocation ? "Edit Sublocation" : "Add Sublocation"}
        >
          <div className="space-y-4">
            {errorMessage && (
              <Alert type="error" message={errorMessage} onClose={() => setErrorMessage("")} />
            )}

            {/* Location Path Fields */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location Path
              </label>
              <div className="grid grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Zone</label>
                  <select
                    value={formData.zone}
                    onChange={(e) => handleFieldChange("zone", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">--</option>
                    {ZONES.map((zone) => (
                      <option key={zone} value={zone}>{zone}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Aisle</label>
                  <input
                    type="text"
                    value={formData.aisle}
                    onChange={(e) => handleFieldChange("aisle", e.target.value)}
                    placeholder="01"
                    maxLength={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Rack</label>
                  <input
                    type="text"
                    value={formData.rack}
                    onChange={(e) => handleFieldChange("rack", e.target.value)}
                    placeholder="01"
                    maxLength={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Shelf</label>
                  <input
                    type="text"
                    value={formData.shelf}
                    onChange={(e) => handleFieldChange("shelf", e.target.value)}
                    placeholder="A"
                    maxLength={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Bin</label>
                  <input
                    type="text"
                    value={formData.bin}
                    onChange={(e) => handleFieldChange("bin", e.target.value)}
                    placeholder="01"
                    maxLength={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Code and Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => handleFieldChange("code", e.target.value)}
                  placeholder="e.g., A-01-01-A-01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <p className="text-xs text-gray-400 mt-1">Auto-filled from location path</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  placeholder="e.g., Main Shelf A1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Barcode */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Barcode
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.autoGenerateBarcode}
                    onChange={(e) => {
                      const newValue = e.target.checked;
                      setFormData({
                        ...formData,
                        autoGenerateBarcode: newValue,
                        barcode: newValue ? generateBarcode(formData.code) : formData.barcode,
                      });
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  Auto-generate
                </label>
              </div>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value, autoGenerateBarcode: false })}
                placeholder="LOC-XXX-A-01-01"
                disabled={formData.autoGenerateBarcode}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono ${
                  formData.autoGenerateBarcode ? "bg-gray-50 text-gray-500" : ""
                }`}
              />
            </div>

            {/* Capacity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Capacity <span className="text-gray-400 font-normal">(max units)</span>
              </label>
              <input
                type="number"
                value={formData.capacity || ""}
                onChange={(e) => handleFieldChange("capacity", e.target.value ? parseInt(e.target.value) : null)}
                placeholder="Leave empty for unlimited"
                min={0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Pickable Checkbox */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                id="is_pickable"
                checked={formData.is_pickable}
                onChange={(e) => handleFieldChange("is_pickable", e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="is_pickable" className="text-sm text-gray-700">
                <span className="font-medium">Pickable location</span>
                <span className="block text-xs text-gray-500">Items can be picked from here for orders</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={closeModal}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                {editingSublocation ? "Save Changes" : "Create Sublocation"}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppShell>
  );
}
