import Card from "@/components/ui/Card";
import { DonutChart, ChartLegend } from "@/components/ui/charts";
import { SpendingCategory } from "@/lib/api/portal-dashboard";
import { formatCurrency } from "@/lib/utils/formatting";
import { PieChart } from "lucide-react";

interface Props {
  spendingData: SpendingCategory[];
}

export default function SpendingBreakdownWidget({ spendingData }: Props) {
  const totalSpending = spendingData.reduce(
    (sum, cat) => sum + cat.amount,
    0
  );

  const donutData = spendingData.map((cat) => ({
    name: cat.category,
    value: cat.amount,
    color: cat.color,
  }));

  const legendItems = spendingData.map((cat) => ({
    label: cat.category,
    color: cat.color,
    value: formatCurrency(cat.amount, 0),
  }));

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Spending Breakdown
        </h3>
      </div>

      {spendingData.length > 0 ? (
        <>
          <p className="text-sm text-slate-500 mb-4">
            Total: <span className="font-semibold text-slate-700">{formatCurrency(totalSpending, 0)}</span>
          </p>

          <DonutChart
            data={donutData}
            centerValue={formatCurrency(totalSpending, 0)}
            centerLabel="total"
          />

          <div className="mt-4">
            <ChartLegend items={legendItems} layout="vertical" />
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <PieChart className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">No spending data available</p>
        </div>
      )}
    </Card>
  );
}
