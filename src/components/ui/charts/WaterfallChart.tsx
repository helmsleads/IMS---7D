"use client";

import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface WaterfallItem {
  name: string;
  value: number;
  type: "increase" | "decrease" | "total";
}

interface WaterfallChartProps {
  data: WaterfallItem[];
  height?: number;
  valueFormatter?: (value: number) => string;
}

interface ProcessedItem {
  name: string;
  value: number;
  type: "increase" | "decrease" | "total";
  invisible: number;
  visible: number;
}

const COLORS = {
  increase: "#22C55E",
  decrease: "#EF4444",
  total: "#4F46E5",
};

function CustomTooltip({
  active,
  payload,
  valueFormatter,
}: {
  active?: boolean;
  payload?: Array<{ payload: ProcessedItem }>;
  valueFormatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-slate-700">{d.name}</p>
      <p className="text-slate-900 font-semibold">
        {valueFormatter ? valueFormatter(d.value) : d.value.toLocaleString()}
      </p>
    </div>
  );
}

export default function WaterfallChart({
  data,
  height = 200,
  valueFormatter,
}: WaterfallChartProps) {
  if (!data || data.length === 0) return null;

  // Calculate invisible base bars and visible bars
  let runningTotal = 0;
  const processed: ProcessedItem[] = data.map((item) => {
    if (item.type === "total") {
      const result = {
        ...item,
        invisible: 0,
        visible: runningTotal,
      };
      runningTotal = item.value;
      return result;
    }

    if (item.type === "increase") {
      const result = {
        ...item,
        invisible: runningTotal,
        visible: item.value,
      };
      runningTotal += item.value;
      return result;
    }

    // decrease
    runningTotal -= item.value;
    return {
      ...item,
      invisible: runningTotal,
      visible: item.value,
    };
  });

  return (
    <div className="animate-chart-enter" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={processed} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#94A3B8" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<CustomTooltip valueFormatter={valueFormatter} />}
            cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
          />
          <Bar
            dataKey="invisible"
            stackId="stack"
            fill="transparent"
            isAnimationActive={false}
          />
          <Bar
            dataKey="visible"
            stackId="stack"
            radius={[4, 4, 0, 0]}
            isAnimationActive={true}
            animationDuration={800}
          >
            {processed.map((entry, idx) => (
              <Cell key={idx} fill={COLORS[entry.type]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
