import Card from "@/components/ui/Card";

function ProgressRow({ label, value, maxValue, color }: { label: string; value: number; maxValue: number; color: string }) {
  const pct = maxValue > 0 ? Math.max((value / maxValue) * 100, 4) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold text-slate-900">{value}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: value > 0 ? `${pct}%` : "0%", backgroundColor: color }}
        />
      </div>
    </div>
  );
}

interface Props {
  stats: {
    pendingInbound: number;
    pendingOutbound: number;
    ordersToShipToday: number;
    ordersToReceiveToday: number;
  } | null;
}

export default function OrdersSummaryWidget({ stats }: Props) {
  const values = [
    stats?.pendingInbound || 0,
    stats?.pendingOutbound || 0,
    stats?.ordersToShipToday || 0,
    stats?.ordersToReceiveToday || 0,
  ];
  const maxValue = Math.max(...values, 1);

  return (
    <Card>
      <h3 className="text-lg font-semibold text-slate-900 mb-5">Orders Summary</h3>
      <div className="space-y-4">
        <ProgressRow
          label="Inbound to receive"
          value={stats?.pendingInbound || 0}
          maxValue={maxValue}
          color="#3B82F6"
        />
        <ProgressRow
          label="Outbound to ship"
          value={stats?.pendingOutbound || 0}
          maxValue={maxValue}
          color="#8B5CF6"
        />
        <div className="border-t border-slate-200 pt-4 space-y-4">
          <ProgressRow
            label="Ship today"
            value={stats?.ordersToShipToday || 0}
            maxValue={maxValue}
            color="#4F46E5"
          />
          <ProgressRow
            label="Receive today"
            value={stats?.ordersToReceiveToday || 0}
            maxValue={maxValue}
            color="#06B6D4"
          />
        </div>
      </div>
    </Card>
  );
}
