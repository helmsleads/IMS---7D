"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ClipboardCheck,
  Clock,
  Play,
  CheckCircle,
  XCircle,
  Calendar,
  MapPin,
  User,
  AlertTriangle,
  FileText,
  MoreVertical,
  Eye,
  Trash2,
  RotateCcw,
  Shuffle,
  Package,
  BarChart2,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";
import FetchError from "@/components/ui/FetchError";
import Pagination from "@/components/ui/Pagination";
import {
  getCycleCounts,
  createCycleCount,
  startCycleCount,
  cancelCycleCount,
  CycleCountWithItems,
} from "@/lib/api/cycle-counts";
import { getLocations } from "@/lib/api/locations";
import { handleApiError } from "@/lib/utils/error-handler";
import { CountStatus, CountType } from "@/types/database";

const ITEMS_PER_PAGE = 20;

type CountTab = "pending" | "in_progress" | "completed";

interface Location {
  id: string;
  name: string;
}

function getStatusDisplay(status: CountStatus): {
  label: string;
  variant: "warning" | "info" | "success" | "error" | "default";
  icon: React.ReactNode;
} {
  const statusMap: Record<CountStatus, {
    label: string;
    variant: "warning" | "info" | "success" | "error" | "default";
    icon: React.ReactNode;
  }> = {
    pending: {
      label: "Pending",
      variant: "warning",
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    in_progress: {
      label: "In Progress",
      variant: "info",
      icon: <Play className="w-3.5 h-3.5" />,
    },
    pending_approval: {
      label: "Pending Approval",
      variant: "warning",
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
    },
    completed: {
      label: "Completed",
      variant: "success",
      icon: <CheckCircle className="w-3.5 h-3.5" />,
    },
    cancelled: {
      label: "Cancelled",
      variant: "error",
      icon: <XCircle className="w-3.5 h-3.5" />,
    },
  };
  return statusMap[status] || statusMap.pending;
}

function getCountTypeLabel(type: CountType): string {
  const labels: Record<CountType, string> = {
    cycle: "Cycle Count",
    full: "Full Count",
    spot: "Spot Check",
  };
  return labels[type] || type;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "Not scheduled";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const countTypeOptions = [
  { value: "cycle", label: "Cycle Count" },
  { value: "full", label: "Full Count" },
  { value: "spot", label: "Spot Check" },
];

export default function CycleCountsPage() {
  const router = useRouter();
  const [counts, setCounts] = useState<CycleCountWithItems[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<CountTab>("pending");

  // Schedule Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Form fields
  const [formCountType, setFormCountType] = useState<CountType>("cycle");
  const [formLocationId, setFormLocationId] = useState("");
  const [formScheduledDate, setFormScheduledDate] = useState("");
  const [formAssignedTo, setFormAssignedTo] = useState("");
  const [formBlindCount, setFormBlindCount] = useState(false);
  const [formNotes, setFormNotes] = useState("");

  // Cycle count specific fields
  const [formProductSelection, setFormProductSelection] = useState<"all" | "random" | "specific" | "abc">("all");
  const [formRandomSampleSize, setFormRandomSampleSize] = useState<number>(10);
  const [formAbcClass, setFormAbcClass] = useState<"A" | "B" | "C" | "all">("all");

  // Mock warehouse users (in production, fetch from API)
  const warehouseUsers = [
    { id: "user1", name: "John Smith" },
    { id: "user2", name: "Jane Doe" },
    { id: "user3", name: "Mike Johnson" },
    { id: "user4", name: "Sarah Williams" },
    { id: "user5", name: "Tom Brown" },
  ];

  // Action menu
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  // Date filter for completed tab
  const [completedStartDate, setCompletedStartDate] = useState("");
  const [completedEndDate, setCompletedEndDate] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [countsData, locationsData] = await Promise.all([
        getCycleCounts(),
        getLocations(),
      ]);
      setCounts(countsData);
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

  // Reset page when tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  // Filter counts by tab
  const filteredCounts = useMemo(() => {
    return counts.filter((count) => {
      switch (activeTab) {
        case "pending":
          return count.status === "pending";
        case "in_progress":
          return count.status === "in_progress" || count.status === "pending_approval";
        case "completed":
          // Filter by status
          if (count.status !== "completed" && count.status !== "cancelled") {
            return false;
          }
          // Filter by date range
          if (completedStartDate && count.completed_at) {
            if (new Date(count.completed_at) < new Date(completedStartDate)) {
              return false;
            }
          }
          if (completedEndDate && count.completed_at) {
            const endDate = new Date(completedEndDate);
            endDate.setHours(23, 59, 59, 999);
            if (new Date(count.completed_at) > endDate) {
              return false;
            }
          }
          return true;
        default:
          return true;
      }
    });
  }, [counts, activeTab, completedStartDate, completedEndDate]);

  // Calculate variance summary for completed counts
  const varianceSummary = useMemo(() => {
    const completedCounts = counts.filter(
      (c) => c.status === "completed" || c.status === "cancelled"
    );

    let totalItems = 0;
    let itemsWithVariance = 0;
    let totalPositiveVariance = 0;
    let totalNegativeVariance = 0;

    completedCounts.forEach((count) => {
      count.items?.forEach((item) => {
        if (item.counted_qty !== null) {
          totalItems++;
          if (item.variance && item.variance !== 0) {
            itemsWithVariance++;
            if (item.variance > 0) {
              totalPositiveVariance += item.variance;
            } else {
              totalNegativeVariance += Math.abs(item.variance);
            }
          }
        }
      });
    });

    const accuracyRate = totalItems > 0
      ? ((totalItems - itemsWithVariance) / totalItems * 100).toFixed(1)
      : "100.0";

    return {
      totalItems,
      itemsWithVariance,
      totalPositiveVariance,
      totalNegativeVariance,
      accuracyRate,
    };
  }, [counts]);

  const paginatedCounts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCounts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredCounts, currentPage]);

  const tabCounts = useMemo(() => {
    return {
      pending: counts.filter((c) => c.status === "pending").length,
      in_progress: counts.filter((c) => c.status === "in_progress" || c.status === "pending_approval").length,
      completed: counts.filter((c) => c.status === "completed" || c.status === "cancelled").length,
    };
  }, [counts]);

  const tabs: { key: CountTab; label: string; count: number; icon: React.ReactNode }[] = [
    { key: "pending", label: "Pending", count: tabCounts.pending, icon: <Clock className="w-4 h-4" /> },
    { key: "in_progress", label: "In Progress", count: tabCounts.in_progress, icon: <Play className="w-4 h-4" /> },
    { key: "completed", label: "Completed", count: tabCounts.completed, icon: <CheckCircle className="w-4 h-4" /> },
  ];

  const locationOptions = useMemo(() => {
    const options = locations.map((loc) => ({ value: loc.id, label: loc.name }));
    return [{ value: "all", label: "All Locations" }, ...options];
  }, [locations]);

  const userOptions = useMemo(() => {
    return warehouseUsers.map((user) => ({ value: user.name, label: user.name }));
  }, []);

  const productSelectionOptions = [
    { value: "all", label: "All Products" },
    { value: "random", label: "Random Sample" },
    { value: "specific", label: "Specific Products" },
    { value: "abc", label: "ABC Classification" },
  ];

  const abcClassOptions = [
    { value: "all", label: "All Classes" },
    { value: "A", label: "Class A (High Value)" },
    { value: "B", label: "Class B (Medium Value)" },
    { value: "C", label: "Class C (Low Value)" },
  ];

  const resetForm = () => {
    setFormCountType("cycle");
    setFormLocationId("");
    setFormScheduledDate("");
    setFormAssignedTo("");
    setFormBlindCount(false);
    setFormNotes("");
    setFormProductSelection("all");
    setFormRandomSampleSize(10);
    setFormAbcClass("all");
    setScheduleError("");
  };

  const handleScheduleCount = async () => {
    // Location is optional for full counts
    if (formCountType !== "full" && !formLocationId) {
      setScheduleError("Please select a location");
      return;
    }

    setScheduleLoading(true);
    setScheduleError("");

    try {
      await createCycleCount({
        count_type: formCountType,
        location_id: formLocationId,
        scheduled_date: formScheduledDate || null,
        assigned_to: formAssignedTo || null,
        blind_count: formBlindCount,
        notes: formNotes || null,
      });

      setSuccessMessage("Cycle count scheduled successfully");
      setShowScheduleModal(false);
      resetForm();
      fetchData();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setScheduleError(handleApiError(err));
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleStartCount = async (count: CycleCountWithItems) => {
    try {
      await startCycleCount(count.id);
      setSuccessMessage("Count started");
      fetchData();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(handleApiError(err));
    }
    setActionMenuOpen(null);
  };

  const handleCancelCount = async (count: CycleCountWithItems) => {
    if (!confirm("Are you sure you want to cancel this count?")) return;

    try {
      await cancelCycleCount(count.id);
      setSuccessMessage("Count cancelled");
      fetchData();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(handleApiError(err));
    }
    setActionMenuOpen(null);
  };

  // Unified columns for all tabs
  const columns = [
    {
      key: "count_number",
      header: "Count Number",
      mobilePriority: 1,
      render: (count: CycleCountWithItems) => (
        <span className="font-medium text-gray-900 font-mono">
          {count.count_number}
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (count: CycleCountWithItems) => {
        const typeColors: Record<CountType, string> = {
          cycle: "bg-blue-100 text-blue-700",
          full: "bg-purple-100 text-purple-700",
          spot: "bg-orange-100 text-orange-700",
        };
        return (
          <span className={`px-2 py-1 rounded-md text-xs font-medium ${typeColors[count.count_type]}`}>
            {getCountTypeLabel(count.count_type)}
          </span>
        );
      },
    },
    {
      key: "location",
      header: "Location",
      mobilePriority: 2,
      render: (count: CycleCountWithItems) => (
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-400" />
          <span>{count.location?.name || "All Locations"}</span>
        </div>
      ),
    },
    {
      key: "scheduled_date",
      header: "Scheduled Date",
      hideOnMobile: true,
      render: (count: CycleCountWithItems) => (
        <span className="text-sm text-gray-600">
          {formatDate(count.scheduled_date)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      mobilePriority: 3,
      render: (count: CycleCountWithItems) => {
        const statusInfo = getStatusDisplay(count.status);
        return (
          <Badge variant={statusInfo.variant} size="sm">
            <span className="flex items-center gap-1">
              {statusInfo.icon}
              {statusInfo.label}
            </span>
          </Badge>
        );
      },
    },
    {
      key: "assigned_to",
      header: "Assigned To",
      hideOnMobile: true,
      render: (count: CycleCountWithItems) => (
        count.assigned_to ? (
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            <span className="text-sm">{count.assigned_to}</span>
          </div>
        ) : (
          <span className="text-gray-400 text-sm">Unassigned</span>
        )
      ),
    },
    {
      key: "items_counted",
      header: "Items Counted",
      render: (count: CycleCountWithItems) => {
        const itemCount = count.items?.length || 0;
        const countedCount = count.items?.filter((i) => i.counted_qty !== null).length || 0;
        const progressPercent = itemCount > 0 ? (countedCount / itemCount) * 100 : 0;

        return (
          <div className="min-w-[100px]">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium">{countedCount}</span>
              <span className="text-gray-400">/ {itemCount}</span>
            </div>
            {count.status === "in_progress" && (
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    progressPercent === 100 ? "bg-green-500" : "bg-blue-500"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "variance",
      header: "Variance",
      hideOnMobile: true,
      render: (count: CycleCountWithItems) => {
        const itemsWithVariance = count.items?.filter(
          (i) => i.variance !== null && i.variance !== 0
        ).length || 0;

        if (count.status === "pending" || count.status === "cancelled") {
          return <span className="text-gray-400">-</span>;
        }

        if (itemsWithVariance === 0) {
          return (
            <span className="text-green-600 text-sm font-medium">
              None
            </span>
          );
        }

        return (
          <span className="text-yellow-600 text-sm font-medium">
            {itemsWithVariance} item{itemsWithVariance !== 1 ? "s" : ""}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (count: CycleCountWithItems) => (
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setActionMenuOpen(actionMenuOpen === count.id ? null : count.id);
            }}
          >
            <MoreVertical className="w-4 h-4" />
          </Button>

          {actionMenuOpen === count.id && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setActionMenuOpen(null)}
              />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/cycle-counts/${count.id}`);
                    setActionMenuOpen(null);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Eye className="w-4 h-4" />
                  View Details
                </button>

                {count.status === "pending" && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartCount(count);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50"
                    >
                      <Play className="w-4 h-4" />
                      Start Count
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelCount(count);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Cancel Count
                    </button>
                  </>
                )}

                {count.status === "in_progress" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/cycle-counts/${count.id}?action=count`);
                      setActionMenuOpen(null);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-green-600 hover:bg-green-50"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    Continue Counting
                  </button>
                )}

                {count.status === "pending_approval" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/cycle-counts/${count.id}?action=approve`);
                      setActionMenuOpen(null);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-orange-600 hover:bg-orange-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Review & Approve
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      ),
    },
  ];

  const actionButtons = (
    <Button onClick={() => setShowScheduleModal(true)}>
      <Plus className="w-4 h-4 mr-1" />
      Schedule Count
    </Button>
  );

  if (error && !counts.length) {
    return (
      <AppShell title="Cycle Counts" actions={actionButtons}>
        <FetchError message={error} onRetry={fetchData} />
      </AppShell>
    );
  }

  return (
    <AppShell title="Cycle Counts" actions={actionButtons}>
      {/* Subtitle */}
      <p className="text-gray-500 -mt-4 mb-6">
        Inventory counting and reconciliation
      </p>

      {successMessage && (
        <div className="mb-4">
          <Alert type="success" message={successMessage} onClose={() => setSuccessMessage("")} />
        </div>
      )}

      {error && (
        <div className="mb-4">
          <Alert type="error" message={error} onClose={() => setError(null)} />
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ClipboardCheck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Counts</p>
              <p className="text-xl font-semibold text-gray-900">
                {counts.length}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-xl font-semibold text-yellow-600">
                {tabCounts.pending}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Play className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">In Progress</p>
              <p className="text-xl font-semibold text-blue-600">
                {tabCounts.in_progress}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Completed</p>
              <p className="text-xl font-semibold text-green-600">
                {tabCounts.completed}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-4">
        <div className="flex gap-4 -mb-px overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${activeTab === tab.key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              {tab.icon}
              {tab.label}
              {tab.count > 0 && (
                <span className={`
                  px-2 py-0.5 text-xs rounded-full
                  ${activeTab === tab.key
                    ? "bg-blue-100 text-blue-600"
                    : "bg-gray-100 text-gray-600"
                  }
                `}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Completed Tab Filters & Summary */}
      {activeTab === "completed" && (
        <div className="mb-4 space-y-4">
          {/* Date Filter */}
          <div className="flex flex-wrap items-end gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={completedStartDate}
                onChange={(e) => setCompletedStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={completedEndDate}
                onChange={(e) => setCompletedEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {(completedStartDate || completedEndDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCompletedStartDate("");
                  setCompletedEndDate("");
                }}
                className="text-gray-500"
              >
                <XCircle className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Variance Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Accuracy Rate</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {varianceSummary.accuracyRate}%
                </p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Items Counted</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {varianceSummary.totalItems}
                </p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Items with Variance</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">
                  {varianceSummary.itemsWithVariance}
                </p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Over (+)</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  +{varianceSummary.totalPositiveVariance}
                </p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Short (-)</p>
                <p className="text-2xl font-bold text-red-600 mt-1">
                  -{varianceSummary.totalNegativeVariance}
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Counts List */}
      {!loading && filteredCounts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardCheck className="w-12 h-12" />}
            title={`No ${activeTab.replace("_", " ")} counts`}
            description={
              activeTab === "pending"
                ? "Schedule a new cycle count to get started."
                : activeTab === "in_progress"
                ? "No counts are currently in progress."
                : "No completed counts to display."
            }
            action={
              activeTab === "pending" && (
                <Button onClick={() => setShowScheduleModal(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Schedule Count
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <Card padding="none">
          <Table
            columns={columns}
            data={paginatedCounts}
            loading={loading}
            emptyMessage="No cycle counts found"
            onRowClick={(count) => router.push(`/cycle-counts/${count.id}`)}
          />
          <Pagination
            currentPage={currentPage}
            totalItems={filteredCounts.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
          />
        </Card>
      )}

      {/* Schedule Count Modal */}
      <Modal
        isOpen={showScheduleModal}
        onClose={() => {
          setShowScheduleModal(false);
          resetForm();
        }}
        title="Schedule Cycle Count"
      >
        <div className="space-y-4">
          {scheduleError && (
            <Alert type="error" message={scheduleError} onClose={() => setScheduleError("")} />
          )}

          {/* Count Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Count Type <span className="text-red-500">*</span>
            </label>
            <Select
              name="countType"
              options={countTypeOptions}
              value={formCountType}
              onChange={(e) => setFormCountType(e.target.value as CountType)}
            />
            <p className="text-xs text-gray-500 mt-1">
              {formCountType === "cycle" && "Regular inventory count for a specific location"}
              {formCountType === "full" && "Complete inventory count of all items"}
              {formCountType === "spot" && "Quick check of specific items or areas"}
            </p>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location <span className="text-red-500">*</span>
            </label>
            <Select
              name="location"
              options={locationOptions}
              value={formLocationId}
              onChange={(e) => setFormLocationId(e.target.value)}
              placeholder="Select location..."
            />
          </div>

          {/* Scheduled Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scheduled Date
            </label>
            <input
              type="date"
              value={formScheduledDate}
              onChange={(e) => setFormScheduledDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Assigned To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assign To
            </label>
            <Select
              name="assignedTo"
              options={userOptions}
              value={formAssignedTo}
              onChange={(e) => setFormAssignedTo(e.target.value)}
              placeholder="Select warehouse user..."
            />
          </div>

          {/* Cycle Count Specific Options */}
          {formCountType === "cycle" && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center gap-2 text-blue-700 font-medium text-sm">
                <Shuffle className="w-4 h-4" />
                Cycle Count Options
              </div>

              {/* Product Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Selection
                </label>
                <Select
                  name="productSelection"
                  options={productSelectionOptions}
                  value={formProductSelection}
                  onChange={(e) => setFormProductSelection(e.target.value as "all" | "random" | "specific" | "abc")}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formProductSelection === "all" && "Count all products in the selected location"}
                  {formProductSelection === "random" && "Randomly select a sample of products to count"}
                  {formProductSelection === "specific" && "Select specific products to count"}
                  {formProductSelection === "abc" && "Count products based on ABC classification"}
                </p>
              </div>

              {/* Random Sample Size */}
              {formProductSelection === "random" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sample Size
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={formRandomSampleSize}
                      onChange={(e) => setFormRandomSampleSize(parseInt(e.target.value) || 10)}
                      min={1}
                      max={100}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">products</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Number of products to randomly select for counting
                  </p>
                </div>
              )}

              {/* ABC Classification */}
              {formProductSelection === "abc" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ABC Classification
                  </label>
                  <Select
                    name="abcClass"
                    options={abcClassOptions}
                    value={formAbcClass}
                    onChange={(e) => setFormAbcClass(e.target.value as "A" | "B" | "C" | "all")}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formAbcClass === "all" && "Count products from all ABC classes"}
                    {formAbcClass === "A" && "Count high-value items (typically 20% of SKUs, 80% of value)"}
                    {formAbcClass === "B" && "Count medium-value items (typically 30% of SKUs, 15% of value)"}
                    {formAbcClass === "C" && "Count low-value items (typically 50% of SKUs, 5% of value)"}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Blind Count */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="blindCount"
              checked={formBlindCount}
              onChange={(e) => setFormBlindCount(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <label htmlFor="blindCount" className="text-sm font-medium text-gray-700">
                Blind Count
              </label>
              <p className="text-xs text-gray-500">
                Hide expected quantities from the counter to avoid bias
              </p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Add any special instructions..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => {
                setShowScheduleModal(false);
                resetForm();
              }}
              disabled={scheduleLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleScheduleCount}
              loading={scheduleLoading}
            >
              Schedule Count
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
