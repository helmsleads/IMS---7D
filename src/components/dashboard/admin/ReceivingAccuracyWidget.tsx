import Card from "@/components/ui/Card";
import { HorizontalBarChart } from "@/components/ui/charts";
import { SupplierAccuracy } from "@/lib/api/dashboard";
import { CheckCircle } from "lucide-react";
import Link from "next/link";

interface Props {
  accuracyData: SupplierAccuracy[];
}

export default function ReceivingAccuracyWidget({ accuracyData }: Props) {
  const chartData = accuracyData.slice(0, 8).map((s) => ({
    name:
      s.supplier.length > 14 ? s.supplier.slice(0, 14) + "..." : s.supplier,
    value: s.accuracyPercent,
    color:
      s.accuracyPercent >= 95
        ? "#10B981"
        : s.accuracyPercent >= 85
          ? "#F59E0B"
          : "#EF4444",
  }));

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Receiving Accuracy</h3>
        <Link href="/inbound" className="text-sm text-indigo-600 hover:text-indigo-800">
          Inbound
        </Link>
      </div>
      {chartData.length > 0 ? (
        <HorizontalBarChart
          data={chartData}
          valueFormatter={(v) => `${v}%`}
        />
      ) : (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <CheckCircle className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 text-sm">No receiving data yet</p>
        </div>
      )}
    </Card>
  );
}
