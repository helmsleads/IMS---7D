"use client";

import {
  ScatterChart as RechartsScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ScatterPoint {
  x: number;
  y: number;
  name: string;
  z?: number;
}

interface ScatterChartProps {
  data: ScatterPoint[];
  xLabel?: string;
  yLabel?: string;
  height?: number;
  color?: string;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ScatterPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-slate-700">{d.name}</p>
      <p className="text-slate-600">
        x: <span className="font-semibold text-slate-900">{d.x}</span>
      </p>
      <p className="text-slate-600">
        y: <span className="font-semibold text-slate-900">{d.y}</span>
      </p>
    </div>
  );
}

export default function ScatterChart({
  data,
  xLabel,
  yLabel,
  height = 200,
  color = "#4F46E5",
}: ScatterChartProps) {
  if (!data || data.length === 0) return null;

  return (
    <div className="animate-chart-enter" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsScatterChart margin={{ top: 8, right: 8, bottom: 4, left: -10 }}>
          <XAxis
            type="number"
            dataKey="x"
            name={xLabel || "x"}
            tick={{ fontSize: 11, fill: "#94A3B8" }}
            axisLine={{ stroke: "#E2E8F0" }}
            tickLine={false}
            label={
              xLabel
                ? { value: xLabel, position: "insideBottom", offset: -2, fontSize: 11, fill: "#64748B" }
                : undefined
            }
          />
          <YAxis
            type="number"
            dataKey="y"
            name={yLabel || "y"}
            tick={{ fontSize: 11, fill: "#94A3B8" }}
            axisLine={{ stroke: "#E2E8F0" }}
            tickLine={false}
            label={
              yLabel
                ? { value: yLabel, angle: -90, position: "insideLeft", offset: 16, fontSize: 11, fill: "#64748B" }
                : undefined
            }
          />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3", stroke: "#CBD5E1" }} />
          <Scatter
            data={data}
            fill={color}
            isAnimationActive={true}
            animationDuration={800}
          />
        </RechartsScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
