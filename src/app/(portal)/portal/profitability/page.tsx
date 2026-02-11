"use client";

import { useEffect, useState } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  Percent,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
  Building2,
  Boxes,
  Download,
  Upload,
  Save,
  RotateCcw,
  Search,
  AlertCircle,
} from "lucide-react";
import { useClient } from "@/lib/client-auth";
import Card from "@/components/ui/Card";
import {
  getMyProfitability,
  getMyProductProfitability,
  getMyProductValues,
  updateMyProductValue,
  ProfitabilitySummary,
  ProductProfitabilityItem,
  ProductValue,
} from "@/lib/api/portal-profitability";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Generate year options (current year and 2 years back)
const getYearOptions = () => {
  const currentYear = new Date().getFullYear();
  return [currentYear, currentYear - 1, currentYear - 2];
};

// Get date range for a specific month/year
const getMonthRange = (month: number, year: number) => {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
};

// Get current quarter range
const getQuarterRange = () => {
  const now = new Date();
  const quarterStart = Math.floor(now.getMonth() / 3) * 3;
  const start = new Date(now.getFullYear(), quarterStart, 1);
  const end = new Date(now.getFullYear(), quarterStart + 3, 0);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
};

type QuickPeriod = "this_month" | "last_month" | "this_quarter" | "custom";
type TabType = "summary" | "product_values";

interface SevenDCosts {
  storage: number;
  fulfillment: number;
  shipping: number;
  supplies: number;
  addons: number;
  total: number;
}

