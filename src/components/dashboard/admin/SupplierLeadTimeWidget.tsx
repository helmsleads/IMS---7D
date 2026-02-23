import Card from "@/components/ui/Card";
import { HorizontalBarChart } from "@/components/ui/charts";
import { SupplierLeadTime } from "@/lib/api/dashboard";
import { Truck } from "lucide-react";

interface Props {
  leadTimes: SupplierLeadTime[];
}

export default function SupplierLeadTimeWidget({ leadTimes }: Props) {
  const chartData = leadTimes.map((s) => ({
    name: s.supplier.length > 14 ? s.supplier.slice(0, 14) + "..." : s.supplier,
    value: s.avgDays,
    color: s.avgDays > 14 ? "#EF4444" : s.avgDays > 7 ? "#F59E0B" : "#10B981",
  }));

  return (
    <Card>
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Supplier Lead Times</h3>
      {chartData.length > 0 ? (
        <>
          <HorizontalBarChart
            data={chartData}
            valueFormatter={(v) => `${v} days`}
          />
          <p className="text-xs text-slate-400 mt-2">Avg days from PO creation to receipt</p>
        </>
      ) : (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <Truck className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 text-sm">No supplier data yet</p>
        </div>
      )}
    </Card>
  );
}
