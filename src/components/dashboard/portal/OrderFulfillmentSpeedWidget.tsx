import Card from "@/components/ui/Card";
import { MiniLineChart } from "@/components/ui/charts";
import { FulfillmentSpeedPoint } from "@/lib/api/portal-dashboard";
import { Zap } from "lucide-react";

interface Props {
  speedData: FulfillmentSpeedPoint[];
}

export default function OrderFulfillmentSpeedWidget({ speedData }: Props) {
  const latestAvgDays =
    speedData.length > 0 ? speedData[speedData.length - 1].avgDays : 0;

  const chartData = speedData.map((point) => ({
    name: point.month,
    avgDays: point.avgDays,
  }));

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Order Fulfillment Speed
        </h3>
      </div>

      {speedData.length > 0 ? (
        <>
          <div className="flex items-baseline gap-2 mb-1">
            <p className="text-3xl font-bold text-slate-900">{latestAvgDays}</p>
            <p className="text-sm font-medium text-slate-500">days avg</p>
          </div>
          <p className="text-sm text-slate-500 mb-4">order to shipment</p>

          <MiniLineChart
            data={chartData}
            lines={[
              { dataKey: "avgDays", color: "#4F46E5", label: "Avg Days" },
            ]}
            xDataKey="name"
            height={160}
          />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <Zap className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">No fulfillment data available</p>
        </div>
      )}
    </Card>
  );
}
