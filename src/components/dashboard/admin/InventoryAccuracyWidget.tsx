import Card from "@/components/ui/Card";
import { MiniLineChart } from "@/components/ui/charts";
import { AccuracyDataPoint } from "@/lib/api/dashboard";
import { Target } from "lucide-react";

interface Props {
  accuracyData: AccuracyDataPoint[];
}

export default function InventoryAccuracyWidget({ accuracyData }: Props) {
  const chartData = accuracyData.map((d) => ({
    name: d.date,
    accuracy: d.accuracyPercent,
  }));

  const latestAccuracy =
    accuracyData.length > 0
      ? accuracyData[accuracyData.length - 1].accuracyPercent
      : null;

  const accuracyColor =
    latestAccuracy !== null && latestAccuracy >= 95
      ? "text-emerald-600"
      : latestAccuracy !== null && latestAccuracy >= 90
        ? "text-amber-600"
        : "text-red-600";

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Inventory Accuracy
        </h3>
      </div>
      {chartData.length > 0 ? (
        <>
          <div className="flex items-baseline gap-2 mb-3">
            <span className={`text-3xl font-bold ${accuracyColor}`}>
              {latestAccuracy !== null ? `${latestAccuracy.toFixed(1)}%` : "—"}
            </span>
            <span className="text-sm text-slate-500">current accuracy</span>
          </div>
          <MiniLineChart
            data={chartData}
            lines={[
              { dataKey: "accuracy", color: "#4F46E5", label: "Accuracy %" },
            ]}
            xDataKey="name"
            showGrid
            showXAxis
          />
        </>
      ) : (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <Target className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 text-sm">No accuracy data yet</p>
        </div>
      )}
    </Card>
  );
}
