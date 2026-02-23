import Card from "@/components/ui/Card";
import { HorizontalBarChart } from "@/components/ui/charts";
import { ProductReturnRate } from "@/lib/api/dashboard";
import { RotateCcw } from "lucide-react";
import Link from "next/link";

interface Props {
  returnRates: ProductReturnRate[];
}

export default function ReturnRateWidget({ returnRates }: Props) {
  const chartData = returnRates.slice(0, 6).map((r) => ({
    name: r.productName.length > 14 ? r.productName.slice(0, 14) + "..." : r.productName,
    value: r.rate,
    color: r.rate > 10 ? "#EF4444" : r.rate > 5 ? "#F59E0B" : "#10B981",
  }));

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Return Rates</h3>
        <Link href="/returns" className="text-sm text-indigo-600 hover:text-indigo-800">
          View Returns
        </Link>
      </div>
      {chartData.length > 0 ? (
        <>
          <HorizontalBarChart
            data={chartData}
            valueFormatter={(v) => `${v}%`}
          />
          <p className="text-xs text-slate-400 mt-2">% of shipped units returned, by product</p>
        </>
      ) : (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
            <RotateCcw className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-slate-500 text-sm">No return data</p>
        </div>
      )}
    </Card>
  );
}
