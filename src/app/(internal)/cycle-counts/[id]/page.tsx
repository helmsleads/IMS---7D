"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardCheck,
  Clock,
  Play,
  CheckCircle,
  XCircle,
  Calendar,
  MapPin,
  MapPinned,
  User,
  AlertTriangle,
  Package,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Check,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  Search,
  MessageSquare,
  ScanBarcode,
  Volume2,
  DollarSign,
  BarChart3,
  CircleCheck,
  CircleAlert,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Alert from "@/components/ui/Alert";
import Modal from "@/components/ui/Modal";
import FetchError from "@/components/ui/FetchError";
import Spinner from "@/components/ui/Spinner";
import {
  getCycleCount,
  startCycleCount,
  completeCycleCount,
  approveCycleCount,
  cancelCycleCount,
  rejectCycleCount,
  recordCount,
  CycleCountWithItems,
  CycleCountItemWithProduct,
} from "@/lib/api/cycle-counts";
import { handleApiError } from "@/lib/utils/error-handler";
import { CountStatus, CountType } from "@/types/database";
import { useAuth } from "@/lib/auth-context";

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
      icon: <Clock className="w-4 h-4" />,
    },
    in_progress: {
      label: "In Progress",
      variant: "info",
      icon: <Play className="w-4 h-4" />,
    },
    pending_approval: {
      label: "Pending Approval",
      variant: "warning",
      icon: <AlertTriangle className="w-4 h-4" />,
    },
    completed: {
      label: "Completed",
      variant: "success",
      icon: <CheckCircle className="w-4 h-4" />,
    },
    cancelled: {
      label: "Cancelled",
      variant: "error",
      icon: <XCircle className="w-4 h-4" />,
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
  if (!dateString) return "Not set";
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
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CycleCountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const countId = params.id as string;

  const [cycleCount, setCycleCount] = useState<CycleCountWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Count recording state
  const [countInputs, setCountInputs] = useState<Record<string, string>>({});
  const [notesInputs, setNotesInputs] = useState<Record<string, string>>({});
  const [savingItems, setSavingItems] = useState<Record<string, boolean>>({});
  const [savedItems, setSavedItems] = useState<Record<string, boolean>>({});
  const [showExpected, setShowExpected] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Approval modal
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");

  // Barcode scanning
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scannerMode, setScannerMode] = useState(false);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const itemContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Variance approval state
  const [approvedVariances, setApprovedVariances] = useState<Record<string, boolean>>({});
  const [rejectLoading, setRejectLoading] = useState(false);

  const action = searchParams.get("action");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCycleCount(countId);
      if (!data) {
        setError("Cycle count not found");
        return;
      }
      setCycleCount(data);

      // Initialize count inputs and notes with existing values
      const inputs: Record<string, string> = {};
      const notes: Record<string, string> = {};
      data.items.forEach((item) => {
        if (item.counted_qty !== null) {
          inputs[item.id] = item.counted_qty.toString();
        }
        if (item.notes) {
          notes[item.id] = item.notes;
        }
      });
      setCountInputs(inputs);
      setNotesInputs(notes);

      // Hide expected quantities if blind count
      if (data.blind_count) {
        setShowExpected(false);
      }
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [countId]);

  // Calculate progress and variance summary
  const summary = useMemo(() => {
    if (!cycleCount?.items) {
      return {
        totalItems: 0,
        countedItems: 0,
        progressPercent: 0,
        itemsWithVariance: 0,
        totalPositiveVariance: 0,
        totalNegativeVariance: 0,
        positiveVarianceCost: 0,
        negativeVarianceCost: 0,
        netVarianceCost: 0,
        accuracyRate: "100.0",
        isComplete: false,
      };
    }

    const totalItems = cycleCount.items.length;
    const countedItems = cycleCount.items.filter((i) => i.counted_qty !== null).length;
    const progressPercent = totalItems > 0 ? (countedItems / totalItems) * 100 : 0;
    const isComplete = countedItems === totalItems && totalItems > 0;

    let itemsWithVariance = 0;
    let totalPositiveVariance = 0;
    let totalNegativeVariance = 0;
    let positiveVarianceCost = 0;
    let negativeVarianceCost = 0;

    cycleCount.items.forEach((item) => {
      if (item.variance !== null && item.variance !== 0) {
        itemsWithVariance++;
        const unitCost = item.product.unit_cost || 0;
        if (item.variance > 0) {
          totalPositiveVariance += item.variance;
          positiveVarianceCost += item.variance * unitCost;
        } else {
          totalNegativeVariance += Math.abs(item.variance);
          negativeVarianceCost += Math.abs(item.variance) * unitCost;
        }
      }
    });

    const netVarianceCost = positiveVarianceCost - negativeVarianceCost;

    const accuracyRate = countedItems > 0
      ? ((countedItems - itemsWithVariance) / countedItems * 100).toFixed(1)
      : "100.0";

    return {
      totalItems,
      countedItems,
      progressPercent,
      itemsWithVariance,
      totalPositiveVariance,
      totalNegativeVariance,
      positiveVarianceCost,
      negativeVarianceCost,
      netVarianceCost,
      accuracyRate,
      isComplete,
    };
  }, [cycleCount]);

  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!cycleCount?.items) return [];
    if (!searchQuery.trim()) return cycleCount.items;

    const query = searchQuery.toLowerCase();
    return cycleCount.items.filter(
      (item) =>
        item.product.sku.toLowerCase().includes(query) ||
        item.product.name.toLowerCase().includes(query)
    );
  }, [cycleCount?.items, searchQuery]);

  // Get items with variances for approval
  const varianceItems = useMemo(() => {
    if (!cycleCount?.items) return [];
    return cycleCount.items.filter(
      (item) => item.variance !== null && item.variance !== 0
    );
  }, [cycleCount?.items]);

  // Initialize approved variances when variance items change
  useEffect(() => {
    if (varianceItems.length > 0 && Object.keys(approvedVariances).length === 0) {
      const initialApprovals: Record<string, boolean> = {};
      varianceItems.forEach((item) => {
        initialApprovals[item.id] = true; // Default to approved
      });
      setApprovedVariances(initialApprovals);
    }
  }, [varianceItems]);

  // Check if all variances are approved
  const allVariancesApproved = useMemo(() => {
    return varianceItems.every((item) => approvedVariances[item.id]);
  }, [varianceItems, approvedVariances]);

  // Count of approved variances
  const approvedCount = useMemo(() => {
    return varianceItems.filter((item) => approvedVariances[item.id]).length;
  }, [varianceItems, approvedVariances]);

  const handleStartCount = async () => {
    setActionLoading(true);
    try {
      await startCycleCount(countId);
      setSuccessMessage("Count started successfully");
      fetchData();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteCount = async () => {
    // Check if all items have been counted
    const uncountedItems = cycleCount?.items.filter((i) => i.counted_qty === null).length || 0;
    if (uncountedItems > 0) {
      if (!confirm(`${uncountedItems} item(s) have not been counted. Complete anyway?`)) {
        return;
      }
    }

    setActionLoading(true);
    try {
      await completeCycleCount(countId);
      setSuccessMessage("Count submitted for approval");
      fetchData();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveCount = async () => {
    setActionLoading(true);
    try {
      await approveCycleCount(countId, user?.email || "admin");
      setSuccessMessage("Count approved and inventory adjusted");
      setShowApproveModal(false);
      fetchData();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelCount = async () => {
    if (!confirm("Are you sure you want to cancel this count?")) return;

    setActionLoading(true);
    try {
      await cancelCycleCount(countId);
      setSuccessMessage("Count cancelled");
      fetchData();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  // Variance approval handlers
  const handleToggleVarianceApproval = (itemId: string) => {
    setApprovedVariances((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleApproveAllVariances = () => {
    const allApproved: Record<string, boolean> = {};
    varianceItems.forEach((item) => {
      allApproved[item.id] = true;
    });
    setApprovedVariances(allApproved);
  };

  const handleRejectCount = async () => {
    if (!confirm("Are you sure you want to reject this count? All counted quantities will be cleared and the count will restart.")) {
      return;
    }

    setRejectLoading(true);
    try {
      await rejectCycleCount(countId);
      setSuccessMessage("Count rejected and reset for recounting");
      setApprovedVariances({});
      fetchData();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setRejectLoading(false);
    }
  };

  const handleFinalApprove = async () => {
    // Check if any variances are approved
    const approvedItems = varianceItems.filter((item) => approvedVariances[item.id]);

    if (approvedItems.length === 0 && varianceItems.length > 0) {
      if (!confirm("No variances are approved. The count will be completed without inventory adjustments. Continue?")) {
        return;
      }
    }

    setActionLoading(true);
    try {
      await approveCycleCount(countId, user?.email || "admin");
      setSuccessMessage(`Count approved! ${approvedItems.length} inventory adjustment(s) applied.`);
      setShowApproveModal(false);
      fetchData();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveCount = async (item: CycleCountItemWithProduct, showFeedback = true) => {
    const inputValue = countInputs[item.id];
    if (inputValue === undefined || inputValue === "") return;

    const countedQty = parseInt(inputValue, 10);
    if (isNaN(countedQty) || countedQty < 0) {
      setError("Please enter a valid quantity");
      return;
    }

    const notes = notesInputs[item.id] || null;

    setSavingItems((prev) => ({ ...prev, [item.id]: true }));
    try {
      await recordCount(item.id, countedQty, user?.email || "unknown", notes);
      if (showFeedback) {
        setSavedItems((prev) => ({ ...prev, [item.id]: true }));
        setTimeout(() => {
          setSavedItems((prev) => ({ ...prev, [item.id]: false }));
        }, 2000);
      }
      fetchData();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setSavingItems((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  // Auto-save on blur
  const handleBlurSave = (item: CycleCountItemWithProduct) => {
    const inputValue = countInputs[item.id];
    // Only save if there's a value and it's different from the saved value
    if (inputValue !== undefined && inputValue !== "") {
      const countedQty = parseInt(inputValue, 10);
      if (!isNaN(countedQty) && countedQty >= 0 && countedQty !== item.counted_qty) {
        handleSaveCount(item, false);
      }
    }
  };

  // Barcode scanning handler
  const handleBarcodeScan = useCallback((barcode: string) => {
    if (!cycleCount?.items || !barcode.trim()) return;

    // Find item by SKU or barcode
    const normalizedBarcode = barcode.trim().toLowerCase();
    const matchedItem = cycleCount.items.find(
      (item) =>
        item.product.sku.toLowerCase() === normalizedBarcode ||
        (item.product as { barcode?: string }).barcode?.toLowerCase() === normalizedBarcode
    );

    if (matchedItem) {
      // Success - scroll to item and focus input
      setHighlightedItemId(matchedItem.id);
      setScanFeedback({ type: "success", message: `Found: ${matchedItem.product.name}` });

      // Scroll to item
      const container = itemContainerRefs.current[matchedItem.id];
      if (container) {
        container.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      // Focus the quantity input after a short delay
      setTimeout(() => {
        const input = itemRefs.current[matchedItem.id];
        if (input) {
          input.focus();
          input.select();
        }
      }, 300);

      // Clear highlight after 3 seconds
      setTimeout(() => {
        setHighlightedItemId(null);
      }, 3000);

      // Play success sound (optional - uses Web Audio API)
      try {
        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 800;
        oscillator.type = "sine";
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
      } catch {
        // Audio not supported, ignore
      }
    } else {
      // Not found
      setScanFeedback({ type: "error", message: `Product not found: ${barcode}` });

      // Play error sound
      try {
        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 200;
        oscillator.type = "sine";
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      } catch {
        // Audio not supported, ignore
      }
    }

    // Clear feedback after 3 seconds
    setTimeout(() => {
      setScanFeedback(null);
    }, 3000);

    // Clear barcode input
    setBarcodeInput("");
  }, [cycleCount?.items]);

  // Handle barcode input keydown (Enter key triggers scan)
  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleBarcodeScan(barcodeInput);
    }
  };

  const getVarianceDisplay = (item: CycleCountItemWithProduct, large = false) => {
    if (item.variance === null) return null;

    const iconSize = large ? "w-6 h-6" : "w-5 h-5";
    const textSize = large ? "text-xl font-bold" : "text-lg font-semibold";

    if (item.variance === 0) {
      return (
        <div className={`flex items-center justify-center gap-2 ${textSize} text-green-600`}>
          <div className="p-1.5 bg-green-100 rounded-full">
            <Check className={iconSize} />
          </div>
          <span>Match</span>
        </div>
      );
    }
    if (item.variance > 0) {
      return (
        <div className={`flex items-center justify-center gap-2 ${textSize} text-blue-600`}>
          <div className="p-1.5 bg-blue-100 rounded-full">
            <TrendingUp className={iconSize} />
          </div>
          <span>+{item.variance}</span>
        </div>
      );
    }
    return (
      <div className={`flex items-center justify-center gap-2 ${textSize} text-red-600`}>
        <div className="p-1.5 bg-red-100 rounded-full">
          <TrendingDown className={iconSize} />
        </div>
        <span>{item.variance}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <AppShell title="Loading...">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (error && !cycleCount) {
    return (
      <AppShell title="Cycle Count">
        <FetchError message={error} onRetry={fetchData} />
      </AppShell>
    );
  }

  if (!cycleCount) {
    return (
      <AppShell title="Not Found">
        <Card>
          <div className="text-center py-8">
            <p className="text-gray-500">Cycle count not found</p>
            <Link href="/cycle-counts" className="text-blue-600 hover:underline mt-2 inline-block">
              Back to Cycle Counts
            </Link>
          </div>
        </Card>
      </AppShell>
    );
  }

  const statusInfo = getStatusDisplay(cycleCount.status);
  const isEditable = cycleCount.status === "in_progress";
  const canStart = cycleCount.status === "pending";
  const canComplete = cycleCount.status === "in_progress" && summary.countedItems > 0;
  const canApprove = cycleCount.status === "pending_approval";
  const canCancel = cycleCount.status === "pending" || cycleCount.status === "in_progress";

  return (
    <AppShell title={`Count ${cycleCount.count_number}`}>
      <Breadcrumbs items={[
        { label: "Cycle Counts", href: "/cycle-counts" },
        { label: cycleCount.count_number || "Count Details" }
      ]} />
      {/* Back Link */}
      <div className="mb-4">
        <Link
          href="/cycle-counts"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Cycle Counts
        </Link>
      </div>

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

      {/* Count Header */}
      <Card className="mb-6">
        {/* Top Row: Count Number, Status, Actions */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 pb-4 border-b border-gray-200">
          <div>
            {/* Count Number */}
            <h2 className="text-2xl font-bold text-gray-900 font-mono">
              {cycleCount.count_number}
            </h2>
            {/* Type and Status */}
            <div className="flex items-center gap-3 mt-2">
              <Badge variant={statusInfo.variant} size="md">
                <span className="flex items-center gap-1.5">
                  {statusInfo.icon}
                  {statusInfo.label}
                </span>
              </Badge>
              <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-sm font-medium">
                {getCountTypeLabel(cycleCount.count_type)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {canStart && (
              <Button onClick={handleStartCount} loading={actionLoading} size="lg">
                <Play className="w-5 h-5 mr-2" />
                Start Count
              </Button>
            )}
            {canComplete && (
              <Button onClick={handleCompleteCount} loading={actionLoading} size="lg">
                <CheckCircle className="w-5 h-5 mr-2" />
                Complete Count
              </Button>
            )}
            {canApprove && (
              <Button onClick={() => setShowApproveModal(true)} loading={actionLoading} size="lg">
                <Check className="w-5 h-5 mr-2" />
                Approve & Adjust
              </Button>
            )}
            {canCancel && (
              <Button variant="secondary" onClick={handleCancelCount} loading={actionLoading}>
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Middle Row: Details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-b border-gray-200">
          {/* Location */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Location</p>
            <div className="flex items-center gap-2 text-gray-900">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="font-medium">
                {cycleCount.location?.name || "All Locations"}
              </span>
            </div>
          </div>

          {/* Assigned To */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Assigned To</p>
            <div className="flex items-center gap-2 text-gray-900">
              <User className="w-4 h-4 text-gray-400" />
              <span className="font-medium">
                {cycleCount.assigned_to || "Unassigned"}
              </span>
            </div>
          </div>

          {/* Scheduled Date */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Scheduled</p>
            <div className="flex items-center gap-2 text-gray-900">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="font-medium">
                {formatDate(cycleCount.scheduled_date)}
              </span>
            </div>
          </div>

          {/* Blind Count */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Count Mode</p>
            <div className="flex items-center gap-2 text-gray-900">
              {cycleCount.blind_count ? (
                <>
                  <EyeOff className="w-4 h-4 text-yellow-500" />
                  <span className="font-medium text-yellow-700">Blind Count</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">Standard</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Row: Progress */}
        <div className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Progress</p>
            <p className="text-lg font-bold text-gray-900">
              {summary.countedItems} <span className="text-gray-400 font-normal">of</span> {summary.totalItems} <span className="text-gray-500 font-normal text-sm">items counted</span>
            </p>
          </div>
          <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                summary.progressPercent === 100 ? "bg-green-500" : "bg-blue-500"
              }`}
              style={{ width: `${summary.progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-500">
              {summary.progressPercent.toFixed(0)}% complete
            </p>
            {summary.itemsWithVariance > 0 && (
              <p className="text-xs text-yellow-600 font-medium">
                {summary.itemsWithVariance} item{summary.itemsWithVariance !== 1 ? "s" : ""} with variance
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Summary Section - Shows during counting */}
      {(cycleCount.status === "in_progress" ||
        cycleCount.status === "pending_approval" ||
        cycleCount.status === "completed") && !summary.isComplete && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Accuracy</p>
              <p className={`text-2xl font-bold mt-1 ${
                parseFloat(summary.accuracyRate) >= 95 ? "text-green-600" :
                parseFloat(summary.accuracyRate) >= 90 ? "text-yellow-600" : "text-red-600"
              }`}>
                {summary.accuracyRate}%
              </p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Items</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{summary.totalItems}</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Counted</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{summary.countedItems}</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Over (+)</p>
              <p className="text-2xl font-bold text-green-600 mt-1">+{summary.totalPositiveVariance}</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Short (-)</p>
              <p className="text-2xl font-bold text-red-600 mt-1">-{summary.totalNegativeVariance}</p>
            </div>
          </Card>
        </div>
      )}

      {/* Complete Count Summary - Shows after all items counted */}
      {summary.isComplete && (
        <Card className="mb-6 border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-green-200">
            <div className="p-3 bg-green-100 rounded-xl">
              <CircleCheck className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Count Complete</h3>
              <p className="text-sm text-gray-500">All {summary.totalItems} items have been counted</p>
            </div>
          </div>

          {/* Summary Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {/* Total Items Counted */}
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-gray-400" />
                <p className="text-xs text-gray-500 uppercase tracking-wide">Items Counted</p>
              </div>
              <p className="text-3xl font-bold text-gray-900">{summary.countedItems}</p>
            </div>

            {/* Items with Variances */}
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <CircleAlert className="w-4 h-4 text-yellow-500" />
                <p className="text-xs text-gray-500 uppercase tracking-wide">With Variance</p>
              </div>
              <p className={`text-3xl font-bold ${summary.itemsWithVariance > 0 ? "text-yellow-600" : "text-green-600"}`}>
                {summary.itemsWithVariance}
              </p>
            </div>

            {/* Accuracy Rate */}
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                <p className="text-xs text-gray-500 uppercase tracking-wide">Accuracy</p>
              </div>
              <p className={`text-3xl font-bold ${
                parseFloat(summary.accuracyRate) >= 95 ? "text-green-600" :
                parseFloat(summary.accuracyRate) >= 90 ? "text-yellow-600" : "text-red-600"
              }`}>
                {summary.accuracyRate}%
              </p>
            </div>

            {/* Total Positive Variance */}
            <div className="bg-white rounded-xl p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <p className="text-xs text-gray-500 uppercase tracking-wide">Over (Qty)</p>
              </div>
              <p className="text-3xl font-bold text-blue-600">+{summary.totalPositiveVariance}</p>
            </div>

            {/* Total Negative Variance */}
            <div className="bg-white rounded-xl p-4 border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <p className="text-xs text-gray-500 uppercase tracking-wide">Short (Qty)</p>
              </div>
              <p className="text-3xl font-bold text-red-600">-{summary.totalNegativeVariance}</p>
            </div>

            {/* Net Variance Cost */}
            <div className={`bg-white rounded-xl p-4 border ${
              summary.netVarianceCost >= 0 ? "border-blue-200" : "border-red-200"
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className={`w-4 h-4 ${summary.netVarianceCost >= 0 ? "text-blue-500" : "text-red-500"}`} />
                <p className="text-xs text-gray-500 uppercase tracking-wide">Net Impact</p>
              </div>
              <p className={`text-3xl font-bold ${summary.netVarianceCost >= 0 ? "text-blue-600" : "text-red-600"}`}>
                {summary.netVarianceCost >= 0 ? "+" : ""}${Math.abs(summary.netVarianceCost).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Detailed Cost Breakdown */}
          {summary.itemsWithVariance > 0 && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Cost Impact Breakdown
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                  <span className="text-sm text-gray-600">Found More (Value)</span>
                  <span className="font-semibold text-blue-600">
                    +${summary.positiveVarianceCost.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                  <span className="text-sm text-gray-600">Found Less (Value)</span>
                  <span className="font-semibold text-red-600">
                    -${summary.negativeVarianceCost.toFixed(2)}
                  </span>
                </div>
                <div className={`flex items-center justify-between p-3 rounded-lg ${
                  summary.netVarianceCost >= 0 ? "bg-blue-100" : "bg-red-100"
                }`}>
                  <span className="text-sm font-medium text-gray-700">Net Variance</span>
                  <span className={`font-bold ${summary.netVarianceCost >= 0 ? "text-blue-700" : "text-red-700"}`}>
                    {summary.netVarianceCost >= 0 ? "+" : ""}${summary.netVarianceCost.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* No Variance Message */}
          {summary.itemsWithVariance === 0 && (
            <div className="bg-green-100 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-semibold text-green-700">Perfect Count!</p>
                <p className="text-sm text-green-600">All items matched expected quantities - no variances detected.</p>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Variance Approval Section - Pending Approval Status */}
      {cycleCount.status === "pending_approval" && varianceItems.length > 0 && (
        <Card className="mb-6 border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4 pb-4 border-b border-orange-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 rounded-xl">
                <AlertTriangle className="w-8 h-8 text-orange-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Variance Approval Required</h3>
                <p className="text-sm text-gray-500">
                  Review and approve {varianceItems.length} item{varianceItems.length !== 1 ? "s" : ""} with variance before completing
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                {approvedCount} of {varianceItems.length} approved
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleApproveAllVariances}
                disabled={allVariancesApproved}
              >
                <Check className="w-4 h-4 mr-1" />
                Approve All
              </Button>
            </div>
          </div>

          {/* Variance Items List */}
          <div className="space-y-3 mb-6">
            {varianceItems.map((item) => {
              const isApproved = approvedVariances[item.id];
              const isPositive = item.variance !== null && item.variance > 0;
              const varianceCost = (item.variance || 0) * (item.product.unit_cost || 0);

              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                    isApproved
                      ? "border-green-200 bg-green-50/50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  {/* Checkbox */}
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isApproved}
                      onChange={() => handleToggleVarianceApproval(item.id)}
                      className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                  </label>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{item.product.name}</p>
                    <p className="text-sm text-gray-500 font-mono">{item.product.sku}</p>
                  </div>

                  {/* Expected vs Counted */}
                  <div className="text-center px-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Expected</p>
                    <p className="text-lg font-semibold text-gray-600">{item.expected_qty}</p>
                  </div>

                  <div className="text-center px-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Counted</p>
                    <p className="text-lg font-semibold text-gray-900">{item.counted_qty}</p>
                  </div>

                  {/* Variance */}
                  <div className={`text-center px-4 py-2 rounded-lg ${
                    isPositive ? "bg-blue-100" : "bg-red-100"
                  }`}>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Variance</p>
                    <div className={`flex items-center justify-center gap-1 text-lg font-bold ${
                      isPositive ? "text-blue-600" : "text-red-600"
                    }`}>
                      {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {isPositive ? "+" : ""}{item.variance}
                    </div>
                  </div>

                  {/* Cost Impact */}
                  <div className="text-center px-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Cost Impact</p>
                    <p className={`text-lg font-semibold ${varianceCost >= 0 ? "text-blue-600" : "text-red-600"}`}>
                      {varianceCost >= 0 ? "+" : ""}${Math.abs(varianceCost).toFixed(2)}
                    </p>
                  </div>

                  {/* Approval Status */}
                  <div className="text-center">
                    {isApproved ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        <Check className="w-4 h-4" />
                        Approved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-sm font-medium">
                        <X className="w-4 h-4" />
                        Excluded
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-4 border-t border-orange-200">
            <div className="text-sm text-gray-600">
              <p>
                <strong>{approvedCount}</strong> variance{approvedCount !== 1 ? "s" : ""} will be applied to inventory.
                {varianceItems.length - approvedCount > 0 && (
                  <span className="text-gray-400">
                    {" "}({varianceItems.length - approvedCount} excluded)
                  </span>
                )}
              </p>
              {approvedCount > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Net adjustment: {summary.netVarianceCost >= 0 ? "+" : ""}${summary.netVarianceCost.toFixed(2)}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={handleRejectCount}
                loading={rejectLoading}
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reject & Recount
              </Button>
              <Button
                onClick={handleFinalApprove}
                loading={actionLoading}
                disabled={approvedCount === 0 && varianceItems.length > 0}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="w-5 h-5 mr-2" />
                Approve Count ({approvedCount} adjustment{approvedCount !== 1 ? "s" : ""})
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* No Variances - Quick Approve for pending_approval */}
      {cycleCount.status === "pending_approval" && varianceItems.length === 0 && (
        <Card className="mb-6 border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-xl">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Ready to Approve</h3>
                <p className="text-sm text-gray-500">
                  All items match expected quantities - no inventory adjustments needed
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={handleRejectCount}
                loading={rejectLoading}
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reject & Recount
              </Button>
              <Button
                onClick={handleFinalApprove}
                loading={actionLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="w-5 h-5 mr-2" />
                Approve Count
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Barcode Scanner Section */}
      {isEditable && (
        <Card className="mb-6 border-2 border-dashed border-blue-300 bg-blue-50/50">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <ScanBarcode className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Barcode Scanner</h3>
                <p className="text-sm text-gray-500">Scan product barcode or enter SKU</p>
              </div>
            </div>
            <div className="flex-1 flex items-center gap-3">
              <div className="relative flex-1">
                <ScanBarcode className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeKeyDown}
                  placeholder="Scan barcode or type SKU and press Enter..."
                  className="w-full pl-12 pr-4 py-3 text-lg border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  autoFocus={scannerMode}
                />
              </div>
              <Button
                variant={scannerMode ? "primary" : "secondary"}
                onClick={() => {
                  setScannerMode(!scannerMode);
                  if (!scannerMode) {
                    barcodeInputRef.current?.focus();
                  }
                }}
              >
                <Volume2 className="w-4 h-4 mr-1" />
                {scannerMode ? "Scanner On" : "Scanner Off"}
              </Button>
            </div>
          </div>
          {/* Scan Feedback */}
          {scanFeedback && (
            <div className={`mt-3 p-3 rounded-lg flex items-center gap-2 ${
              scanFeedback.type === "success"
                ? "bg-green-100 text-green-700 border border-green-200"
                : "bg-red-100 text-red-700 border border-red-200"
            }`}>
              {scanFeedback.type === "success" ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
              <span className="font-medium">{scanFeedback.message}</span>
            </div>
          )}
        </Card>
      )}

      {/* Count Items Interface */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Count Items ({cycleCount.items.length})
          </h2>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items..."
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64"
              />
            </div>
            {/* Toggle Expected Quantities */}
            {!cycleCount.blind_count && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExpected(!showExpected)}
              >
                {showExpected ? (
                  <>
                    <EyeOff className="w-4 h-4 mr-1" />
                    Hide Expected
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-1" />
                    Show Expected
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchQuery ? "No items match your search" : "No items to count"}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                ref={(el) => { itemContainerRefs.current[item.id] = el; }}
                className={`border-2 rounded-xl p-5 transition-all duration-300 ${
                  highlightedItemId === item.id
                    ? "border-yellow-400 bg-yellow-50 ring-4 ring-yellow-200 shadow-lg"
                    : item.variance !== null && item.variance !== 0
                    ? item.variance > 0
                      ? "border-blue-300 bg-blue-50/50"
                      : "border-red-300 bg-red-50/50"
                    : item.counted_qty !== null
                    ? "border-green-300 bg-green-50/30"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                {/* Top Row: Product Info */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Product Name + SKU */}
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`p-3 rounded-xl ${
                      item.counted_qty !== null && item.variance === 0
                        ? "bg-green-100"
                        : item.variance !== null && item.variance !== 0
                        ? item.variance > 0 ? "bg-blue-100" : "bg-red-100"
                        : "bg-gray-100"
                    }`}>
                      <Package className={`w-8 h-8 ${
                        item.counted_qty !== null && item.variance === 0
                          ? "text-green-600"
                          : item.variance !== null && item.variance !== 0
                          ? item.variance > 0 ? "text-blue-600" : "text-red-600"
                          : "text-gray-500"
                      }`} />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-gray-900">{item.product.name}</p>
                      <p className="text-sm text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded inline-block">
                        {item.product.sku}
                      </p>
                      {/* Sublocation */}
                      {item.sublocation && (
                        <div className="flex items-center gap-1 mt-2 text-sm text-gray-600">
                          <MapPinned className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{item.sublocation.code}</span>
                          {item.sublocation.name && (
                            <span className="text-gray-400">({item.sublocation.name})</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quantity Section */}
                  <div className="flex items-center gap-6 lg:gap-8">
                    {/* Expected Qty */}
                    {showExpected && !cycleCount.blind_count && (
                      <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Expected</p>
                        <p className="text-2xl font-bold text-gray-600">{item.expected_qty}</p>
                      </div>
                    )}

                    {/* Counted Qty Input - LARGE */}
                    <div className="text-center">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Counted</p>
                      {isEditable ? (
                        <input
                          ref={(el) => { itemRefs.current[item.id] = el; }}
                          type="number"
                          value={countInputs[item.id] ?? ""}
                          onChange={(e) =>
                            setCountInputs((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          onBlur={() => handleBlurSave(item)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleSaveCount(item);
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          placeholder="0"
                          min="0"
                          className={`w-24 h-14 px-3 py-2 text-center text-2xl font-bold border-2 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-500 transition-all ${
                            highlightedItemId === item.id
                              ? "border-yellow-400 bg-yellow-50"
                              : "border-gray-300 bg-white"
                          }`}
                        />
                      ) : (
                        <p className="text-2xl font-bold text-gray-900">
                          {item.counted_qty !== null ? item.counted_qty : "-"}
                        </p>
                      )}
                    </div>

                    {/* Variance */}
                    <div className="text-center min-w-[100px]">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Variance</p>
                      <div>
                        {item.counted_qty !== null ? (
                          getVarianceDisplay(item, true)
                        ) : (
                          <span className="text-2xl font-bold text-gray-300">-</span>
                        )}
                      </div>
                    </div>

                    {/* Save Button */}
                    {isEditable && (
                      <div className="flex flex-col items-center gap-1">
                        <Button
                          size="lg"
                          variant={savedItems[item.id] ? "primary" : savingItems[item.id] ? "secondary" : "secondary"}
                          onClick={() => handleSaveCount(item)}
                          loading={savingItems[item.id]}
                          disabled={!countInputs[item.id] && countInputs[item.id] !== "0"}
                          className="min-w-[100px]"
                        >
                          {savedItems[item.id] ? (
                            <>
                              <Check className="w-5 h-5 mr-1" />
                              Saved
                            </>
                          ) : (
                            <>
                              <Save className="w-5 h-5 mr-1" />
                              Save
                            </>
                          )}
                        </Button>
                        {countInputs[item.id] && (
                          <span className="text-xs text-gray-400">or press Enter</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Notes + Counted By + Actions */}
                <div className="mt-4 pt-4 border-t border-gray-200 flex flex-col md:flex-row md:items-end gap-4">
                  {/* Notes Input */}
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">
                      <MessageSquare className="w-3 h-3 inline mr-1" />
                      Notes
                    </label>
                    {isEditable ? (
                      <input
                        type="text"
                        value={notesInputs[item.id] ?? ""}
                        onChange={(e) =>
                          setNotesInputs((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        placeholder="Add notes about this count..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-sm text-gray-600">
                        {item.notes || <span className="text-gray-400 italic">No notes</span>}
                      </p>
                    )}
                  </div>

                  {/* Counted By / Timestamp */}
                  {item.counted_at && (
                    <div className="text-right min-w-[180px]">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Counted By</p>
                      <div className="flex items-center justify-end gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <p className="text-sm text-gray-900 font-medium">
                          {item.counted_by || "Unknown"}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(item.counted_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Count Details */}
      {cycleCount.notes && (
        <Card className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Notes
          </h3>
          <p className="text-gray-600 text-sm">{cycleCount.notes}</p>
        </Card>
      )}

      {/* Timeline / Audit Info */}
      <Card className="mt-6">
        <h3 className="text-sm font-medium text-gray-700 mb-4">Count Timeline</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Created</span>
            <span className="text-gray-900">{formatDateTime(cycleCount.created_at)}</span>
          </div>
          {cycleCount.scheduled_date && (
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Scheduled</span>
              <span className="text-gray-900">{formatDate(cycleCount.scheduled_date)}</span>
            </div>
          )}
          {cycleCount.started_at && (
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Started</span>
              <span className="text-gray-900">{formatDateTime(cycleCount.started_at)}</span>
            </div>
          )}
          {cycleCount.completed_at && (
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Completed</span>
              <span className="text-gray-900">{formatDateTime(cycleCount.completed_at)}</span>
            </div>
          )}
          {cycleCount.approved_at && (
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Approved</span>
              <span className="text-gray-900">
                {formatDateTime(cycleCount.approved_at)}
                {cycleCount.approved_by && ` by ${cycleCount.approved_by}`}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Approve Modal */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title="Approve Count & Adjust Inventory"
      >
        <div className="space-y-4">
          <Alert
            type="warning"
            message={`Approving this count will adjust inventory for ${summary.itemsWithVariance} item(s) with variance.`}
          />

          {summary.itemsWithVariance > 0 && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Variance Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Items with positive variance:</span>
                  <span className="text-green-600 font-medium">+{summary.totalPositiveVariance} units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Items with negative variance:</span>
                  <span className="text-red-600 font-medium">-{summary.totalNegativeVariance} units</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Approval Notes (optional)
            </label>
            <textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder="Add any notes about this approval..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => setShowApproveModal(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleApproveCount} loading={actionLoading}>
              Approve & Adjust Inventory
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
