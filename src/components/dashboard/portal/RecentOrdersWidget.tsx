import Card from "@/components/ui/Card";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/utils/formatting";

interface RecentOrder {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  item_count: number;
}

interface Props {
  recentOrders: RecentOrder[];
}

export default function RecentOrdersWidget({ recentOrders }: Props) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Recent Orders</h2>
        <Link
          href="/portal/orders"
          className="text-sm text-cyan-600 hover:text-cyan-700 font-medium"
        >
          View All
        </Link>
      </div>

      {recentOrders.length > 0 ? (
        <div className="space-y-3">
          {recentOrders.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0"
            >
              <div>
                <p className="font-medium text-slate-900">{order.order_number}</p>
                <p className="text-sm text-slate-500">
                  {order.item_count} items &middot; {formatDate(order.created_at)}
                </p>
              </div>
              <StatusBadge status={order.status} entityType="outbound" />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-500">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>No orders yet</p>
          <Link
            href="/portal/request-shipment"
            className="text-cyan-600 hover:underline text-sm mt-1 inline-block"
          >
            Request your first shipment
          </Link>
        </div>
      )}
    </Card>
  );
}
