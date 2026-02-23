import Card from "@/components/ui/Card";
import { MiniBarChart } from "@/components/ui/charts";
import { DailyThroughput } from "@/lib/api/dashboard";
import { formatNumber } from "@/lib/utils/formatting";
import { Activity } from "lucide-react";

interface Props {
  throughputData: DailyThroughput[];
}

export default function DailyThroughputWidget({ throughputData }: Props) {
  const chartData = throughputData.map((d) => ({
    name: d.date,
    picked: d.picked,
    packed: d.packed,
    shipped: d.shipped,
    total: d.picked + d.packed + d.shipped,
  }));

  const totalUnits = chartData.reduce((sum, d) => sum + d.total, 0);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Daily Throughput
        </h3>
      </div>
      {chartData.length > 0 ? (
        <>
          <p className="text-sm text-slate-500 mb-3">
            {formatNumber(totalUnits)} total units processed
          </p>
          <MiniBarChart
            data={chartData}
            bars={[
              { dataKey: "picked", color: "#4F46E5", label: "Picked" },
              { dataKey: "packed", color: "#06B6D4", label: "Packed" },
              { dataKey: "shipped", color: "#10B981", label: "Shipped" },
            ]}
            showXAxis
          />
        </>
      ) : (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <Activity className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 text-sm">No throughput data yet</p>
        </div>
      )}
    </Card>
  );
}
