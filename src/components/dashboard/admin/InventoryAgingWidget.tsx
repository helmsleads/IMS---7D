import Card from "@/components/ui/Card";
import Link from "next/link";
import { Archive } from "lucide-react";
import { DonutChart, ChartLegend } from "@/components/ui/charts";

interface AgedInventorySummary {
  over30Days: number;
  over60Days: number;
  over90Days: number;
  oldestItems: { productId: string; sku: string; locationName: string; daysSinceLastMove: number }[];
}

interface Props {
  agedInventory: AgedInventorySummary | null;
}

export default function InventoryAgingWidget({ agedInventory }: Props) {
  const agingDonutData = agedInventory
    ? [
        { name: "30-60d", value: agedInventory.over30Days, color: "#FBBF24" },
        { name: "60-90d", value: agedInventory.over60Days, color: "#F97316" },
        { name: "90d+", value: agedInventory.over90Days, color: "#EF4444" },
      ]
    : [];

  const totalAged = agedInventory
    ? agedInventory.over30Days + agedInventory.over60Days + agedInventory.over90Days
    : 0;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Inventory Aging</h3>
        <Link
          href="/reports"
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          View Reports
        </Link>
      </div>
      {!agedInventory || (agedInventory.over30Days === 0 && agedInventory.over60Days === 0 && agedInventory.over90Days === 0) ? (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
            <Archive className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-slate-500 text-sm">All inventory is moving</p>
        </div>
      ) : (
        <>
          <DonutChart
            data={agingDonutData}
            centerValue={totalAged}
            centerLabel="items"
            size={160}
          />
          <div className="mt-4">
            <ChartLegend items={agingDonutData.map(d => ({ label: d.name, color: d.color, value: `${d.value}` }))} />
          </div>
          {agedInventory.oldestItems.length > 0 && (
            <div className="border-t border-slate-100 pt-3 mt-4">
              <p className="text-xs text-slate-500 mb-2">Oldest items</p>
              <div className="space-y-2">
                {agedInventory.oldestItems.slice(0, 3).map((item) => (
                  <div key={`${item.productId}-${item.locationName}`} className="flex items-center justify-between text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 truncate">{item.sku}</p>
                      <p className="text-xs text-slate-500 truncate">{item.locationName}</p>
                    </div>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 ml-2">
                      {item.daysSinceLastMove}d
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
