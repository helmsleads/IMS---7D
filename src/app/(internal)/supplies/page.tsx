"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus, Search, Edit, XCircle, Box, BarChart3, Check, X, RefreshCw, Upload } from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import Alert from "@/components/ui/Alert";
import FetchError from "@/components/ui/FetchError";
import Pagination from "@/components/ui/Pagination";
import {
  getSupplies,
  getSupplyInventory,
  getSupplyUsage,
  createSupply,
  updateSupply,
  adjustSupplyInventory,
  SupplyWithInventory,
  SupplyInventoryWithDetails,
  SupplyUsageWithDetails,
} from "@/lib/api/supplies";
import { getClients, Client } from "@/lib/api/clients";
import { getAllIndustries } from "@/lib/api/workflow-profiles";
import { Supply, ClientIndustry } from "@/types/database";
import { handleApiError } from "@/lib/utils/error-handler";

const industryOptions = getAllIndustries();

const ITEMS_PER_PAGE = 25;

type TabType = "catalog" | "inventory" | "usage";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
};

const formatPercent = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
};

const formatDate = (date: string | null) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const categoryOptions = [
  { value: "", label: "All Categories" },
  { value: "boxes", label: "Boxes" },
  { value: "tape", label: "Tape" },
  { value: "labels", label: "Labels" },
  { value: "pallets", label: "Pallets" },
  { value: "wrap", label: "Wrap & Film" },
  { value: "cushioning", label: "Cushioning" },
  { value: "other", label: "Other" },
];

