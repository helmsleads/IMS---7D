import Card from "@/components/ui/Card";
import { BulletChart } from "@/components/ui/charts";
import { ReorderProximityItem } from "@/lib/api/dashboard";
import { AlertTriangle } from "lucide-react";

interface Props {
  proximityData: ReorderProximityItem[];
}

function getProximityColor(percentToReorder: number): string {
  if (percentToReorder < 50) return "#EF4444"; // red
  if (percentToReorder < 100) return "#F59E0B"; // amber
  return "#10B981"; // green
}

export default function ReorderProximityWidget({ proximityData }: Props) {
  const chartData = proximityData.map((d) => ({
    label:
      d.productName.length > 12
        ? d.productName.slice(0, 12) + "..."
        : d.productName,
    current: d.currentQty,
    target: d.reorderPoint,
    max: d.maxQty,
    color: getProximityColor(d.percentToReorder),
  }));

  const criticalCount = proximityData.filter(
    (d) => d.percentToReorder < 50
  ).length;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Reorder Proximity
        </h3>
        {criticalCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
            <AlertTriangle className="w-3 h-3" />
            {criticalCount} critical
          </span>
        )}
      </div>
      {chartData.length > 0 ? (
        <>
          <div className="flex items-center gap-3 mb-3 text-[10px] text-slate-500">
            {[
              { label: "Critical (<50%)", color: "#EF4444" },
              { label: "Warning (<100%)", color: "#F59E0B" },
              { label: "OK (>=100%)", color: "#10B981" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <BulletChart data={chartData} />
        </>
      ) : (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <AlertTriangle className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 text-sm">No reorder data yet</p>
        </div>
      )}
    </Card>
  );
}
