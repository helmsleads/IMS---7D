import Card from "@/components/ui/Card";
import { MiniBarChart } from "@/components/ui/charts";
import { CycleTimeBucket } from "@/lib/api/dashboard";
import { formatNumber } from "@/lib/utils/formatting";
import { Clock } from "lucide-react";

interface Props {
  cycleTimeData: CycleTimeBucket[];
}

export default function OrderCycleTimeWidget({ cycleTimeData }: Props) {
  const chartData = cycleTimeData.map((d) => ({
    name: d.bucket,
    count: d.count,
  }));

  const totalOrders = cycleTimeData.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Order Cycle Time
        </h3>
      </div>
      {chartData.length > 0 ? (
        <>
          <p className="text-sm text-slate-500 mb-3">
            {formatNumber(totalOrders)} total orders
          </p>
          <MiniBarChart
            data={chartData}
            bars={[{ dataKey: "count", color: "#4F46E5", label: "Orders" }]}
            showXAxis
          />
        </>
      ) : (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <Clock className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 text-sm">No cycle time data yet</p>
        </div>
      )}
    </Card>
  );
}
