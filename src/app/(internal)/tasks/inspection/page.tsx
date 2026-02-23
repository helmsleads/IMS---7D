"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Clock, Play, CheckCircle, AlertTriangle, User } from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import InspectionScanner from "@/components/internal/InspectionScanner";
import { getWarehouseTasks, assignTask, startTask, WarehouseTaskWithRelations } from "@/lib/api/warehouse-tasks";
import { useAuth } from "@/lib/auth-context";

export default function InspectionQueuePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<WarehouseTaskWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<WarehouseTaskWithRelations | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    try {
      setLoading(true);
      const data = await getWarehouseTasks({
        taskType: "inspection",
        status: ["pending", "assigned", "in_progress"],
      });

      // Sort by priority DESC, then created_at ASC
      const sorted = data.sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      setTasks(sorted);
    } catch (error) {
      console.error("Failed to load inspection tasks:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleClaimAndStart(task: WarehouseTaskWithRelations) {
    if (!user?.id) return;

    try {
      setActionLoading(task.id);
      await assignTask(task.id, user.id);
      await startTask(task.id);
      setSelectedTask(task);
      setScannerOpen(true);
      await loadTasks();
    } catch (error) {
      console.error("Failed to claim and start task:", error);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleContinue(task: WarehouseTaskWithRelations) {
    setSelectedTask(task);
    setScannerOpen(true);
  }

  function handleScannerComplete() {
    setScannerOpen(false);
    setSelectedTask(null);
    loadTasks();
  }

  function getTimeWaiting(createdAt: string): string {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMinutes = Math.floor((now.getTime() - created.getTime()) / 60000);

    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  function getPriorityBadge(priority: number) {
    if (priority >= 8) {
      return <Badge variant="error">Urgent</Badge>;
    }
    if (priority >= 6) {
      return <Badge variant="warning">High</Badge>;
    }
    return <Badge variant="default">Normal</Badge>;
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "pending":
        return <Badge variant="default">Pending</Badge>;
      case "assigned":
        return <Badge variant="info">Assigned</Badge>;
      case "in_progress":
        return <Badge variant="warning">In Progress</Badge>;
      case "completed":
        return <Badge variant="success">Completed</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  }

  // Calculate stats
  const totalPending = tasks.filter((t) => t.status === "pending").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const completedToday = tasks.filter((t) => {
    if (t.status !== "completed") return false;
    const completed = new Date(t.completed_at || t.updated_at);
    const today = new Date();
    return (
      completed.getDate() === today.getDate() &&
      completed.getMonth() === today.getMonth() &&
      completed.getFullYear() === today.getFullYear()
    );
  }).length;

  const breadcrumbs = [
    { label: "Tasks", href: "/tasks" },
    { label: "Inspection", href: "/tasks/inspection" },
  ];

  return (
    <AppShell title="Inspection Queue">
      <Breadcrumbs items={breadcrumbs} />
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-slate-200/80">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-100 rounded-lg">
                <Clock className="w-6 h-6 text-slate-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{totalPending}</div>
                <div className="text-sm text-slate-600">Pending</div>
              </div>
            </div>
          </Card>

          <Card className="border-slate-200/80">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <Play className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{inProgress}</div>
                <div className="text-sm text-slate-600">In Progress</div>
              </div>
            </div>
          </Card>

          <Card className="border-slate-200/80">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{completedToday}</div>
                <div className="text-sm text-slate-600">Completed Today</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Tasks Table */}
        <Card className="border-slate-200/80">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-semibold text-slate-900">Inspection Tasks</h2>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={loadTasks}
                disabled={loading}
              >
                Refresh
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : tasks.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="w-12 h-12 text-slate-300" />}
              title="No inspection tasks"
              description="All inspections have been completed"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th>Task #</th>
                    <th>Product</th>
                    <th>Client</th>
                    <th>Qty</th>
                    <th>Location</th>
                    <th>Priority</th>
                    <th>Time Waiting</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => {
                    const isAssignedToMe = task.assigned_to === user?.id;
                    const canClaim = task.status === "pending";
                    const canContinue = isAssignedToMe && task.status === "in_progress";

                    return (
                      <tr key={task.id}>
                        <td className="font-mono text-sm">#{task.task_number}</td>
                        <td>
                          <div className="min-w-[200px]">
                            <div className="font-medium text-slate-900">
                              {task.product?.sku || "—"}
                            </div>
                            <div className="text-sm text-slate-600">
                              {task.product?.name || "—"}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="text-sm text-slate-900">
                            {task.client?.company_name || "—"}
                          </div>
                        </td>
                        <td>
                          <div className="font-medium text-slate-900">
                            {task.qty_requested || 0}
                          </div>
                        </td>
                        <td>
                          <div className="text-sm text-slate-900">
                            {task.source_location?.name || "—"}
                          </div>
                        </td>
                        <td>{getPriorityBadge(task.priority)}</td>
                        <td>
                          <div className="text-sm text-slate-600">
                            {getTimeWaiting(task.created_at)}
                          </div>
                        </td>
                        <td>{getStatusBadge(task.status)}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            {canClaim && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleClaimAndStart(task)}
                                disabled={actionLoading === task.id}
                              >
                                {actionLoading === task.id ? (
                                  <Spinner size="sm" />
                                ) : (
                                  <>
                                    <Play className="w-4 h-4" />
                                    Claim & Start
                                  </>
                                )}
                              </Button>
                            )}
                            {canContinue && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleContinue(task)}
                              >
                                <Play className="w-4 h-4" />
                                Continue
                              </Button>
                            )}
                            {!canClaim && !canContinue && task.assigned_to && (
                              <div className="flex items-center gap-1 text-sm text-slate-600">
                                <User className="w-4 h-4" />
                                Assigned
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Inspection Scanner Modal */}
      {selectedTask && (
        <Modal
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          title={`Inspection - Task #${selectedTask.task_number}`}
          size="xl"
        >
          <InspectionScanner
            taskId={selectedTask.id}
            onComplete={handleScannerComplete}
          />
        </Modal>
      )}
    </AppShell>
  );
}
