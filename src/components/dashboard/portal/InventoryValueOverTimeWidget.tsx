import Card from "@/components/ui/Card";
import { MiniLineChart } from "@/components/ui/charts";
import { InventoryValuePoint } from "@/lib/api/portal-dashboard";
import { formatCurrency } from "@/lib/utils/formatting";
import { TrendingUp } from "lucide-react";

interface Props {
  valueData: InventoryValuePoint[];
}

export default function InventoryValueOverTimeWidget({ valueData }: Props) {
  const latestValue =
    valueData.length > 0 ? valueData[valueData.length - 1].value : 0;

  const chartData = valueData.map((point) => ({
    name: point.month,
    value: point.value,
  }));

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Inventory Value Over Time
        </h3>
      </div>

      {valueData.length > 0 ? (
        <>
          <p className="text-3xl font-bold text-slate-900 mb-1">
            {formatCurrency(latestValue, 0)}
          </p>
          <p className="text-sm text-slate-500 mb-4">current inventory value</p>

          <MiniLineChart
            data={chartData}
            lines={[{ dataKey: "value", color: "#0891B2", label: "Value" }]}
            xDataKey="name"
            height={160}
          />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <TrendingUp className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">No inventory value data available</p>
        </div>
      )}
    </Card>
  );
}
