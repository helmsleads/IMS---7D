import Card from "@/components/ui/Card";
import { MiniLineChart } from "@/components/ui/charts";
import { OnTimeDataPoint } from "@/lib/api/dashboard";

interface Props {
  onTimeData: OnTimeDataPoint[];
}

export default function OnTimeShipmentWidget({ onTimeData }: Props) {
  const latestRate = onTimeData.length > 0 ? onTimeData[onTimeData.length - 1].rate : 0;
  const totalOrders = onTimeData.reduce((s, d) => s + d.total, 0);
  const totalOnTime = onTimeData.reduce((s, d) => s + d.onTime, 0);
  const overallRate = totalOrders > 0 ? Math.round((totalOnTime / totalOrders) * 100) : 0;

  const rateColor = overallRate >= 90 ? "text-green-600" : overallRate >= 75 ? "text-amber-600" : "text-red-600";
  const rateBg = overallRate >= 90 ? "bg-green-100" : overallRate >= 75 ? "bg-amber-100" : "bg-red-100";

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">On-Time Shipment</h3>
        <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${rateBg} ${rateColor}`}>
          {overallRate}%
        </span>
      </div>
      {onTimeData.length > 0 ? (
        <>
          <MiniLineChart
            data={onTimeData}
            lines={[
              { dataKey: "rate", color: overallRate >= 90 ? "#10B981" : overallRate >= 75 ? "#F59E0B" : "#EF4444", label: "On-Time %" },
            ]}
            xDataKey="week"
            height={120}
            showGrid={false}
          />
          <div className="mt-3 flex justify-between text-sm">
            <span className="text-slate-500">{totalOrders} orders shipped</span>
            <span className="text-slate-500">{totalOnTime} on time</span>
          </div>
        </>
      ) : (
        <p className="text-slate-500 text-sm text-center py-4">No shipment data yet</p>
      )}
    </Card>
  );
}
