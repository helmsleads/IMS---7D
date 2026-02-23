"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck,
  ShieldCheck,
  ArrowDownToLine,
  ListChecks,
  Play,
  User,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import {
  getWarehouseTasks,
  getTaskCountsByType,
  WarehouseTaskWithRelations,
  TaskCountsByType,
} from "@/lib/api/warehouse-tasks";
import { WarehouseTaskType, WarehouseTaskStatus } from "@/types/database";
import { useAuth } from "@/lib/auth-context";

type TabFilter = "all" | "inspection" | "putaway" | "pick";
type StatusFilter = "active" | "completed";

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

function getTaskTypeIcon(type: WarehouseTaskType) {
  switch (type) {
    case "inspection": return <ShieldCheck className="w-4 h-4 text-amber-600" />;
    case "putaway": return <ArrowDownToLine className="w-4 h-4 text-blue-600" />;
    case "pick": return <ListChecks className="w-4 h-4 text-green-600" />;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function TaskDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<WarehouseTaskWithRelations[]>([]);
  const [counts, setCounts] = useState<TaskCountsByType | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabFilter, setTabFilter] = useState<TabFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [myTasksOnly, setMyTasksOnly] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [taskData, countData] = await Promise.all([
        getWarehouseTasks(),
        getTaskCountsByType(),
      ]);
      setTasks(taskData);
      setCounts(countData);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (tabFilter !== "all") {
      result = result.filter((t) => t.task_type === tabFilter);
    }

    if (statusFilter === "active") {
      result = result.filter((t) => ["pending", "assigned", "in_progress"].includes(t.status));
    } else {
      result = result.filter((t) => t.status === "completed");
    }

    if (myTasksOnly && user) {
      result = result.filter((t) => t.assigned_to === user.id);
    }

    return result;
  }, [tasks, tabFilter, statusFilter, myTasksOnly, user]);

  const totalPending = counts
    ? counts.inspection.pending + counts.putaway.pending + counts.pick.pending
    : 0;
  const totalInProgress = counts
    ? counts.inspection.in_progress + counts.putaway.in_progress + counts.pick.in_progress
    : 0;

  return (
    <AppShell title="Task Queue">
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Tasks", href: "/tasks" },
          ]}
        />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Task Queue</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage inspection, putaway, and pick tasks
            </p>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200/80">
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-50">
                  <ShieldCheck className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Inspection</p>
                  <p className="text-xl font-bold text-slate-900">
                    {counts?.inspection.pending || 0}
                    <span className="text-sm font-normal text-slate-400 ml-1">pending</span>
                  </p>
                </div>
              </div>
            </div>
          </Card>
          <Card className="border-slate-200/80">
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50">
                  <ArrowDownToLine className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Putaway</p>
                  <p className="text-xl font-bold text-slate-900">
                    {counts?.putaway.pending || 0}
                    <span className="text-sm font-normal text-slate-400 ml-1">pending</span>
                  </p>
                </div>
              </div>
            </div>
          </Card>
          <Card className="border-slate-200/80">
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-50">
                  <ListChecks className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Pick Lists</p>
                  <p className="text-xl font-bold text-slate-900">
                    {counts?.pick.pending || 0}
                    <span className="text-sm font-normal text-slate-400 ml-1">pending</span>
                  </p>
                </div>
              </div>
            </div>
          </Card>
          <Card className="border-slate-200/80">
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-50">
                  <Play className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">In Progress</p>
                  <p className="text-xl font-bold text-slate-900">
                    {totalInProgress}
                    <span className="text-sm font-normal text-slate-400 ml-1">active</span>
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            {(["all", "inspection", "putaway", "pick"] as TabFilter[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setTabFilter(tab)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  tabFilter === tab
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab === "all" ? "All" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                statusFilter === "active"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter("completed")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                statusFilter === "completed"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Completed
            </button>
          </div>

          <button
            onClick={() => setMyTasksOnly(!myTasksOnly)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
              myTasksOnly
                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            My Tasks
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : filteredTasks.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="w-12 h-12 text-slate-300" />}
            title="No tasks found"
            description={myTasksOnly ? "You have no assigned tasks" : "No tasks match the current filters"}
          />
        ) : (
          <Card className="border-slate-200/80 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Task</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Qty</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Age</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map((task) => {
                  const statusInfo = getStatusBadge(task.status);
                  const priorityInfo = getPriorityBadge(task.priority);
                  return (
                    <tr
                      key={task.id}
                      className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/tasks/${task.id}`)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-slate-700">{task.task_number}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {getTaskTypeIcon(task.task_type)}
                          <span className="text-sm capitalize text-slate-700">{task.task_type}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {task.product ? (
                          <div>
                            <p className="text-sm font-medium text-slate-900">{task.product.sku}</p>
                            <p className="text-xs text-slate-500">{task.product.name}</p>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {task.client?.company_name || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-700">
                        {task.qty_requested}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${priorityInfo.className}`}>
                          {priorityInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {timeAgo(task.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/tasks/${task.id}`);
                          }}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
