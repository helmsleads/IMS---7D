import Card from "@/components/ui/Card";
import { ScatterChart } from "@/components/ui/charts";
import { ProductPerformancePoint } from "@/lib/api/portal-dashboard";
import { Target } from "lucide-react";

interface Props {
  performanceData: ProductPerformancePoint[];
}

export default function ProductPerformanceWidget({ performanceData }: Props) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Product Performance
        </h3>
      </div>

      {performanceData.length > 0 ? (
        <ScatterChart
          data={performanceData}
          xLabel="Units Sold"
          yLabel="Margin %"
          color="#0891B2"
          height={220}
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <Target className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">No product performance data available</p>
        </div>
      )}
    </Card>
  );
}
