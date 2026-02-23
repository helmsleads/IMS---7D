import Card from "@/components/ui/Card";
import { MiniLineChart } from "@/components/ui/charts";
import { DamageRatePoint } from "@/lib/api/dashboard";
import { AlertOctagon } from "lucide-react";
import Link from "next/link";

interface Props {
  damageData: DamageRatePoint[];
}

export default function DamageRateTrendWidget({ damageData }: Props) {
  const chartData = damageData.map((p) => ({
    month: p.month,
    count: p.count,
  }));

  const totalDamage = damageData.reduce((s, p) => s + p.count, 0);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Damage Rate Trend</h3>
        <Link href="/damage-reports" className="text-sm text-indigo-600 hover:text-indigo-800">
          Reports
        </Link>
      </div>
      {chartData.length > 0 ? (
        <>
          <div className="text-2xl font-bold text-slate-900 mb-1">{totalDamage}</div>
          <p className="text-sm text-slate-500 mb-3">Damage reports over 6 months</p>
          <MiniLineChart
            data={chartData}
            lines={[{ dataKey: "count", color: "#EF4444", label: "Damage Reports" }]}
            xDataKey="month"
            height={140}
            showGrid
            showXAxis
          />
        </>
      ) : (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <AlertOctagon className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 text-sm">No damage reports recorded</p>
        </div>
      )}
    </Card>
  );
}
