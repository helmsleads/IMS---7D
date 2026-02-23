import Card from "@/components/ui/Card";
import { MiniLineChart } from "@/components/ui/charts";
import { StockProjectionPoint } from "@/lib/api/portal-dashboard";
import { formatNumber } from "@/lib/utils/formatting";
import { TrendingDown } from "lucide-react";

interface Props {
  projectionData: StockProjectionPoint[];
}

export default function StockProjectionWidget({ projectionData }: Props) {
  // Find the current stock level (the point where both actual and projected exist)
  const currentPoint = projectionData.find(
    (p) => p.actual !== null && p.projected !== null
  );
  const currentStock = currentPoint?.actual ?? 0;

  const chartData = projectionData.map((point) => ({
    name: point.date,
    actual: point.actual,
    projected: point.projected,
  }));

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Stock Projection
        </h3>
      </div>

      {projectionData.length > 0 ? (
        <>
          <p className="text-3xl font-bold text-slate-900 mb-1">
            {formatNumber(currentStock)}
          </p>
          <p className="text-sm text-slate-500 mb-4">units in stock</p>

          <MiniLineChart
            data={chartData}
            lines={[
              { dataKey: "actual", color: "#0891B2", label: "Actual" },
              {
                dataKey: "projected",
                color: "#4F46E5",
                label: "Projected",
                dashed: true,
              },
            ]}
            xDataKey="name"
            height={160}
          />

          <p className="text-xs text-slate-400 italic mt-2">
            Dashed = projected
          </p>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <TrendingDown className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">No stock projection data available</p>
        </div>
      )}
    </Card>
  );
}
