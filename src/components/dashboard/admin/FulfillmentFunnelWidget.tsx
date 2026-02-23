import Card from "@/components/ui/Card";
import { ChartLegend } from "@/components/ui/charts";
import { FulfillmentFunnelData } from "@/lib/api/dashboard";

interface Props {
  funnelData: FulfillmentFunnelData[];
}

export default function FulfillmentFunnelWidget({ funnelData }: Props) {
  const maxCount = Math.max(...funnelData.map((d) => d.count), 1);

  return (
    <Card>
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Fulfillment Pipeline</h3>
      {funnelData.every((d) => d.count === 0) ? (
        <p className="text-slate-500 text-sm text-center py-4">No orders in pipeline</p>
      ) : (
        <>
          <div className="space-y-3">
            {funnelData.map((stage) => {
              const pct = maxCount > 0 ? Math.max((stage.count / maxCount) * 100, 4) : 0;
              return (
                <div key={stage.stage} className="space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                      <span className="text-slate-600">{stage.stage}</span>
                    </div>
                    <span className="font-semibold text-slate-900">{stage.count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: stage.count > 0 ? `${pct}%` : "0%", backgroundColor: stage.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total in pipeline</span>
              <span className="font-semibold text-slate-900">
                {funnelData.reduce((sum, d) => sum + d.count, 0)}
              </span>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
