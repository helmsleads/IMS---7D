import Card from "@/components/ui/Card";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

interface AttentionData {
  urgentOutbound: { id: string; order_number: string; status: string; requested_at: string | null; client: { company_name: string } | null }[];
  overdueInbound: { id: string; po_number: string; status: string; expected_date: string | null; supplier: string }[];
}

interface Props {
  attentionRequired: AttentionData | null;
}

export default function AttentionRequiredWidget({ attentionRequired }: Props) {
  const attentionCount = attentionRequired
    ? attentionRequired.urgentOutbound.length + attentionRequired.overdueInbound.length
    : 0;

  return (
    <Card accent={attentionCount > 0 ? "red" : "green"}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-900">Attention Required</h3>
          {attentionCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-xs font-bold bg-red-100 text-red-700 rounded-full">
              {attentionCount}
            </span>
          )}
        </div>
      </div>
      {(!attentionRequired || attentionCount === 0) ? (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
            <AlertTriangle className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-slate-500 text-sm">No items need attention</p>
        </div>
      ) : (
        <div className="space-y-3">
          {attentionRequired.urgentOutbound.length > 0 && (
            <div>
              <p className="text-xs font-medium text-red-600 mb-2">
                Stale Outbound ({attentionRequired.urgentOutbound.length})
              </p>
              {attentionRequired.urgentOutbound.map((order) => {
                const days = order.requested_at
                  ? Math.floor((Date.now() - new Date(order.requested_at).getTime()) / (1000 * 60 * 60 * 24))
                  : 0;
                return (
                  <Link
                    key={order.id}
                    href={`/outbound/${order.id}`}
                    className="flex items-center justify-between py-1.5 hover:bg-slate-50 -mx-2 px-2 rounded"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{order.order_number}</p>
                      <p className="text-xs text-slate-500 truncate">{order.client?.company_name || "Unknown"}</p>
                    </div>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 ml-2">
                      {days}d pending
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
          {attentionRequired.overdueInbound.length > 0 && (
            <div className={attentionRequired.urgentOutbound.length > 0 ? "border-t border-slate-100 pt-3" : ""}>
              <p className="text-xs font-medium text-orange-600 mb-2">
                Overdue Inbound ({attentionRequired.overdueInbound.length})
              </p>
              {attentionRequired.overdueInbound.map((order) => {
                const daysOverdue = order.expected_date
                  ? Math.floor((Date.now() - new Date(order.expected_date).getTime()) / (1000 * 60 * 60 * 24))
                  : 0;
                return (
                  <Link
                    key={order.id}
                    href={`/inbound/${order.id}`}
                    className="flex items-center justify-between py-1.5 hover:bg-slate-50 -mx-2 px-2 rounded"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{order.po_number}</p>
                      <p className="text-xs text-slate-500 truncate">{order.supplier}</p>
                    </div>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 ml-2">
                      {daysOverdue}d overdue
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
