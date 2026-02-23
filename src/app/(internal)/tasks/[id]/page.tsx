"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ShieldCheck,
  ArrowDownToLine,
  ListChecks,
  Package,
  MapPin,
  Clock,
  User,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Play,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import InspectionScanner from "@/components/internal/InspectionScanner";
import PutawayScanner from "@/components/internal/PutawayScanner";
import PickScanner from "@/components/internal/PickScanner";
import {
  getWarehouseTask,
  getPickListItems,
  assignTask,
  startTask,
  cancelTask,
  WarehouseTaskWithRelations,
  PickListItemWithRelations,
} from "@/lib/api/warehouse-tasks";
import { WarehouseTaskStatus } from "@/types/database";
import { useAuth } from "@/lib/auth-context";

function getStatusBadge(status: WarehouseTaskStatus) {
  const map: Record<WarehouseTaskStatus, { label: string; variant: "warning" | "info" | "success" | "error" | "default" }> = {
    pending: { label: "Pending", variant: "warning" },
    assigned: { label: "Assigned", variant: "info" },
    in_progress: { label: "In Progress", variant: "info" },
    completed: { label: "Completed", variant: "success" },
    failed: { label: "Failed", variant: "error" },
    cancelled: { label: "Cancelled", variant: "default" },
  };
  return map[status] || map.pending;
}

