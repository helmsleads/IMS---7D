import Card from "@/components/ui/Card";
import Link from "next/link";
import { FileText } from "lucide-react";

interface OrderToShip {
  id: string;
  order_number: string;
  client: { company_name: string } | null;
  items_count: number;
  requested_at: string | null;
  is_rush: boolean;
}

interface Props {
  ordersToShip: OrderToShip[];
}

export default function OrdersToShipWidget({ ordersToShip }: Props) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Orders to Ship</h3>
        {ordersToShip.length > 0 && (
          <Link
            href="/outbound"
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            View All
          </Link>
        )}
      </div>
      {ordersToShip.length === 0 ? (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <FileText className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 text-sm">No orders to ship</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ordersToShip.slice(0, 5).map((order) => (
            <Link
              key={order.id}
              href={`/outbound/${order.id}`}
              className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 hover:bg-slate-50 -mx-2 px-2 rounded"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900 truncate">
                    {order.order_number}
                  </p>
                  {order.is_rush && (
                    <span className="inline-flex px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
                      Rush
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate">
                  {order.client?.company_name || "Unknown client"}
                </p>
              </div>
              <div className="text-right ml-4">
                <p className="font-medium text-slate-900">
                  {order.items_count} item{order.items_count !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-slate-500">
                  {order.requested_at
                    ? new Date(order.requested_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    : "No date"}
                </p>
              </div>
            </Link>
          ))}
          {ordersToShip.length > 5 && (
            <p className="text-sm text-slate-500 text-center pt-2">
              and {ordersToShip.length - 5} more...
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
