"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, Clock, Play, CheckCircle, Package, RefreshCw } from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Table from "@/components/ui/Table";
import FetchError from "@/components/ui/FetchError";
import Alert from "@/components/ui/Alert";
import Pagination, { usePagination } from "@/components/ui/Pagination";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import PutawayScanner from "@/components/internal/PutawayScanner";
import { getWarehouseTasks, assignTask, startTask, WarehouseTaskWithRelations } from "@/lib/api/warehouse-tasks";
import { useAuth } from "@/lib/auth-context";
import { handleApiError } from "@/lib/utils/error-handler";

export default function PutawayQueuePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<WarehouseTaskWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<WarehouseTaskWithRelations | null>(null);
  const [claimingBulk, setClaimingBulk] = useState(false);

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    if (alert?.type === "success") {
      const timer = setTimeout(() => setAlert(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getWarehouseTasks({
        taskType: 'putaway',
        status: ['pending', 'assigned', 'in_progress']
      });

      // Sort: priority DESC, created_at ASC
      const sorted = data.sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      setTasks(sorted);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClaimAndStart = async (task: WarehouseTaskWithRelations) => {
    if (!user) return;

    try {
      // Assign if not already assigned
      if (task.status === 'pending') {
        await assignTask(task.id, user.id);
      }

      // Start the task
      await startTask(task.id);

      // Open scanner
      setSelectedTask(task);
      setScannerOpen(true);
      setAlert({ type: "success", message: `Started task ${task.task_number}` });
    } catch (err) {
      setAlert({ type: "error", message: handleApiError(err) });
    }
  };

  const handleClaimNext5 = async () => {
    if (!user) return;

    try {
      setClaimingBulk(true);
      const pendingTasks = tasks
        .filter(t => t.status === 'pending')
        .slice(0, 5);

      for (const task of pendingTasks) {
        await assignTask(task.id, user.id);
      }

      await loadTasks();
      setAlert({ type: "success", message: `Claimed ${pendingTasks.length} task(s)` });
    } catch (err) {
      setAlert({ type: "error", message: handleApiError(err) });
    } finally {
      setClaimingBulk(false);
    }
  };

  const handleScannerComplete = async () => {
    setScannerOpen(false);
    setSelectedTask(null);
    await loadTasks();
  };

  const getTaskAge = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d`;
  };

  const getPriorityBadge = (priority: number) => {
    if (priority >= 8) return <Badge variant="error">Urgent</Badge>;
    if (priority >= 6) return <Badge variant="warning">High</Badge>;
    return <Badge variant="default">Normal</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="default">Pending</Badge>;
      case 'assigned':
        return <Badge variant="info">Assigned</Badge>;
      case 'in_progress':
        return <Badge variant="warning">In Progress</Badge>;
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const perishableCount = tasks.filter(t => t.priority >= 8).length;

  const { paginatedItems, ...pagination } = usePagination(tasks, 20);

  const tableColumns: { key: string; header: React.ReactNode; render?: (item: WarehouseTaskWithRelations) => React.ReactNode; hideOnMobile?: boolean; mobilePriority?: number; align?: "left" | "center" | "right" }[] = [
    {
      key: "task_number",
      header: "Task #",
      mobilePriority: 1,
      render: (task) => <span className="text-sm text-slate-900">{task.task_number || `#${task.id}`}</span>,
    },
    {
      key: "product",
      header: "Product",
      mobilePriority: 2,
      render: (task) => (
        <div>
          <div className="font-medium text-slate-900">{task.product?.name || 'Unknown Product'}</div>
          <div className="text-sm text-slate-500">{task.product?.sku || '\u2014'}</div>
        </div>
      ),
    },
    {
      key: "qty",
      header: "Qty",
      hideOnMobile: true,
      render: (task) => <span className="font-medium text-slate-900">{task.qty_requested || '\u2014'}</span>,
    },
    {
      key: "source",
      header: "Source Location",
      hideOnMobile: true,
      render: (task) => <span className="text-sm text-slate-900">{task.source_location?.name || '\u2014'}</span>,
    },
    {
      key: "destination",
      header: "Suggested Dest",
      hideOnMobile: true,
      render: (task) => (
        <span className="text-sm text-slate-900">
          {task.destination_sublocation?.code || task.destination_location?.name || '\u2014'}
        </span>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      mobilePriority: 3,
      render: (task) => getPriorityBadge(task.priority),
    },
    {
      key: "age",
      header: "Age",
      mobilePriority: 3,
      render: (task) => <span className="text-sm text-slate-600">{getTaskAge(task.created_at)}</span>,
    },
    {
      key: "status",
      header: "Status",
      mobilePriority: 2,
      render: (task) => getStatusBadge(task.status),
    },
    {
      key: "actions",
      header: "Actions",
      render: (task) => (
        <div className="flex gap-2">
          {(task.status === 'pending' || task.status === 'assigned') && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleClaimAndStart(task)}
            >
              <Play className="w-4 h-4 mr-1.5" />
              {task.status === 'pending' ? 'Claim & Start' : 'Start'}
            </Button>
          )}
          {task.status === 'in_progress' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSelectedTask(task);
                setScannerOpen(true);
              }}
            >
              <Play className="w-4 h-4 mr-1.5" />
              Continue
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AppShell title="Putaway Queue">
      <Breadcrumbs
        items={[
          { label: 'Tasks', href: '/tasks' },
          { label: 'Putaway' }
        ]}
      />

      <div className="space-y-6">
        {alert && (
          <Alert
            type={alert.type}
            message={alert.message}
            onClose={() => setAlert(null)}
          />
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-slate-200/80">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-100 rounded-lg">
                <Clock className="w-6 h-6 text-slate-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Pending</p>
                <p className="text-2xl font-semibold text-slate-900">{pendingCount}</p>
              </div>
            </div>
          </Card>

          <Card className="border-slate-200/80">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <Play className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">In Progress</p>
                <p className="text-2xl font-semibold text-slate-900">{inProgressCount}</p>
              </div>
            </div>
          </Card>

          <Card className="border-slate-200/80">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 rounded-lg">
                <Package className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Perishable</p>
                <p className="text-2xl font-semibold text-slate-900">{perishableCount}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="primary"
            onClick={handleClaimNext5}
            disabled={pendingCount === 0}
            loading={claimingBulk}
          >
            <ArrowDownToLine className="w-4 h-4 mr-1.5" />
            Claim Next 5
          </Button>
          <Button
            variant="secondary"
            onClick={loadTasks}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Table */}
        {error ? (
          <FetchError message={error} onRetry={loadTasks} />
        ) : (
          <Card className="border-slate-200/80">
            <Table
              columns={tableColumns}
              data={paginatedItems}
              loading={loading}
              emptyMessage="All items have been put away. Great work!"
              emptyIcon={<CheckCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />}
            />
            <Pagination
              currentPage={pagination.currentPage}
              totalItems={pagination.totalItems}
              itemsPerPage={pagination.itemsPerPage}
              onPageChange={pagination.setCurrentPage}
            />
          </Card>
        )}
      </div>

      {/* Scanner Modal */}
      <Modal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        title="Putaway Scanner"
        size="lg"
      >
        {selectedTask && (
          <PutawayScanner
            locationId={selectedTask.source_location_id || ''}
            onComplete={handleScannerComplete}
          />
        )}
      </Modal>
    </AppShell>
  );
}
