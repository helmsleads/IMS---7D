"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, Clock, Play, CheckCircle, ShoppingCart, AlertTriangle } from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import PickScanner from "@/components/internal/PickScanner";
import { getWarehouseTasks, assignTask, startTask, getPickListItems, WarehouseTaskWithRelations } from "@/lib/api/warehouse-tasks";
import { useAuth } from "@/lib/auth-context";

interface TaskStats {
  pending: number;
  inProgress: number;
  completedToday: number;
}

export default function PickListQueuePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<WarehouseTaskWithRelations[]>([]);
  const [stats, setStats] = useState<TaskStats>({ pending: 0, inProgress: 0, completedToday: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<WarehouseTaskWithRelations | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    try {
      setLoading(true);
      setError(null);

      const fetchedTasks = await getWarehouseTasks({
        taskType: 'pick',
        status: ['pending', 'assigned', 'in_progress']
      });

      setTasks(fetchedTasks);

      // Calculate stats
      const pending = fetchedTasks.filter(t => t.status === 'pending').length;
      const inProgress = fetchedTasks.filter(t => t.status === 'in_progress').length;

      // Completed today would need a separate query with date filter
      // For now, we'll set it to 0 as we're only fetching active tasks
      const completedToday = 0;

      setStats({ pending, inProgress, completedToday });
    } catch (err) {
      console.error('Error loading pick tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pick tasks');
    } finally {
      setLoading(false);
    }
  }

  async function handleClaimAndStart(task: WarehouseTaskWithRelations) {
    if (!user) {
      setError('You must be logged in to claim tasks');
      return;
    }

    try {
      setActionLoading(task.id);
      setError(null);

      // Assign task if not already assigned
      if (task.status === 'pending') {
        await assignTask(task.id, user.id);
      }

      // Start task
      await startTask(task.id);

      // Set selected task and open scanner
      setSelectedTask(task);
      setScannerOpen(true);

      // Reload tasks to update UI
      await loadTasks();
    } catch (err) {
      console.error('Error claiming/starting task:', err);
      setError(err instanceof Error ? err.message : 'Failed to start picking');
    } finally {
      setActionLoading(null);
    }
  }

  function handleScannerComplete() {
    setScannerOpen(false);
    setSelectedTask(null);
    loadTasks();
  }

  function getProgressPercentage(task: WarehouseTaskWithRelations): number {
    if (!task.qty_requested || task.qty_requested === 0) return 0;
    return Math.min(100, Math.round((task.qty_completed / task.qty_requested) * 100));
  }

  function getOrderNumber(task: WarehouseTaskWithRelations): string {
    if (task.metadata && typeof task.metadata === 'object' && 'orderNumber' in task.metadata) {
      return String(task.metadata.orderNumber);
    }
    return task.task_number || 'N/A';
  }

  function getItemCount(task: WarehouseTaskWithRelations): number {
    if (task.metadata && typeof task.metadata === 'object' && 'itemCount' in task.metadata) {
      return Number(task.metadata.itemCount) || 0;
    }
    return 0;
  }

  function getClientName(task: WarehouseTaskWithRelations): string {
    if (task.metadata && typeof task.metadata === 'object' && 'clientName' in task.metadata) {
      return String(task.metadata.clientName);
    }
    return 'N/A';
  }

  function isRushOrder(task: WarehouseTaskWithRelations): boolean {
    return (task.priority || 0) >= 8;
  }

  function getStatusBadgeVariant(status: string): 'default' | 'success' | 'warning' | 'error' {
    switch (status) {
      case 'pending':
        return 'default';
      case 'assigned':
        return 'warning';
      case 'in_progress':
        return 'warning';
      case 'completed':
        return 'success';
      default:
        return 'default';
    }
  }

  function getPriorityBadgeVariant(priority: number): 'default' | 'success' | 'warning' | 'error' {
    if (priority >= 8) return 'error';
    if (priority >= 5) return 'warning';
    return 'default';
  }

  const columns = [
    {
      key: 'task_number',
      label: 'Task #',
      render: (task: WarehouseTaskWithRelations) => (
        <div className="font-medium text-slate-900">{task.task_number}</div>
      )
    },
    {
      key: 'order_number',
      label: 'Order #',
      render: (task: WarehouseTaskWithRelations) => (
        <div className="flex items-center gap-2">
          <span className="text-slate-700">{getOrderNumber(task)}</span>
          {isRushOrder(task) && (
            <Badge variant="error" size="sm">
              <AlertTriangle className="w-3 h-3 mr-1" />
              RUSH
            </Badge>
          )}
        </div>
      )
    },
    {
      key: 'client',
      label: 'Client',
      render: (task: WarehouseTaskWithRelations) => (
        <div className="text-slate-700">{getClientName(task)}</div>
      )
    },
    {
      key: 'item_count',
      label: 'Item Count',
      render: (task: WarehouseTaskWithRelations) => (
        <div className="text-slate-700">{getItemCount(task)} items</div>
      )
    },
    {
      key: 'total_units',
      label: 'Total Units',
      render: (task: WarehouseTaskWithRelations) => (
        <div>
          <div className="text-slate-900 font-medium">
            {task.qty_completed} / {task.qty_requested}
          </div>
          <div className="mt-1 w-full bg-slate-200 rounded-full h-1.5">
            <div
              className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${getProgressPercentage(task)}%` }}
            />
          </div>
        </div>
      )
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (task: WarehouseTaskWithRelations) => (
        <Badge variant={getPriorityBadgeVariant(task.priority || 0)}>
          {task.priority || 0}
        </Badge>
      )
    },
    {
      key: 'assigned_to',
      label: 'Assigned To',
      render: (task: WarehouseTaskWithRelations) => (
        <div className="text-slate-700">
          {task.assigned_to ? (
            'Assigned'
          ) : (
            <span className="text-slate-400">Unassigned</span>
          )}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (task: WarehouseTaskWithRelations) => (
        <Badge variant={getStatusBadgeVariant(task.status)}>
          {task.status.replace(/_/g, ' ')}
        </Badge>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (task: WarehouseTaskWithRelations) => (
        <Button
          size="sm"
          onClick={() => handleClaimAndStart(task)}
          disabled={actionLoading === task.id}
          className="whitespace-nowrap"
        >
          {actionLoading === task.id ? (
            <div className="mr-2">
              <Spinner size="sm" />
            </div>
          ) : (
            <Play className="w-4 h-4 mr-2" />
          )}
          {task.status === 'pending' ? 'Claim & Start' : 'Resume'}
        </Button>
      )
    }
  ];

  return (
    <AppShell title="Pick List Queue">
      <Breadcrumbs
        items={[
          { label: 'Tasks', href: '/tasks' },
          { label: 'Pick Lists', href: '/tasks/pick' }
        ]}
      />
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Pending Orders</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-slate-600" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">In Progress</p>
                <p className="text-3xl font-bold text-indigo-600 mt-2">{stats.inProgress}</p>
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Completed Today</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{stats.completedToday}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <div className="flex items-center gap-3 text-red-800">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          </Card>
        )}

        {/* Pick Tasks Table */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <ListChecks className="w-6 h-6 text-indigo-600" />
              <h2 className="text-xl font-semibold text-slate-900">Active Pick Lists</h2>
            </div>
            <Button variant="secondary" onClick={loadTasks} disabled={loading}>
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : tasks.length === 0 ? (
            <EmptyState
              icon={<ListChecks className="w-12 h-12" />}
              title="No active pick lists"
              description="All orders have been picked or there are no pending orders."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column.key}
                        className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {tasks.map((task) => (
                    <tr key={task.id} className="hover:bg-slate-50">
                      {columns.map((column) => (
                        <td key={column.key} className="px-6 py-4 whitespace-nowrap">
                          {column.render(task)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Pick Scanner Modal */}
      {selectedTask && (
        <Modal
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          title={`Picking Order ${getOrderNumber(selectedTask)}`}
          size="lg"
        >
          <PickScanner
            outboundOrderId={selectedTask.order_id || ''}
            locationId={selectedTask.source_location_id || ''}
            onComplete={handleScannerComplete}
          />
        </Modal>
      )}
    </AppShell>
  );
}