export default function SuppliesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("catalog");
  const [supplies, setSupplies] = useState<SupplyWithInventory[]>([]);
  const [inventory, setInventory] = useState<SupplyInventoryWithDetails[]>([]);
  const [usage, setUsage] = useState<SupplyUsageWithDetails[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  // Pagination
  const [catalogPage, setCatalogPage] = useState(1);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [usagePage, setUsagePage] = useState(1);

  // Catalog Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");

  // Usage Filters
  const [usageClientFilter, setUsageClientFilter] = useState("");
  const [usageSupplyFilter, setUsageSupplyFilter] = useState("");
  const [usageStartDate, setUsageStartDate] = useState("");
  const [usageEndDate, setUsageEndDate] = useState("");
  const [usageInvoicedFilter, setUsageInvoicedFilter] = useState("");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupply, setEditingSupply] = useState<SupplyWithInventory | null>(null);
  const [deactivatingSupply, setDeactivatingSupply] = useState<SupplyWithInventory | null>(null);
  const [adjustingInventory, setAdjustingInventory] = useState<SupplyInventoryWithDetails | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [suppliesData, inventoryData, usageData, clientsData] = await Promise.all([
        getSupplies({
          category: categoryFilter || undefined,
          active: activeFilter === "" ? undefined : activeFilter === "true",
        }),
        getSupplyInventory(),
        getSupplyUsage({
          clientId: usageClientFilter || undefined,
          supplyId: usageSupplyFilter || undefined,
          startDate: usageStartDate || undefined,
          endDate: usageEndDate || undefined,
          invoiced: usageInvoicedFilter === "" ? undefined : usageInvoicedFilter === "true",
        }),
        getClients(),
      ]);

      setSupplies(suppliesData);
      setInventory(inventoryData);
      setUsage(usageData);
      setClients(clientsData);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [categoryFilter, activeFilter, usageClientFilter, usageSupplyFilter, usageStartDate, usageEndDate, usageInvoicedFilter]);

  // Filter supplies by search term and industry
  const filteredSupplies = useMemo(() => {
    let filtered = supplies;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (supply) =>
          supply.name.toLowerCase().includes(search) ||
          supply.sku.toLowerCase().includes(search)
      );
    }

    if (industryFilter) {
      filtered = filtered.filter(
        (supply) => supply.industries?.includes(industryFilter as ClientIndustry)
      );
    }

    return filtered;
  }, [supplies, searchTerm, industryFilter]);

  // Paginated data
  const paginatedSupplies = useMemo(() => {
    const start = (catalogPage - 1) * ITEMS_PER_PAGE;
    return filteredSupplies.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSupplies, catalogPage]);

  const paginatedInventory = useMemo(() => {
    const start = (inventoryPage - 1) * ITEMS_PER_PAGE;
    return inventory.slice(start, start + ITEMS_PER_PAGE);
  }, [inventory, inventoryPage]);

  const paginatedUsage = useMemo(() => {
    const start = (usagePage - 1) * ITEMS_PER_PAGE;
    return usage.slice(start, start + ITEMS_PER_PAGE);
  }, [usage, usagePage]);

  // Calculate margin
  const calculateMargin = (basePrice: number, cost: number) => {
    if (basePrice === 0) return 0;
    return (basePrice - cost) / basePrice;
  };

  const handleSaveSupply = async (supplyData: Partial<Supply>) => {
    try {
      if (editingSupply) {
        await updateSupply(editingSupply.id, supplyData);
        setSuccessMessage("Supply updated successfully");
      } else {
        await createSupply(supplyData);
        setSuccessMessage("Supply created successfully");
      }
      await fetchData();
      setShowAddModal(false);
      setEditingSupply(null);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const handleDeactivateSupply = async () => {
    if (!deactivatingSupply) return;
    try {
      await updateSupply(deactivatingSupply.id, { is_active: false });
      await fetchData();
      setDeactivatingSupply(null);
      setSuccessMessage("Supply deactivated successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const handleAdjustInventory = async (adjustment: number, reason: string, notes: string) => {
    if (!adjustingInventory) return;
    try {
      await adjustSupplyInventory(
        adjustingInventory.supply_id,
        adjustingInventory.location_id,
        adjustment
      );
      // Note: reason and notes can be logged or stored in a separate adjustment history table if needed
      await fetchData();
      setAdjustingInventory(null);
      setSuccessMessage("Inventory adjusted successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  // Catalog columns
  const catalogColumns = [
    {
      key: "sku",
      header: "SKU",
      render: (supply: SupplyWithInventory) => (
        <span className="font-mono text-sm">{supply.sku}</span>
      ),
    },
    {
      key: "name",
      header: "Name",
      render: (supply: SupplyWithInventory) => (
        <div>
          <div className="font-medium text-gray-900">{supply.name}</div>
          {supply.description && (
            <div className="text-sm text-gray-500 truncate max-w-xs">
              {supply.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (supply: SupplyWithInventory) => (
        <span className="capitalize">{supply.category || "-"}</span>
      ),
    },
    {
      key: "industries",
      header: "Industries",
      render: (supply: SupplyWithInventory) => {
        const industries = supply.industries || [];
        if (industries.length === 0) return <span className="text-gray-400">-</span>;
        if (industries.length === 5) return <Badge variant="default">All</Badge>;
        return (
          <div className="flex flex-wrap gap-1">
            {industries.slice(0, 2).map((ind) => (
              <span
                key={ind}
                className="inline-flex px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded"
              >
                {industryOptions.find((i) => i.value === ind)?.label.split(" ")[0] || ind}
              </span>
            ))}
            {industries.length > 2 && (
              <span className="text-xs text-gray-500">+{industries.length - 2}</span>
            )}
          </div>
        );
      },
    },
    {
      key: "base_price",
      header: "Base Price",
      render: (supply: SupplyWithInventory) => formatCurrency(supply.base_price),
    },
    {
      key: "cost",
      header: "Cost",
      render: (supply: SupplyWithInventory) => formatCurrency(supply.cost),
    },
    {
      key: "margin",
      header: "Margin",
      render: (supply: SupplyWithInventory) => {
        const margin = calculateMargin(supply.base_price, supply.cost);
        return (
          <span
            className={
              margin > 0
                ? "text-green-600"
                : margin < 0
                ? "text-red-600"
                : "text-gray-500"
            }
          >
            {formatPercent(margin)}
          </span>
        );
      },
    },
    {
      key: "is_standard",
      header: "Standard",
      render: (supply: SupplyWithInventory) => (
        <div className="flex justify-center">
          {supply.is_standard ? (
            <Check className="w-5 h-5 text-green-600" />
          ) : (
            <X className="w-5 h-5 text-gray-300" />
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (supply: SupplyWithInventory) => (
        <Badge variant={supply.is_active ? "success" : "default"}>
          {supply.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (supply: SupplyWithInventory) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEditingSupply(supply)}
            className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          {supply.is_active && (
            <button
              onClick={() => setDeactivatingSupply(supply)}
              className="p-1 text-gray-500 hover:text-red-600 transition-colors"
              title="Deactivate"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  // Inventory columns
  const inventoryColumns = [
    {
      key: "name",
      header: "Supply Name",
      render: (inv: SupplyInventoryWithDetails) => (
        <span className="font-medium text-gray-900">{inv.supply?.name || "-"}</span>
      ),
    },
    {
      key: "sku",
      header: "SKU",
      render: (inv: SupplyInventoryWithDetails) => (
        <span className="font-mono text-sm">{inv.supply?.sku || "-"}</span>
      ),
    },
    {
      key: "location",
      header: "Location",
      render: (inv: SupplyInventoryWithDetails) => inv.location?.name || "Default",
    },
    {
      key: "qty_on_hand",
      header: "Qty On Hand",
      render: (inv: SupplyInventoryWithDetails) => (
        <span className="font-medium">{inv.qty_on_hand.toLocaleString()}</span>
      ),
    },
    {
      key: "reorder_point",
      header: "Reorder Point",
      render: (inv: SupplyInventoryWithDetails) => inv.reorder_point.toLocaleString(),
    },
    {
      key: "status",
      header: "Status",
      render: (inv: SupplyInventoryWithDetails) => {
        const isLow = inv.qty_on_hand <= inv.reorder_point;
        return (
          <Badge variant={isLow ? "error" : "success"}>
            {isLow ? "Low Stock" : "In Stock"}
          </Badge>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (inv: SupplyInventoryWithDetails) => (
        <button
          onClick={() => setAdjustingInventory(inv)}
          className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
          title="Adjust Inventory"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      ),
    },
  ];

  // Usage columns
  const usageColumns = [
    {
      key: "date",
      header: "Date",
      render: (u: SupplyUsageWithDetails) => formatDate(u.created_at),
    },
    {
      key: "supply_name",
      header: "Supply Name",
      render: (u: SupplyUsageWithDetails) => (
        <span className="font-medium text-gray-900">{u.supply?.name || "-"}</span>
      ),
    },
    {
      key: "client",
      header: "Client",
      render: (u: SupplyUsageWithDetails) => u.client?.company_name || "-",
    },
    {
      key: "order",
      header: "Order #",
      render: (u: SupplyUsageWithDetails) => {
        if (u.order_id) {
          return (
            <a
              href={`/outbound/${u.order_id}`}
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              View Order
            </a>
          );
        }
        return <span className="text-gray-400">-</span>;
      },
    },
    {
      key: "quantity",
      header: "Quantity",
      render: (u: SupplyUsageWithDetails) => u.quantity.toLocaleString(),
    },
    {
      key: "unit_price",
      header: "Unit Price",
      render: (u: SupplyUsageWithDetails) => formatCurrency(u.unit_price),
    },
    {
      key: "total",
      header: "Total",
      render: (u: SupplyUsageWithDetails) => (
        <span className="font-medium">{formatCurrency(u.total)}</span>
      ),
    },
    {
      key: "invoiced",
      header: "Invoiced",
      render: (u: SupplyUsageWithDetails) => (
        <Badge variant={u.invoiced ? "success" : "default"}>
          {u.invoiced ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      key: "invoice_number",
      header: "Invoice #",
      render: (u: SupplyUsageWithDetails) => {
        if (u.invoice_id) {
          return (
            <a
              href={`/billing/${u.invoice_id}`}
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              View Invoice
            </a>
          );
        }
        return <span className="text-gray-400">-</span>;
      },
    },
  ];

  const actionButtons = (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={() => router.push("/supplies/import")}>
        <Upload className="w-4 h-4 mr-1" />
        Import
      </Button>
      <Button onClick={() => setShowAddModal(true)}>
        <Plus className="w-4 h-4 mr-1" />
        Add Supply
      </Button>
    </div>
  );

  if (!loading && supplies.length === 0 && !categoryFilter && !activeFilter) {
    return (
      <AppShell
        title="Supplies"
        subtitle="Packing materials and supplies inventory"
        actions={actionButtons}
      >
        <Card>
          <EmptyState
            icon={<Package className="w-12 h-12" />}
            title="No supplies yet"
            description="Add your first supply item to get started"
            action={
              <Button onClick={() => setShowAddModal(true)}>Add Supply</Button>
            }
          />
        </Card>
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add Supply"
          size="lg"
        >
          <SupplyForm
            onSave={handleSaveSupply}
            onCancel={() => setShowAddModal(false)}
          />
        </Modal>
      </AppShell>
    );
  }

  if (error && supplies.length === 0) {
    return (
      <AppShell title="Supplies" subtitle="Packing materials and supplies inventory">
        <FetchError message={error} onRetry={fetchData} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Supplies"
      subtitle="Packing materials and supplies inventory"
      actions={actionButtons}
    >
      {successMessage && (
        <div className="mb-4">
          <Alert
            type="success"
            message={successMessage}
            onClose={() => setSuccessMessage("")}
          />
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Alert type="error" message={error} onClose={() => setError(null)} />
        </div>
      )}

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("catalog")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2
              ${activeTab === "catalog"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            <Package className="w-4 h-4" />
            Catalog
          </button>
          <button
            onClick={() => setActiveTab("inventory")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2
              ${activeTab === "inventory"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            <Box className="w-4 h-4" />
            Inventory
          </button>
          <button
            onClick={() => setActiveTab("usage")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2
              ${activeTab === "usage"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            <BarChart3 className="w-4 h-4" />
            Usage
          </button>
        </nav>
      </div>

      {/* Catalog Tab */}
      {activeTab === "catalog" && (
        <>
          <div className="mb-6 grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search supplies..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <Select
              name="category"
              options={categoryOptions}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            />
            <Select
              name="industry"
              options={[
                { value: "", label: "All Industries" },
                ...industryOptions,
              ]}
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
            />
            <Select
              name="status"
              options={[
                { value: "", label: "All Status" },
                { value: "true", label: "Active" },
                { value: "false", label: "Inactive" },
              ]}
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
            />
            <div className="flex items-center text-sm text-gray-500">
              {filteredSupplies.length} item{filteredSupplies.length !== 1 ? "s" : ""}
            </div>
          </div>

          <Card padding="none">
            <Table
              columns={catalogColumns}
              data={paginatedSupplies}
              loading={loading}
              emptyMessage="No supplies found"
            />
            <Pagination
              currentPage={catalogPage}
              totalItems={filteredSupplies.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCatalogPage}
            />
          </Card>
        </>
      )}

      {/* Inventory Tab */}
      {activeTab === "inventory" && (
        <>
          <div className="mb-6 flex items-center text-sm text-gray-500">
            {inventory.length} inventory record{inventory.length !== 1 ? "s" : ""}
          </div>

          <Card padding="none">
            <Table
              columns={inventoryColumns}
              data={paginatedInventory}
              loading={loading}
              emptyMessage="No inventory records found"
            />
            <Pagination
              currentPage={inventoryPage}
              totalItems={inventory.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setInventoryPage}
            />
          </Card>
        </>
      )}

      {/* Usage Tab */}
      {activeTab === "usage" && (
        <>
          {/* Usage Filters */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <Select
              name="usageClient"
              options={[
                { value: "", label: "All Clients" },
                ...clients.map((c) => ({ value: c.id, label: c.company_name })),
              ]}
              value={usageClientFilter}
              onChange={(e) => setUsageClientFilter(e.target.value)}
            />
            <Select
              name="usageSupply"
              options={[
                { value: "", label: "All Supplies" },
                ...supplies.map((s) => ({ value: s.id, label: s.name })),
              ]}
              value={usageSupplyFilter}
              onChange={(e) => setUsageSupplyFilter(e.target.value)}
            />
            <div>
              <input
                type="date"
                value={usageStartDate}
                onChange={(e) => setUsageStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                title="Start Date"
              />
            </div>
            <div>
              <input
                type="date"
                value={usageEndDate}
                onChange={(e) => setUsageEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                title="End Date"
              />
            </div>
            <Select
              name="usageInvoiced"
              options={[
                { value: "", label: "All Status" },
                { value: "false", label: "Not Invoiced" },
                { value: "true", label: "Invoiced" },
              ]}
              value={usageInvoicedFilter}
              onChange={(e) => setUsageInvoicedFilter(e.target.value)}
            />
            <div className="flex items-center text-sm text-gray-500">
              {usage.length} record{usage.length !== 1 ? "s" : ""}
            </div>
          </div>

          <Card padding="none">
            <Table
              columns={usageColumns}
              data={paginatedUsage}
              loading={loading}
              emptyMessage="No usage records found"
            />
            <Pagination
              currentPage={usagePage}
              totalItems={usage.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setUsagePage}
            />
          </Card>
        </>
      )}

      {/* Add/Edit Supply Modal */}
      <Modal
        isOpen={showAddModal || !!editingSupply}
        onClose={() => {
          setShowAddModal(false);
          setEditingSupply(null);
        }}
        title={editingSupply ? "Edit Supply" : "Add Supply"}
        size="lg"
      >
        <SupplyForm
          supply={editingSupply || undefined}
          onSave={handleSaveSupply}
          onCancel={() => {
            setShowAddModal(false);
            setEditingSupply(null);
          }}
        />
      </Modal>

      {/* Deactivate Confirmation Modal */}
      <Modal
        isOpen={!!deactivatingSupply}
        onClose={() => setDeactivatingSupply(null)}
        title="Deactivate Supply"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to deactivate{" "}
            <span className="font-semibold">{deactivatingSupply?.name}</span>?
            This supply will no longer appear in active lists.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeactivatingSupply(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeactivateSupply}>
              Deactivate
            </Button>
          </div>
        </div>
      </Modal>

      {/* Adjust Inventory Modal */}
      <Modal
        isOpen={!!adjustingInventory}
        onClose={() => setAdjustingInventory(null)}
        title="Adjust Inventory"
        size="sm"
      >
        {adjustingInventory && (
          <AdjustInventoryForm
            inventory={adjustingInventory}
            onAdjust={handleAdjustInventory}
            onCancel={() => setAdjustingInventory(null)}
          />
        )}
      </Modal>
    </AppShell>
  );
}

interface SupplyFormProps {
  supply?: SupplyWithInventory;
  onSave: (data: Partial<Supply>) => void;
  onCancel: () => void;
}

function SupplyForm({ supply, onSave, onCancel }: SupplyFormProps) {
  const [sku, setSku] = useState(supply?.sku || "");
  const [name, setName] = useState(supply?.name || "");
  const [description, setDescription] = useState(supply?.description || "");
  const [category, setCategory] = useState(supply?.category || "");
  const [basePrice, setBasePrice] = useState(supply?.base_price?.toString() || "0");
  const [cost, setCost] = useState(supply?.cost?.toString() || "");
  const [unit, setUnit] = useState(supply?.unit || "each");
  const [isStandard, setIsStandard] = useState(supply?.is_standard ?? false);
  const [sortOrder, setSortOrder] = useState(supply?.sort_order?.toString() || "0");
  const [industries, setIndustries] = useState<ClientIndustry[]>(
    supply?.industries || ["general_merchandise"]
  );
  const [saving, setSaving] = useState(false);

  const handleIndustryToggle = (industry: ClientIndustry) => {
    setIndustries((prev) =>
      prev.includes(industry)
        ? prev.filter((i) => i !== industry)
        : [...prev, industry]
    );
  };

  const handleSelectAllIndustries = () => {
    if (industries.length === industryOptions.length) {
      setIndustries([]);
    } else {
      setIndustries(industryOptions.map((i) => i.value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      sku,
      name,
      description: description || null,
      category: category || null,
      base_price: parseFloat(basePrice) || 0,
      cost: cost ? parseFloat(cost) : 0,
      unit: unit || "each",
      is_standard: isStandard,
      is_active: supply?.is_active ?? true,
      sort_order: parseInt(sortOrder) || 0,
      industries,
    });
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            SKU <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Category
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select category</option>
          <option value="boxes">Boxes</option>
          <option value="tape">Tape</option>
          <option value="labels">Labels</option>
          <option value="pallets">Pallets</option>
          <option value="wrap">Wrap & Film</option>
          <option value="cushioning">Cushioning</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Industries
          </label>
          <button
            type="button"
            onClick={handleSelectAllIndustries}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            {industries.length === industryOptions.length ? "Deselect All" : "Select All"}
          </button>
        </div>
        <div className="border border-gray-300 rounded-md p-3 space-y-2">
          {industryOptions.map((ind) => (
            <label key={ind.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={industries.includes(ind.value)}
                onChange={() => handleIndustryToggle(ind.value)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{ind.label}</span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Select which industries can use this supply
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Base Price <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input
              type="number"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              required
              min={0}
              step={0.01}
              className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cost
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input
              type="number"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              min={0}
              step={0.01}
              placeholder="0.00"
              className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Unit
          </label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="each">Each</option>
            <option value="box">Box</option>
            <option value="case">Case</option>
            <option value="roll">Roll</option>
            <option value="pack">Pack</option>
            <option value="pallet">Pallet</option>
            <option value="sqft">Sq Ft</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sort Order
          </label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            min={0}
            placeholder="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-end pb-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isStandard"
              checked={isStandard}
              onChange={(e) => setIsStandard(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isStandard" className="text-sm text-gray-700">
              Is Standard
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="secondary" onClick={onCancel} type="button">
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !name || !sku}>
          {saving ? "Saving..." : supply ? "Update Supply" : "Add Supply"}
        </Button>
      </div>
    </form>
  );
}

interface AdjustInventoryFormProps {
  inventory: SupplyInventoryWithDetails;
  onAdjust: (adjustment: number, reason: string, notes: string) => void;
  onCancel: () => void;
}

const adjustmentReasons = [
  { value: "received", label: "Received" },
  { value: "damaged", label: "Damaged" },
  { value: "counted", label: "Counted (Cycle Count)" },
  { value: "used", label: "Used" },
];

function AdjustInventoryForm({ inventory, onAdjust, onCancel }: AdjustInventoryFormProps) {
  const [adjustment, setAdjustment] = useState("");
  const [reason, setReason] = useState("received");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const adjustmentValue = parseInt(adjustment) || 0;
  const newQuantity = inventory.qty_on_hand + adjustmentValue;
  const isValid = adjustment !== "" && adjustmentValue !== 0 && newQuantity >= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setSaving(true);
    await onAdjust(adjustmentValue, reason, notes);
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Supply Info */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="text-sm text-gray-500 mb-1">Supply Name</div>
        <div className="font-medium text-gray-900">{inventory.supply?.name}</div>
        <div className="text-sm text-gray-500 font-mono">{inventory.supply?.sku}</div>
      </div>

      {/* Current Quantity */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="text-sm text-gray-500 mb-1">Current Quantity</div>
        <div className="text-2xl font-semibold text-gray-900">
          {inventory.qty_on_hand.toLocaleString()}
        </div>
      </div>

      {/* Adjustment Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Adjustment (+/-)
        </label>
        <input
          type="number"
          value={adjustment}
          onChange={(e) => setAdjustment(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
          placeholder="e.g. +10 or -5"
        />
        <p className="mt-1 text-xs text-gray-500">
          Use positive numbers to add, negative to remove
        </p>
      </div>

      {/* New Quantity Preview */}
      {adjustment !== "" && (
        <div className={`rounded-lg p-4 ${newQuantity >= 0 ? "bg-blue-50" : "bg-red-50"}`}>
          <div className="text-sm text-gray-600 mb-1">New Quantity</div>
          <div className={`text-2xl font-semibold ${newQuantity >= 0 ? "text-blue-700" : "text-red-700"}`}>
            {newQuantity.toLocaleString()}
          </div>
          {newQuantity < 0 && (
            <p className="text-sm text-red-600 mt-1">
              Quantity cannot be negative
            </p>
          )}
        </div>
      )}

      {/* Reason Dropdown */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Reason
        </label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {adjustmentReasons.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Optional notes about this adjustment..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="secondary" onClick={onCancel} type="button">
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !isValid}>
          {saving ? "Saving..." : "Save Adjustment"}
        </Button>
      </div>
    </form>
  );
}
