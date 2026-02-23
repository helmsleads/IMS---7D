import Card from "@/components/ui/Card";
import { DonutChart, ChartLegend } from "@/components/ui/charts";
import { ReturnReasonData } from "@/lib/api/dashboard";
import { RotateCcw } from "lucide-react";
import Link from "next/link";

interface Props {
  reasonData: ReturnReasonData[];
}

export default function ReturnsByReasonWidget({ reasonData }: Props) {
  const totalReturns = reasonData.reduce((s, r) => s + r.count, 0);

  const donutData = reasonData.map((r) => ({
    name: r.reason,
    value: r.count,
    color: r.color,
  }));

  const legendItems = reasonData.map((r) => ({
    label: r.reason,
    color: r.color,
    value: r.count,
  }));

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Returns by Reason</h3>
        <Link href="/returns" className="text-sm text-indigo-600 hover:text-indigo-800">
          Returns
        </Link>
      </div>
      {donutData.length > 0 ? (
        <>
          <DonutChart
            data={donutData}
            centerValue={totalReturns}
            centerLabel="Total"
            size={180}
          />
          <div className="mt-4">
            <ChartLegend items={legendItems} layout="vertical" />
          </div>
        </>
      ) : (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <RotateCcw className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 text-sm">No return data yet</p>
        </div>
      )}
    </Card>
  );
}
