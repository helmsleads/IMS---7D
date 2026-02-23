import Card from "@/components/ui/Card";
import { HorizontalBarChart } from "@/components/ui/charts";
import { ClientRevenue } from "@/lib/api/dashboard";
import { formatCurrency } from "@/lib/utils/formatting";
import { DollarSign } from "lucide-react";
import Link from "next/link";

interface Props {
  clientRevenue: ClientRevenue[];
}

export default function RevenueByClientWidget({ clientRevenue }: Props) {
  const chartData = clientRevenue.slice(0, 6).map((c, idx) => ({
    name: c.clientName.length > 14 ? c.clientName.slice(0, 14) + "..." : c.clientName,
    value: c.revenue,
    color: ["#4F46E5", "#06B6D4", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"][idx % 6],
  }));

  const totalRevenue = clientRevenue.reduce((s, c) => s + c.revenue, 0);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Revenue by Client</h3>
        <Link href="/billing" className="text-sm text-indigo-600 hover:text-indigo-800">
          Billing
        </Link>
      </div>
      {chartData.length > 0 ? (
        <>
          <div className="text-2xl font-bold text-slate-900 mb-3">
            {formatCurrency(totalRevenue, 0)}
          </div>
          <HorizontalBarChart
            data={chartData}
            valueFormatter={(v) => formatCurrency(v, 0)}
          />
        </>
      ) : (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <DollarSign className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 text-sm">No revenue data yet</p>
        </div>
      )}
    </Card>
  );
}