function getPriorityBadge(priority: number) {
  if (priority >= 8) return { label: "Urgent", className: "bg-red-100 text-red-700" };
  if (priority >= 6) return { label: "High", className: "bg-amber-100 text-amber-700" };
  return { label: "Normal", className: "bg-slate-100 text-slate-600" };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString();
}

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const taskId = params.id as string;

  const [task, setTask] = useState<WarehouseTaskWithRelations | null>(null);
  const [pickItems, setPickItems] = useState<PickListItemWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadTask();
  }, [taskId]);

  async function loadTask() {
    setLoading(true);
    try {
      const data = await getWarehouseTask(taskId);
      setTask(data);

      if (data?.task_type === "pick") {
        const items = await getPickListItems(taskId);
        setPickItems(items);
      }
    } catch (err) {
      console.error("Failed to load task:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleClaimAndStart() {
    if (!user || !task) return;
    setActionLoading(true);
    try {
      await assignTask(taskId, user.id);
      await startTask(taskId);
      await loadTask();
      setScannerOpen(true);
    } catch (err) {
      console.error("Failed to claim task:", err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!task) return;
    setActionLoading(true);
    try {
      await cancelTask(taskId);
      await loadTask();
    } catch (err) {
      console.error("Failed to cancel task:", err);
    } finally {
      setActionLoading(false);
    }
  }

  function handleScannerComplete() {
    setScannerOpen(false);
    loadTask();
  }

  if (loading) {
    return (
      <AppShell title="Loading Task...">
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      </AppShell>
    );
  }

  if (!task) {
    return (
      <AppShell title="Task Not Found">
        <div className="text-center py-20">
          <p className="text-slate-500">Task not found</p>
          <Button variant="secondary" className="mt-4" onClick={() => router.push("/tasks")}>
            Back to Tasks
          </Button>
        </div>
      </AppShell>
    );
  }

  const statusInfo = getStatusBadge(task.status);
  const priorityInfo = getPriorityBadge(task.priority);
  const isActive = ["pending", "assigned", "in_progress"].includes(task.status);
  const isAssignedToMe = task.assigned_to === user?.id;
  const canStart = isActive && (task.status === "pending" || isAssignedToMe);

  const typeLabel = task.task_type === "inspection" ? "Inspection" : task.task_type === "putaway" ? "Putaway" : "Pick List";
  const TypeIcon = task.task_type === "inspection" ? ShieldCheck : task.task_type === "putaway" ? ArrowDownToLine : ListChecks;

  return (
    <AppShell title={task.task_number}>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Tasks", href: "/tasks" },
            { label: typeLabel, href: `/tasks/${task.task_type === "pick" ? "pick" : task.task_type}` },
            { label: task.task_number },
          ]}
        />

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <TypeIcon className="w-6 h-6 text-indigo-600" />
                <h1 className="text-2xl font-bold text-slate-900">{task.task_number}</h1>
                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${priorityInfo.className}`}>
                  {priorityInfo.label}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1 ml-10">
                {typeLabel} Task
                {task.client?.company_name && ` for ${task.client.company_name}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canStart && (
              <Button
                onClick={() => {
                  if (task.status === "pending") {
                    handleClaimAndStart();
                  } else {
                    setScannerOpen(true);
                  }
                }}
                disabled={actionLoading}
              >
                <Play className="w-4 h-4 mr-1.5" />
                {task.status === "pending" ? "Claim & Start" : "Continue"}
              </Button>
            )}
            {isActive && (
              <Button variant="secondary" onClick={handleCancel} disabled={actionLoading}>
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product Info */}
            {task.product && (
              <Card className="border-slate-200/80">
                <div className="p-5">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Product</h3>
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-slate-100">
                      <Package className="w-8 h-8 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-slate-900">{task.product.name}</p>
                      <p className="text-sm text-slate-500">SKU: {task.product.sku}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-2xl font-bold text-slate-900">{task.qty_requested}</p>
                      <p className="text-sm text-slate-500">units requested</p>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Locations */}
            <Card className="border-slate-200/80">
              <div className="p-5">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Locations</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Source</p>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-700">
                        {task.source_location?.name || "Not set"}
                        {task.source_sublocation && ` / ${task.source_sublocation.code}`}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Destination</p>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-700">
                        {task.destination_location?.name || "Not set"}
                        {task.destination_sublocation && ` / ${task.destination_sublocation.code}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Pick List Items (for pick tasks) */}
            {task.task_type === "pick" && pickItems.length > 0 && (
              <Card className="border-slate-200/80 overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Pick List Items</h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">#</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Product</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Lot</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Location</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500">Allocated</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500">Picked</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pickItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2 text-sm text-slate-500">{item.sequence_number}</td>
                        <td className="px-4 py-2">
                          <p className="text-sm font-medium text-slate-900">{item.product?.sku}</p>
                          <p className="text-xs text-slate-500">{item.product?.name}</p>
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-600">{item.lot?.lot_number || "-"}</td>
                        <td className="px-4 py-2 text-sm text-slate-600">
                          {item.sublocation?.code || item.location?.name || "-"}
                        </td>
                        <td className="px-4 py-2 text-sm text-right font-medium text-slate-700">{item.qty_allocated}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium text-slate-700">{item.qty_picked}</td>
                        <td className="px-4 py-2">
                          <Badge
                            variant={
                              item.status === "picked" ? "success" :
                              item.status === "short" ? "error" :
                              item.status === "in_progress" ? "info" : "warning"
                            }
                          >
                            {item.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}

            {/* Notes */}
            {task.notes && (
              <Card className="border-slate-200/80">
                <div className="p-5">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Notes</h3>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{task.notes}</p>
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Timeline */}
            <Card className="border-slate-200/80">
              <div className="p-5">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Timeline</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1 rounded-full bg-slate-100">
                      <Clock className="w-3 h-3 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">Created</p>
                      <p className="text-xs text-slate-500">{formatDate(task.created_at)}</p>
                    </div>
                  </div>
                  {task.assigned_at && (
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 p-1 rounded-full bg-blue-100">
                        <User className="w-3 h-3 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">Assigned</p>
                        <p className="text-xs text-slate-500">{formatDate(task.assigned_at)}</p>
                      </div>
                    </div>
                  )}
                  {task.started_at && (
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 p-1 rounded-full bg-indigo-100">
                        <Play className="w-3 h-3 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">Started</p>
                        <p className="text-xs text-slate-500">{formatDate(task.started_at)}</p>
                      </div>
                    </div>
                  )}
                  {task.completed_at && (
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 p-1 rounded-full ${task.status === "completed" ? "bg-green-100" : "bg-red-100"}`}>
                        {task.status === "completed" ? (
                          <CheckCircle className="w-3 h-3 text-green-600" />
                        ) : (
                          <XCircle className="w-3 h-3 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {task.status === "completed" ? "Completed" : task.status === "failed" ? "Failed" : "Cancelled"}
                        </p>
                        <p className="text-xs text-slate-500">{formatDate(task.completed_at)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Details */}
            <Card className="border-slate-200/80">
              <div className="p-5">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Details</h3>
                <dl className="space-y-3">
                  {task.client && (
                    <div>
                      <dt className="text-xs text-slate-400">Client</dt>
                      <dd className="text-sm text-slate-700">{task.client.company_name}</dd>
                    </div>
                  )}
                  {task.lpn && (
                    <div>
                      <dt className="text-xs text-slate-400">LPN / Pallet</dt>
                      <dd className="text-sm text-slate-700">{task.lpn.lpn_number}</dd>
                    </div>
                  )}
                  {task.lot && (
                    <div>
                      <dt className="text-xs text-slate-400">Lot</dt>
                      <dd className="text-sm text-slate-700">
                        {task.lot.lot_number}
                        {task.lot.expiration_date && (
                          <span className="text-xs text-slate-400 ml-1">
                            (exp: {task.lot.expiration_date})
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs text-slate-400">Completed</dt>
                    <dd className="text-sm text-slate-700">
                      {task.qty_completed} / {task.qty_requested} units
                    </dd>
                  </div>
                  {task.due_by && (
                    <div>
                      <dt className="text-xs text-slate-400">Due By</dt>
                      <dd className="text-sm text-slate-700">{formatDate(task.due_by)}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Scanner Modal */}
      <Modal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        title={`${typeLabel} Scanner`}
        size="lg"
      >
        {task.task_type === "inspection" && (
          <InspectionScanner taskId={task.id} onComplete={handleScannerComplete} />
        )}
        {task.task_type === "putaway" && (
          <PutawayScanner
            locationId={task.source_location_id || undefined}
            taskId={task.id}
            onComplete={handleScannerComplete}
          />
        )}
        {task.task_type === "pick" && task.order_id && task.source_location_id && (
          <PickScanner
            outboundOrderId={task.order_id}
            locationId={task.source_location_id}
            taskId={task.id}
            onComplete={handleScannerComplete}
          />
        )}
      </Modal>
    </AppShell>
  );
}
