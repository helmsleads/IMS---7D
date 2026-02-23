import Card from "@/components/ui/Card";
import { MiniLineChart, ChartLegend } from "@/components/ui/charts";
import { DailyFlowPoint } from "@/lib/api/dashboard";

interface Props {
  flowData: DailyFlowPoint[];
}

export default function InboundOutboundFlowWidget({ flowData }: Props) {
  // Show only every 5th label to avoid crowding
  const sparseData = flowData.map((d, i) => ({
    ...d,
    date: i % 5 === 0 ? d.date : "",
  }));

  const totalInbound = flowData.reduce((s, d) => s + d.inbound, 0);
  const totalOutbound = flowData.reduce((s, d) => s + d.outbound, 0);
  const netFlow = totalInbound - totalOutbound;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Inbound vs Outbound</h3>
        <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
          netFlow >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
        }`}>
          {netFlow >= 0 ? "+" : ""}{netFlow} net
        </span>
      </div>
      {flowData.length > 0 ? (
        <>
          <MiniLineChart
            data={sparseData}
            lines={[
              { dataKey: "inbound", color: "#10B981", label: "Received" },
              { dataKey: "outbound", color: "#8B5CF6", label: "Shipped" },
            ]}
            xDataKey="date"
            height={150}
          />
          <div className="mt-3">
            <ChartLegend items={[
              { label: "Received", color: "#10B981", value: totalInbound },
              { label: "Shipped", color: "#8B5CF6", value: totalOutbound },
            ]} />
          </div>
        </>
      ) : (
        <p className="text-slate-500 text-sm text-center py-4">No flow data available</p>
      )}
    </Card>
  );
}
