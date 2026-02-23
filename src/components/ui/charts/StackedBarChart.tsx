"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface StackConfig {
  dataKey: string;
  color: string;
  label?: string;
}

interface StackedBarChartProps {
  data: Record<string, unknown>[];
  stacks: StackConfig[];
  height?: number;
  showGrid?: boolean;
  showXAxis?: boolean;
  xDataKey?: string;
  layout?: "horizontal" | "vertical";
  valueFormatter?: (value: number) => string;
}

function CustomTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
  valueFormatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-slate-700 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-600">{entry.name}:</span>
          <span className="font-medium text-slate-900">
            {valueFormatter ? valueFormatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function StackedBarChart({
  data,
  stacks,
  height = 180,
  showGrid = true,
  showXAxis = true,
  xDataKey = "name",
  layout = "horizontal",
  valueFormatter,
}: StackedBarChartProps) {
  if (!data || data.length === 0) return null;

  return (
    <div className="animate-chart-enter" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={layout === "vertical" ? "vertical" : "horizontal"}
          margin={{ top: 4, right: 8, bottom: 0, left: layout === "vertical" ? 0 : -20 }}
        >
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />}
          {layout === "vertical" ? (
            <>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey={xDataKey}
                tick={{ fontSize: 11, fill: "#94A3B8" }}
                axisLine={false}
                tickLine={false}
                width={80}
              />
            </>
          ) : (
            <>
              {showXAxis && (
                <XAxis
                  dataKey={xDataKey}
                  tick={{ fontSize: 11, fill: "#94A3B8" }}
                  axisLine={false}
                  tickLine={false}
                />
              )}
              <YAxis hide />
            </>
          )}
          <Tooltip content={<CustomTooltip valueFormatter={valueFormatter} />} cursor={{ fill: "rgba(148, 163, 184, 0.08)" }} />
          {stacks.map((stack, idx) => (
            <Bar
              key={stack.dataKey}
              dataKey={stack.dataKey}
              name={stack.label || stack.dataKey}
              fill={stack.color}
              stackId="stack"
              radius={idx === stacks.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              isAnimationActive={true}
              animationDuration={800}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
