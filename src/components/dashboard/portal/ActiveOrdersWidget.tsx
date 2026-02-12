import Card from "@/components/ui/Card";
import Link from "next/link";
import { Truck } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/utils/formatting";

const ORDER_STAGES = ["pending", "confirmed", "processing", "packed", "shipped", "delivered"] as const;

function OrderProgressDots({ status }: { status: string }) {
  const currentIdx = ORDER_STAGES.indexOf(status as typeof ORDER_STAGES[number]);

  return (
    <div className="flex items-center gap-1 mt-1.5">
      {ORDER_STAGES.map((stage, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <div
            key={stage}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              isCurrent
                ? "w-5 bg-cyan-500"
                : isCompleted
                ? "w-1.5 bg-cyan-400"
                : "w-1.5 bg-slate-200"
            }`}
            title={stage}
          />
        );
      })}
    </div>
  );
}

interface RecentOrder {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  item_count: number;
}

interface Props {
  activeOrdersList: RecentOrder[];
}

export default function ActiveOrdersWidget({ activeOrdersList }: Props) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Active Orders</h2>
        <Link
          href="/portal/orders"
          className="text-sm text-cyan-600 hover:text-cyan-700 font-medium"
        >
          View All
        </Link>
      </div>

      {activeOrdersList.length > 0 ? (
        <div className="space-y-3">
          {activeOrdersList.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0"
            >
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-medium text-slate-900">{order.order_number}</p>
                  <p className="text-sm text-slate-500">
                    {formatDate(order.created_at)}
                  </p>
                  <OrderProgressDots status={order.status} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={order.status} entityType="outbound" />
                <Link
                  href={`/portal/orders/${order.id}`}
                  className="text-sm text-cyan-600 hover:text-cyan-700 font-medium"
                >
                  Track
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-500">
          <Truck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>No active orders</p>
          <Link
            href="/portal/request-shipment"
            className="text-cyan-600 hover:underline text-sm mt-1 inline-block"
          >
            Request a shipment
          </Link>
        </div>
      )}
    </Card>
  );
}
