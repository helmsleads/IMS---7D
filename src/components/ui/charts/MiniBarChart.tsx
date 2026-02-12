"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface BarConfig {
  dataKey: string;
  color: string;
  label?: string;
}

interface MiniBarChartProps {
  data: Record<string, unknown>[];
  bars: BarConfig[];
  height?: number;
  showGrid?: boolean;
  showXAxis?: boolean;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-slate-700 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-600">{entry.name}:</span>
          <span className="font-medium text-slate-900">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function MiniBarChart({
  data,
  bars,
  height = 160,
  showGrid = false,
  showXAxis = true,
}: MiniBarChartProps) {
  if (!data || data.length === 0) return null;

  return (
    <div className="animate-chart-enter" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />}
          {showXAxis && (
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#94A3B8" }}
              axisLine={false}
              tickLine={false}
            />
          )}
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(148, 163, 184, 0.08)" }} />
          {bars.map((bar) => (
            <Bar
              key={bar.dataKey}
              dataKey={bar.dataKey}
              name={bar.label || bar.dataKey}
              fill={bar.color}
              radius={[4, 4, 0, 0]}
              isAnimationActive={true}
              animationDuration={800}
              animationBegin={100}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
