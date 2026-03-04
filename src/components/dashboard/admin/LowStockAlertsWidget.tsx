import Card from "@/components/ui/Card";
import Link from "next/link";
import { Package } from "lucide-react";

interface LowStockItem {
  id: string;
  product_id: string;
  location_id: string;
  qty_on_hand: number;
  avgDailyVelocity: number;
  daysOfStock: number;
  product: {
    id: string;
    sku: string;
    name: string;
    reorder_point: number;
  };
  location: {
    id: string;
    name: string;
  };
}

interface Props {
  lowStockItems: LowStockItem[];
}

function DaysOfStockBadge({ days, velocity }: { days: number; velocity: number }) {
  if (velocity === 0) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
        No recent sales
      </span>
    );
  }
  if (days <= 7) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
        {days}d supply
      </span>
    );
  }
  if (days <= 14) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
        {days}d supply
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
      {days}d supply
    </span>
  );
}

export default function LowStockAlertsWidget({ lowStockItems }: Props) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Low Stock Alerts</h3>
        <div className="flex items-center gap-3">
          {lowStockItems.length > 0 && (
            <>
              <Link
                href="/reports/reorder-suggestions"
                className="text-sm text-green-600 hover:text-green-800 font-medium"
              >
                Reorder
              </Link>
              <Link
                href="/inventory?filter=low-stock"
                className="text-sm text-indigo-600 hover:text-indigo-800"
              >
                View All
              </Link>
            </>
          )}
        </div>
      </div>
      {lowStockItems.length === 0 ? (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
            <Package className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-slate-500 text-sm">All items are well stocked</p>
        </div>
      ) : (
        <div className="max-h-[320px] overflow-y-auto space-y-3">
          {lowStockItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900 truncate">
                  {item.product.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-slate-500">{item.product.sku}</p>
                  <DaysOfStockBadge days={item.daysOfStock} velocity={item.avgDailyVelocity} />
                </div>
              </div>
              <div className="text-right ml-4">
                <p className="text-red-600 font-medium">
                  {item.qty_on_hand} units
                </p>
                <p className="text-xs text-slate-500">
                  Reorder at {item.product.reorder_point}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
