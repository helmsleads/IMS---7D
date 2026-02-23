import Card from "@/components/ui/Card";
import { HorizontalBarChart } from "@/components/ui/charts";
import { CategoryTurnover } from "@/lib/api/dashboard";
import { RefreshCw } from "lucide-react";

interface Props {
  turnoverData: CategoryTurnover[];
}

const COLORS = [
  "#4F46E5",
  "#06B6D4",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
];

export default function InventoryTurnoverWidget({ turnoverData }: Props) {
  const chartData = turnoverData.slice(0, 8).map((d, idx) => ({
    name:
      d.category.length > 14 ? d.category.slice(0, 14) + "..." : d.category,
    value: d.turnoverRatio,
    color: COLORS[idx % COLORS.length],
  }));

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Inventory Turnover
        </h3>
      </div>
      {chartData.length > 0 ? (
        <HorizontalBarChart
          data={chartData}
          valueFormatter={(v) => `${v}x`}
        />
      ) : (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <RefreshCw className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 text-sm">No turnover data yet</p>
        </div>
      )}
    </Card>
  );
}
