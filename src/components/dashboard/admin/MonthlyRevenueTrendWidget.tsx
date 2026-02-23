import Card from "@/components/ui/Card";
import { MiniLineChart } from "@/components/ui/charts";
import { MonthlyRevenuePoint } from "@/lib/api/dashboard";
import { formatCurrency } from "@/lib/utils/formatting";
import { TrendingUp } from "lucide-react";
import Link from "next/link";

interface Props {
  revenueData: MonthlyRevenuePoint[];
}

export default function MonthlyRevenueTrendWidget({ revenueData }: Props) {
  const chartData = revenueData.map((p) => ({
    month: p.month,
    revenue: p.revenue,
  }));

  const totalRevenue = revenueData.reduce((s, p) => s + p.revenue, 0);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Monthly Revenue Trend</h3>
        <Link href="/billing" className="text-sm text-indigo-600 hover:text-indigo-800">
          Billing
        </Link>
      </div>
      {chartData.length > 0 ? (
        <>
          <div className="text-2xl font-bold text-slate-900 mb-1">
            {formatCurrency(totalRevenue, 0)}
          </div>
          <p className="text-sm text-slate-500 mb-3">Total over 12 months</p>
          <MiniLineChart
            data={chartData}
            lines={[{ dataKey: "revenue", color: "#4F46E5", label: "Revenue" }]}
            xDataKey="month"
            height={160}
            showGrid
            showXAxis
          />
        </>
      ) : (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <TrendingUp className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 text-sm">No revenue data yet</p>
        </div>
      )}
    </Card>
  );
}
