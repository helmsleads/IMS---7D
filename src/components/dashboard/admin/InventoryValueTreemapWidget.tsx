import Card from "@/components/ui/Card";
import { TreemapChart, ChartLegend } from "@/components/ui/charts";
import { CategoryValue } from "@/lib/api/dashboard";
import { formatCurrency } from "@/lib/utils/formatting";
import Link from "next/link";

interface Props {
  categoryValues: CategoryValue[];
}

export default function InventoryValueTreemapWidget({ categoryValues }: Props) {
  const totalValue = categoryValues.reduce((s, d) => s + d.value, 0);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Inventory Value</h3>
        <Link href="/reports" className="text-sm text-indigo-600 hover:text-indigo-800">
          View Reports
        </Link>
      </div>
      {categoryValues.length > 0 ? (
        <>
          <TreemapChart
            data={categoryValues}
            height={180}
            valueFormatter={(v) => formatCurrency(v, 0)}
          />
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex justify-between text-sm mb-3">
              <span className="text-slate-500">Total value</span>
              <span className="font-semibold text-slate-900">{formatCurrency(totalValue, 0)}</span>
            </div>
            <ChartLegend
              items={categoryValues.slice(0, 5).map((d) => ({
                label: d.name,
                color: d.color,
                value: formatCurrency(d.value, 0),
              }))}
              layout="vertical"
            />
          </div>
        </>
      ) : (
        <p className="text-slate-500 text-sm text-center py-4">No inventory data</p>
      )}
    </Card>
  );
}
