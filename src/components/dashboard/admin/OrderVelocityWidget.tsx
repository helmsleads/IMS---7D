import Card from "@/components/ui/Card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { MiniBarChart, ChartLegend } from "@/components/ui/charts";

interface OrderVelocity {
  shippedThisWeek: number;
  shippedLastWeek: number;
  receivedThisWeek: number;
  receivedLastWeek: number;
  trend: "up" | "down" | "flat";
  trendPercent: number;
}

interface Props {
  orderVelocity: OrderVelocity | null;
}

export default function OrderVelocityWidget({ orderVelocity }: Props) {
  const velocityChartData = orderVelocity
    ? [
        { name: "Last Week", shipped: orderVelocity.shippedLastWeek, received: orderVelocity.receivedLastWeek },
        { name: "This Week", shipped: orderVelocity.shippedThisWeek, received: orderVelocity.receivedThisWeek },
      ]
    : [];

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Order Velocity</h3>
        {orderVelocity && orderVelocity.trendPercent !== 0 && (
          <span className={`inline-flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-full ${
            orderVelocity.trend === "up"
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}>
            {orderVelocity.trend === "up" ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            {orderVelocity.trendPercent > 0 ? "+" : ""}{orderVelocity.trendPercent}%
          </span>
        )}
      </div>
      {velocityChartData.length > 0 ? (
        <>
          <MiniBarChart
            data={velocityChartData}
            bars={[
              { dataKey: "shipped", color: "#8B5CF6", label: "Shipped" },
              { dataKey: "received", color: "#06B6D4", label: "Received" },
            ]}
            height={150}
            showXAxis
          />
          <div className="mt-3">
            <ChartLegend items={[
              { label: "Shipped", color: "#8B5CF6" },
              { label: "Received", color: "#06B6D4" },
            ]} />
          </div>
        </>
      ) : (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <TrendingUp className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 text-sm">No velocity data yet</p>
        </div>
      )}
    </Card>
  );
}
