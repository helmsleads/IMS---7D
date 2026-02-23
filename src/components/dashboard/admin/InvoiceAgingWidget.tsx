import Card from "@/components/ui/Card";
import { StackedBarChart, ChartLegend } from "@/components/ui/charts";
import { InvoiceAgingData } from "@/lib/api/dashboard";
import { formatCurrency } from "@/lib/utils/formatting";
import Link from "next/link";

interface Props {
  agingData: InvoiceAgingData | null;
}

export default function InvoiceAgingWidget({ agingData }: Props) {
  if (!agingData || agingData.total === 0) {
    return (
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Invoice Aging</h3>
          <Link href="/billing" className="text-sm text-indigo-600 hover:text-indigo-800">Billing</Link>
        </div>
        <p className="text-slate-500 text-sm text-center py-4">No outstanding invoices</p>
      </Card>
    );
  }

  const chartData = [
    { name: "Outstanding", current: agingData.current, "30d": agingData.over30, "60d": agingData.over60, "90d+": agingData.over90 },
  ];

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Invoice Aging</h3>
        <Link href="/billing" className="text-sm text-indigo-600 hover:text-indigo-800">Billing</Link>
      </div>
      <div className="text-2xl font-bold text-slate-900 mb-4">
        {formatCurrency(agingData.total)}
      </div>
      <StackedBarChart
        data={chartData}
        stacks={[
          { dataKey: "current", color: "#10B981", label: "Current" },
          { dataKey: "30d", color: "#FBBF24", label: "30+ days" },
          { dataKey: "60d", color: "#F97316", label: "60+ days" },
          { dataKey: "90d+", color: "#EF4444", label: "90+ days" },
        ]}
        height={60}
        showGrid={false}
        showXAxis={false}
        valueFormatter={(v) => formatCurrency(v, 0)}
      />
      <div className="mt-3">
        <ChartLegend items={[
          { label: "Current", color: "#10B981", value: formatCurrency(agingData.current, 0) },
          { label: "30+ days", color: "#FBBF24", value: formatCurrency(agingData.over30, 0) },
          { label: "60+ days", color: "#F97316", value: formatCurrency(agingData.over60, 0) },
          { label: "90+ days", color: "#EF4444", value: formatCurrency(agingData.over90, 0) },
        ]} layout="vertical" />
      </div>
    </Card>
  );
}
