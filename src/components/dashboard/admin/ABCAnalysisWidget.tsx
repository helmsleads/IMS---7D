import Card from "@/components/ui/Card";
import { HorizontalBarChart } from "@/components/ui/charts";
import { ABCItem } from "@/lib/api/dashboard";
import { BarChart3 } from "lucide-react";

interface Props {
  abcData: ABCItem[];
}

const CLASS_COLORS: Record<string, string> = {
  A: "#4F46E5",
  B: "#06B6D4",
  C: "#94A3B8",
};

const CLASS_BG: Record<string, string> = {
  A: "bg-indigo-100 text-indigo-700",
  B: "bg-cyan-100 text-cyan-700",
  C: "bg-slate-100 text-slate-600",
};

export default function ABCAnalysisWidget({ abcData }: Props) {
  const countA = abcData.filter((d) => d.category === "A").length;
  const countB = abcData.filter((d) => d.category === "B").length;
  const countC = abcData.filter((d) => d.category === "C").length;

  const chartData = abcData.slice(0, 6).map((d) => ({
    name:
      d.productName.length > 14
        ? d.productName.slice(0, 14) + "..."
        : d.productName,
    value: d.value,
    color: CLASS_COLORS[d.category] || "#94A3B8",
  }));

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">ABC Analysis</h3>
      </div>
      {abcData.length > 0 ? (
        <>
          <div className="flex items-center gap-2 mb-3">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CLASS_BG.A}`}
            >
              A: {countA}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CLASS_BG.B}`}
            >
              B: {countB}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CLASS_BG.C}`}
            >
              C: {countC}
            </span>
          </div>
          <HorizontalBarChart
            data={chartData}
            valueFormatter={(v) => `$${v.toLocaleString()}`}
          />
        </>
      ) : (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <BarChart3 className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 text-sm">No ABC analysis data yet</p>
        </div>
      )}
    </Card>
  );
}