export default function PortalProfitabilityPage() {
  const { client } = useClient();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [quickPeriod, setQuickPeriod] = useState<QuickPeriod>("this_month");
  const [summary, setSummary] = useState<ProfitabilitySummary | null>(null);
  const [sevenDCosts, setSevenDCosts] = useState<SevenDCosts>({
    storage: 0,
    fulfillment: 0,
    shipping: 0,
    supplies: 0,
    addons: 0,
    total: 0,
  });
  const [products, setProducts] = useState<ProductProfitabilityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<string>("netProfit");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>("summary");

  // Product values state
  const [productValues, setProductValues] = useState<ProductValue[]>([]);
  const [productValuesLoading, setProductValuesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editedValues, setEditedValues] = useState<Record<string, { salePrice: string; cost: string }>>({});
  const [saving, setSaving] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Calculate derived metrics
  const totalSales = summary?.totalRevenue || 0;
  const productCost = summary?.totalCost || 0;
  const sevenDTotal = sevenDCosts.total;
  const netProfit = totalSales - productCost - sevenDTotal;
  const netMarginPercent = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

  // Calculate total items for allocation
  const totalItemsSold = products.reduce((sum, p) => sum + p.totalQuantity, 0);

  // Enrich products with allocated 7D costs and net profit
  const enrichedProducts = products.map((product) => {
    // Allocate 7D costs proportionally by units sold
    const allocationRatio = totalItemsSold > 0 ? product.totalQuantity / totalItemsSold : 0;
    const allocated7DCost = sevenDTotal * allocationRatio;
    const productNetProfit = product.totalRevenue - product.totalCost - allocated7DCost;
    const productNetMargin = product.totalRevenue > 0
      ? (productNetProfit / product.totalRevenue) * 100
      : 0;

    return {
      ...product,
      allocated7DCost,
      netProfit: productNetProfit,
      netMarginPercent: productNetMargin,
    };
  });

  // Export to CSV function
  const handleExportCSV = () => {
    const headers = [
      "Product Name",
      "SKU",
      "Units Sold",
      "Sales",
      "Product Cost",
      "7D Costs",
      "Net Profit",
      "Net Margin %",
    ];

    const rows = enrichedProducts.map((p) => [
      p.productName,
      p.productSku,
      p.totalQuantity,
      p.totalRevenue.toFixed(2),
      p.totalCost.toFixed(2),
      p.allocated7DCost.toFixed(2),
      p.netProfit.toFixed(2),
      p.netMarginPercent.toFixed(1),
    ]);

    // Add totals row
    const totals = [
      "TOTAL",
      "",
      totalItemsSold,
      totalSales.toFixed(2),
      productCost.toFixed(2),
      sevenDTotal.toFixed(2),
      netProfit.toFixed(2),
      netMarginPercent.toFixed(1),
    ];
    rows.push(totals);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `profitability-${getPeriodLabel().replace(/\s+/g, "-")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate date range based on selection
  const getDateRange = () => {
    if (quickPeriod === "this_quarter") {
      return getQuarterRange();
    }
    return getMonthRange(selectedMonth, selectedYear);
  };

  // Handle quick period selection
  const handleQuickPeriod = (period: QuickPeriod) => {
    const currentDate = new Date();
    setQuickPeriod(period);

    if (period === "this_month") {
      setSelectedMonth(currentDate.getMonth());
      setSelectedYear(currentDate.getFullYear());
    } else if (period === "last_month") {
      const lastMonth = currentDate.getMonth() === 0 ? 11 : currentDate.getMonth() - 1;
      const lastMonthYear = currentDate.getMonth() === 0 ? currentDate.getFullYear() - 1 : currentDate.getFullYear();
      setSelectedMonth(lastMonth);
      setSelectedYear(lastMonthYear);
    }
    // this_quarter uses getQuarterRange() directly
  };

  // Handle month/year change (sets to custom mode)
  const handleMonthChange = (month: number) => {
    setSelectedMonth(month);
    setQuickPeriod("custom");
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    setQuickPeriod("custom");
  };

  // Navigate to previous/next month
  const navigateMonth = (direction: "prev" | "next") => {
    let newMonth = selectedMonth;
    let newYear = selectedYear;

    if (direction === "prev") {
      if (selectedMonth === 0) {
        newMonth = 11;
        newYear = selectedYear - 1;
      } else {
        newMonth = selectedMonth - 1;
      }
    } else {
      if (selectedMonth === 11) {
        newMonth = 0;
        newYear = selectedYear + 1;
      } else {
        newMonth = selectedMonth + 1;
      }
    }

    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
    setQuickPeriod("custom");
  };

  // Get period display label
  const getPeriodLabel = () => {
    if (quickPeriod === "this_quarter") {
      const now = new Date();
      const quarter = Math.floor(now.getMonth() / 3) + 1;
      return `Q${quarter} ${now.getFullYear()}`;
    }
    return `${MONTHS[selectedMonth]} ${selectedYear}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!client) return;

      setLoading(true);
      try {
        const { start, end } = getDateRange();

        const [summaryData, productData] = await Promise.all([
          getMyProfitability(client.id, start, end),
          getMyProductProfitability(client.id, start, end),
        ]);

        setSummary(summaryData);
        setProducts(productData);

        // Fetch 7D costs from invoices for the period
        // For now, we'll estimate based on order count and items shipped
        // In a real implementation, this would come from invoice data
        const orderCount = summaryData.orderCount || 0;
        const itemsShipped = summaryData.itemsShipped || 0;

        // Estimated costs (would come from actual invoice data in production)
        const storageFees = itemsShipped * 0.05; // $0.05 per item storage
        const fulfillmentFees = orderCount * 3.50 + itemsShipped * 0.75; // $3.50 per order + $0.75 per item pick/pack
        const shippingCharges = orderCount * 7.50; // avg $7.50 shipping per order
        const suppliesUsed = orderCount * 1.25; // $1.25 avg packaging per order
        const addonFees = orderCount * 0.50; // misc add-ons

        const total = storageFees + fulfillmentFees + shippingCharges + suppliesUsed + addonFees;

        setSevenDCosts({
          storage: storageFees,
          fulfillment: fulfillmentFees,
          shipping: shippingCharges,
          supplies: suppliesUsed,
          addons: addonFees,
          total,
        });
      } catch (err) {
        console.error("Failed to fetch profitability data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [client, selectedMonth, selectedYear, quickPeriod]);

  // Fetch product values when tab changes
  useEffect(() => {
    const fetchProductValues = async () => {
      if (!client || activeTab !== "product_values") return;
      if (productValues.length > 0) return; // Already loaded

      setProductValuesLoading(true);
      try {
        const data = await getMyProductValues(client.id);
        setProductValues(data);
      } catch (err) {
        console.error("Failed to fetch product values:", err);
      } finally {
        setProductValuesLoading(false);
      }
    };

    fetchProductValues();
  }, [client, activeTab, productValues.length]);

  // Filter product values by search
  const filteredProductValues = productValues.filter((pv) =>
    pv.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pv.productSku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check if there are unsaved changes
  const hasUnsavedChanges = Object.keys(editedValues).length > 0;

  // Handle input change for a product
  const handleValueChange = (productId: string, field: "salePrice" | "cost", value: string) => {
    const product = productValues.find((p) => p.productId === productId);
    if (!product) return;

    const currentEdits = editedValues[productId] || {
      salePrice: product.salePrice?.toFixed(2) ?? "",
      cost: product.cost?.toFixed(2) ?? "",
    };

    const newEdits = { ...currentEdits, [field]: value };

    // Check if values are different from original
    const originalSalePrice = product.salePrice?.toFixed(2) ?? "";
    const originalCost = product.cost?.toFixed(2) ?? "";
    const isChanged =
      newEdits.salePrice !== originalSalePrice || newEdits.cost !== originalCost;

    if (isChanged) {
      setEditedValues((prev) => ({ ...prev, [productId]: newEdits }));
    } else {
      // Remove from edited if back to original
      setEditedValues((prev) => {
        const { [productId]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  // Get display value for input (edited or original)
  const getDisplayValue = (product: ProductValue, field: "salePrice" | "cost") => {
    if (editedValues[product.productId]) {
      return editedValues[product.productId][field];
    }
    return field === "salePrice"
      ? product.salePrice?.toFixed(2) ?? ""
      : product.cost?.toFixed(2) ?? "";
  };

  // Save all changed values
  const handleSaveAll = async () => {
    if (!client || !hasUnsavedChanges) return;

    setSaving(true);
    try {
      const updates = Object.entries(editedValues).map(async ([productId, values]) => {
        const salePrice = values.salePrice ? parseFloat(values.salePrice) : null;
        const cost = values.cost ? parseFloat(values.cost) : null;
        return updateMyProductValue(client.id, productId, salePrice, cost);
      });

      const results = await Promise.all(updates);

      // Update local state with all results
      setProductValues((prev) =>
        prev.map((pv) => {
          const updated = results.find((r) => r.productId === pv.productId);
          return updated || pv;
        })
      );
      setEditedValues({});
    } catch (err) {
      console.error("Failed to save product values:", err);
    } finally {
      setSaving(false);
    }
  };

  // Discard all changes
  const handleDiscardChanges = () => {
    setEditedValues({});
  };

  // Import CSV
  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split("\n").filter((line) => line.trim());

        if (lines.length < 2) {
          setImportError("CSV file must have a header row and at least one data row");
          return;
        }

        // Parse header to find column indices
        const header = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/"/g, ""));
        const skuIndex = header.findIndex((h) => h === "sku" || h === "product_sku");
        const salePriceIndex = header.findIndex((h) => h === "sale_price" || h === "saleprice" || h === "price");
        const costIndex = header.findIndex((h) => h === "cost" || h === "unit_cost");

        if (skuIndex === -1) {
          setImportError("CSV must have a 'SKU' column");
          return;
        }

        const newEdits: Record<string, { salePrice: string; cost: string }> = { ...editedValues };
        let matchCount = 0;

        // Parse data rows
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""));
          const sku = values[skuIndex];
          const product = productValues.find((p) => p.productSku.toLowerCase() === sku.toLowerCase());

          if (product) {
            matchCount++;
            const currentEdits = newEdits[product.productId] || {
              salePrice: product.salePrice?.toFixed(2) ?? "",
              cost: product.cost?.toFixed(2) ?? "",
            };

            if (salePriceIndex !== -1 && values[salePriceIndex]) {
              const price = parseFloat(values[salePriceIndex]);
              if (!isNaN(price)) currentEdits.salePrice = price.toFixed(2);
            }
            if (costIndex !== -1 && values[costIndex]) {
              const cost = parseFloat(values[costIndex]);
              if (!isNaN(cost)) currentEdits.cost = cost.toFixed(2);
            }

            newEdits[product.productId] = currentEdits;
          }
        }

        if (matchCount === 0) {
          setImportError("No matching products found. Check that SKUs match.");
          return;
        }

        setEditedValues(newEdits);
        setImportError(null);
      } catch (err) {
        setImportError("Failed to parse CSV file");
      }
    };
    reader.readAsText(file);

    // Reset file input
    event.target.value = "";
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("en-US").format(value);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedProducts = [...enrichedProducts].sort((a, b) => {
    const aVal = a[sortField as keyof typeof a];
    const bVal = b[sortField as keyof typeof b];
    const multiplier = sortDirection === "asc" ? 1 : -1;

    if (typeof aVal === "string" && typeof bVal === "string") {
      return aVal.localeCompare(bVal) * multiplier;
    }
    return ((aVal as number) - (bVal as number)) * multiplier;
  });

  const SortHeader = ({
    field,
    label,
    align = "left",
  }: {
    field: string;
    label: string;
    align?: "left" | "right";
  }) => (
    <th
      onClick={() => handleSort(field)}
      className={`py-3 px-4 text-sm font-medium text-gray-500 cursor-pointer hover:text-gray-700 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortField === field && (
          <span className="text-blue-600">
            {sortDirection === "asc" ? "↑" : "↓"}
          </span>
        )}
      </span>
    </th>
  );

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Profitability</h1>
          <p className="text-gray-500 mt-1">
            Track your revenue, costs, and margins
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab("summary")}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "summary"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Summary
          </button>
          <button
            onClick={() => setActiveTab("product_values")}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "product_values"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            My Product Values
          </button>
        </nav>
      </div>

      {/* Summary Tab */}
      {activeTab === "summary" && (
        <>
          {/* Period Controls */}
          <Card>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Quick Period Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-500 mr-2">Quick:</span>
            <button
              onClick={() => handleQuickPeriod("this_month")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                quickPeriod === "this_month"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => handleQuickPeriod("last_month")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                quickPeriod === "last_month"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Last Month
            </button>
            <button
              onClick={() => handleQuickPeriod("this_quarter")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                quickPeriod === "this_quarter"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              This Quarter
            </button>
          </div>

          {/* Month/Year Selector */}
          <div className="flex items-center gap-2">
            {/* Previous Month Button */}
            <button
              onClick={() => navigateMonth("prev")}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Previous month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Month Dropdown */}
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthChange(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
              >
                {MONTHS.map((month, index) => (
                  <option key={month} value={index}>
                    {month}
                  </option>
                ))}
              </select>

              {/* Year Dropdown */}
              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
              >
                {getYearOptions().map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {/* Next Month Button */}
            <button
              onClick={() => navigateMonth("next")}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Next month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Current Period Display */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Showing data for:{" "}
            <span className="font-semibold text-gray-900">{getPeriodLabel()}</span>
          </p>
        </div>
      </Card>

      {/* Summary Metrics */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Total Sales */}
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Sales</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(totalSales)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Revenue from shipped orders
                </p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </Card>

          {/* Product Cost */}
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">Product Cost</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(productCost)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Your cost of goods
                </p>
              </div>
              <div className="p-2 bg-orange-100 rounded-lg">
                <Boxes className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </Card>

          {/* 7D Costs */}
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">7D Costs</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(sevenDTotal)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  All warehouse fees
                </p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            {/* 7D Costs Breakdown */}
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Storage fees</span>
                <span className="text-gray-700">{formatCurrency(sevenDCosts.storage)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Fulfillment fees</span>
                <span className="text-gray-700">{formatCurrency(sevenDCosts.fulfillment)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Shipping charges</span>
                <span className="text-gray-700">{formatCurrency(sevenDCosts.shipping)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Supplies used</span>
                <span className="text-gray-700">{formatCurrency(sevenDCosts.supplies)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Add-on fees</span>
                <span className="text-gray-700">{formatCurrency(sevenDCosts.addons)}</span>
              </div>
              <div className="flex justify-between text-xs pt-1.5 border-t border-gray-100 font-medium">
                <span className="text-gray-700">Total</span>
                <span className="text-gray-900">{formatCurrency(sevenDCosts.total)}</span>
              </div>
            </div>
          </Card>

          {/* Net Profit */}
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">Net Profit</p>
                <p
                  className={`text-2xl font-bold mt-1 ${
                    netProfit >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatCurrency(netProfit)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Sales − costs − 7D fees
                </p>
              </div>
              <div
                className={`p-2 rounded-lg ${
                  netProfit >= 0 ? "bg-green-100" : "bg-red-100"
                }`}
              >
                {netProfit >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                )}
              </div>
            </div>
          </Card>

          {/* Net Margin % */}
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">Net Margin</p>
                <p
                  className={`text-2xl font-bold mt-1 ${
                    netMarginPercent >= 15
                      ? "text-green-600"
                      : netMarginPercent >= 5
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`}
                >
                  {formatPercent(netMarginPercent)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Net profit ÷ sales
                </p>
              </div>
              <div className="p-2 bg-purple-100 rounded-lg">
                <Percent className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Activity Stats */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{formatNumber(summary.orderCount)}</p>
            <p className="text-sm text-gray-500">Orders Shipped</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{formatNumber(summary.itemsShipped)}</p>
            <p className="text-sm text-gray-500">Items Shipped</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {summary.orderCount > 0 ? formatCurrency(totalSales / summary.orderCount) : "$0.00"}
            </p>
            <p className="text-sm text-gray-500">Avg Order Value</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {summary.orderCount > 0 ? formatCurrency(netProfit / summary.orderCount) : "$0.00"}
            </p>
            <p className="text-sm text-gray-500">Profit per Order</p>
          </div>
        </div>
      )}

      {/* Product Breakdown */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Product Breakdown
            </h2>
            <p className="text-sm text-gray-500">
              {products.length} product{products.length !== 1 ? "s" : ""} • Sort by profit or margin
            </p>
          </div>
          {products.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
        ) : products.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <SortHeader field="productName" label="Product" />
                  <SortHeader field="totalQuantity" label="Units Sold" align="right" />
                  <SortHeader field="totalRevenue" label="Sales" align="right" />
                  <SortHeader field="totalCost" label="Product Cost" align="right" />
                  <SortHeader field="allocated7DCost" label="7D Costs" align="right" />
                  <SortHeader field="netProfit" label="Net Profit" align="right" />
                  <SortHeader field="netMarginPercent" label="Margin %" align="right" />
                </tr>
              </thead>
              <tbody>
                {sortedProducts.map((product) => (
                  <tr
                    key={product.productId}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                  >
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-medium text-gray-900 block">
                          {product.productName}
                        </span>
                        <span className="font-mono text-xs text-gray-500">
                          {product.productSku}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600">
                      {formatNumber(product.totalQuantity)}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-900 font-medium">
                      {formatCurrency(product.totalRevenue)}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600">
                      {formatCurrency(product.totalCost)}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600">
                      {formatCurrency(product.allocated7DCost)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          product.netProfit >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {product.netProfit >= 0 ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4" />
                        )}
                        {formatCurrency(Math.abs(product.netProfit))}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          product.netMarginPercent >= 15
                            ? "bg-green-100 text-green-700"
                            : product.netMarginPercent >= 5
                            ? "bg-yellow-100 text-yellow-700"
                            : product.netMarginPercent >= 0
                            ? "bg-orange-100 text-orange-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {formatPercent(product.netMarginPercent)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totals Row */}
              <tfoot>
                <tr className="bg-gray-50 font-medium">
                  <td className="py-3 px-4 text-gray-700">
                    Total
                  </td>
                  <td className="py-3 px-4 text-right text-gray-900">
                    {formatNumber(totalItemsSold)}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-900">
                    {formatCurrency(totalSales)}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-900">
                    {formatCurrency(productCost)}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-900">
                    {formatCurrency(sevenDTotal)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`font-medium ${
                        netProfit >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {formatCurrency(netProfit)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        netMarginPercent >= 15
                          ? "bg-green-100 text-green-700"
                          : netMarginPercent >= 5
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {formatPercent(netMarginPercent)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No data for this period</p>
            <p className="text-sm mt-1">
              Try selecting a different time period
            </p>
          </div>
        )}
      </Card>

      {/* Info Note */}
          <Card className="bg-blue-50 border-blue-100">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">
                  About Your Profitability Data
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  This report shows profitability based on shipped orders during the
                  selected period. Revenue is calculated from your sale prices, and
                  costs are based on your product cost settings. Contact 7 Degrees if
                  you need to update your pricing information.
                </p>
                <a
                  href="/portal/messages"
                  className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Contact Us
                  <span aria-hidden="true">→</span>
                </a>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Product Values Tab */}
      {activeTab === "product_values" && (
        <Card>
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Product Sale Prices & Costs
                </h2>
                <p className="text-sm text-gray-500">
                  Set your sale prices and costs for accurate profitability tracking
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Import CSV */}
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium cursor-pointer">
                  <Upload className="w-4 h-4" />
                  Import CSV
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleImportCSV}
                    className="hidden"
                  />
                </label>

                {/* Discard Changes */}
                {hasUnsavedChanges && (
                  <button
                    onClick={handleDiscardChanges}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Discard
                  </button>
                )}

                {/* Save All */}
                <button
                  onClick={handleSaveAll}
                  disabled={!hasUnsavedChanges || saving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : `Save All${hasUnsavedChanges ? ` (${Object.keys(editedValues).length})` : ""}`}
                </button>
              </div>
            </div>

            {/* Search and Status */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full sm:w-64 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              {hasUnsavedChanges && (
                <p className="text-sm text-amber-600 font-medium">
                  {Object.keys(editedValues).length} unsaved change{Object.keys(editedValues).length !== 1 ? "s" : ""}
                </p>
              )}
            </div>

            {/* Import Error */}
            {importError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {importError}
              </div>
            )}
          </div>

          {productValuesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            </div>
          ) : filteredProductValues.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                      Product
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                      SKU
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                      Sale Price
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                      Cost
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                      Margin
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProductValues.map((product) => {
                    const isEdited = !!editedValues[product.productId];
                    const displaySalePrice = getDisplayValue(product, "salePrice");
                    const displayCost = getDisplayValue(product, "cost");
                    const effectiveCost = displayCost ? parseFloat(displayCost) : product.defaultUnitCost;
                    const effectiveSalePrice = displaySalePrice ? parseFloat(displaySalePrice) : 0;
                    const margin =
                      effectiveSalePrice > 0
                        ? ((effectiveSalePrice - effectiveCost) / effectiveSalePrice) * 100
                        : 0;

                    return (
                      <tr
                        key={product.productId}
                        className={`border-b border-gray-100 last:border-0 ${
                          isEdited ? "bg-amber-50" : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="py-3 px-4">
                          <span className="font-medium text-gray-900">
                            {product.productName}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-sm text-gray-500">
                            {product.productSku}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={displaySalePrice}
                            onChange={(e) =>
                              handleValueChange(product.productId, "salePrice", e.target.value)
                            }
                            placeholder="0.00"
                            className={`w-28 px-2 py-1.5 text-right border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                              isEdited ? "border-amber-400 bg-white" : "border-gray-300"
                            }`}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={displayCost}
                            onChange={(e) =>
                              handleValueChange(product.productId, "cost", e.target.value)
                            }
                            placeholder={product.defaultUnitCost.toFixed(2)}
                            className={`w-28 px-2 py-1.5 text-right border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                              isEdited ? "border-amber-400 bg-white" : "border-gray-300"
                            }`}
                          />
                        </td>
                        <td className="py-3 px-4 text-right">
                          {effectiveSalePrice > 0 ? (
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                margin >= 15
                                  ? "bg-green-100 text-green-700"
                                  : margin >= 5
                                  ? "bg-yellow-100 text-yellow-700"
                                  : margin >= 0
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {formatPercent(margin)}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              {searchQuery ? (
                <>
                  <p className="font-medium">No products match "{searchQuery}"</p>
                  <p className="text-sm mt-1">Try a different search term</p>
                </>
              ) : (
                <>
                  <p className="font-medium">No products found</p>
                  <p className="text-sm mt-1">
                    Products will appear here once inventory is received
                  </p>
                </>
              )}
            </div>
          )}

          {/* Help Note */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-600">
                <p className="font-medium text-gray-700 mb-1">
                  How these values affect your profitability
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <strong>Your Cost:</strong> Your cost of goods. If blank, the default
                    warehouse cost is used.
                  </li>
                  <li>
                    <strong>Your Sale Price:</strong> What you sell this product for.
                    Used to calculate revenue and margins.
                  </li>
                  <li>
                    <strong>Est. Margin:</strong> Estimated gross margin before 7D
                    fulfillment fees.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
