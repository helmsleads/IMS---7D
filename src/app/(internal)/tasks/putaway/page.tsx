"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, Clock, Play, CheckCircle, Package, MapPin } from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import PutawayScanner from "@/components/internal/PutawayScanner";
import { getWarehouseTasks, assignTask, startTask, WarehouseTaskWithRelations } from "@/lib/api/warehouse-tasks";
import { useAuth } from "@/lib/auth-context";

export default function PutawayQueuePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<WarehouseTaskWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<WarehouseTaskWithRelations | null>(null);
  const [claimingBulk, setClaimingBulk] = useState(false);

  useEffect(() => {
    loadTasks();
  }, []);

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
      console.error('Failed to load putaway tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
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
    } catch (err) {
      console.error('Failed to claim and start task:', err);
      alert(err instanceof Error ? err.message : 'Failed to start task');
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
      alert(`Claimed ${pendingTasks.length} task(s)`);
    } catch (err) {
      console.error('Failed to claim tasks:', err);
      alert(err instanceof Error ? err.message : 'Failed to claim tasks');
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
    if (priority >= 8) {
      return <Badge variant="error">Urgent</Badge>;
    } else if (priority >= 6) {
      return <Badge variant="warning">High</Badge>;
    } else {
      return <Badge variant="default">Normal</Badge>;
    }
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

  const columns = [
    { key: 'task_number', label: 'Task #' },
    { key: 'product', label: 'Product' },
    { key: 'quantity', label: 'Qty' },
    { key: 'source', label: 'Source Location' },
    { key: 'destination', label: 'Suggested Dest' },
    { key: 'priority', label: 'Priority' },
    { key: 'age', label: 'Age' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions' }
  ];

  const rows = tasks.map(task => ({
    task_number: task.task_number || `#${task.id}`,
    product: (
      <div>
        <div className="font-medium text-slate-900">
          {task.product?.name || 'Unknown Product'}
        </div>
        <div className="text-sm text-slate-500">
          {task.product?.sku || '—'}
        </div>
      </div>
    ),
    quantity: task.qty_requested || '—',
    source: task.source_location?.name || '—',
    destination: task.destination_sublocation?.code || task.destination_location?.name || '—',
    priority: getPriorityBadge(task.priority),
    age: getTaskAge(task.created_at),
    status: getStatusBadge(task.status),
    actions: (
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
    )
  }));

  return (
    <AppShell title="Putaway Queue">
      <Breadcrumbs
        items={[
          { label: 'Tasks', href: '/tasks' },
          { label: 'Putaway' }
        ]}
      />
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
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
      <div className="mb-6 flex gap-3">
        <Button
          variant="primary"
          onClick={handleClaimNext5}
          disabled={pendingCount === 0 || claimingBulk}
        >
          <ArrowDownToLine className="w-4 h-4 mr-1.5" />
          {claimingBulk ? 'Claiming...' : 'Claim Next 5'}
        </Button>
      </div>

      {/* Table */}
      <Card className="border-slate-200/80">
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-600">
            {error}
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={<CheckCircle className="w-12 h-12" />}
            title="No putaway tasks"
            description="All items have been put away. Great work!"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {row.task_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {row.product}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {row.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {row.source}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {row.destination}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {row.priority}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {row.age}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {row.status}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {row.actions}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
