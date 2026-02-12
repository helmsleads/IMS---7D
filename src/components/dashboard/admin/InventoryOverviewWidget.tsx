import Card from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils/formatting";

interface Props {
  stats: {
    totalUnitsInStock: number;
    totalInventoryValue: number;
    lowStockCount: number;
    totalClients: number;
  } | null;
}

export default function InventoryOverviewWidget({ stats }: Props) {
  return (
    <Card>
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Inventory Overview</h3>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Total Units</span>
          <span className="font-medium text-slate-900">
            {stats?.totalUnitsInStock.toLocaleString() || 0}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Total Value</span>
          <span className="font-medium text-slate-900">
            {formatCurrency(stats?.totalInventoryValue || 0, 0)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Low Stock Items</span>
          <span className={`font-medium ${
            stats && stats.lowStockCount > 0
              ? "text-red-600"
              : "text-slate-900"
          }`}>
            {stats?.lowStockCount || 0}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Active Clients</span>
          <span className="font-medium text-slate-900">
            {stats?.totalClients || 0}
          </span>
        </div>
      </div>
    </Card>
  );
}
