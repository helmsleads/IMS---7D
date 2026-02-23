"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface LineConfig {
  dataKey: string;
  color: string;
  label?: string;
  dashed?: boolean;
}

interface MiniLineChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[];
  lines: LineConfig[];
  height?: number;
  showGrid?: boolean;
  showXAxis?: boolean;
  xDataKey?: string;
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

export default function MiniLineChart({
  data,
  lines,
  height = 160,
  showGrid = true,
  showXAxis = true,
  xDataKey = "name",
}: MiniLineChartProps) {
  if (!data || data.length === 0) return null;

  return (
    <div className="animate-chart-enter" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />}
          {showXAxis && (
            <XAxis
              dataKey={xDataKey}
              tick={{ fontSize: 11, fill: "#94A3B8" }}
              axisLine={false}
              tickLine={false}
            />
          )}
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} />
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              name={line.label || line.dataKey}
              stroke={line.color}
              strokeWidth={2}
              strokeDasharray={line.dashed ? "5 5" : undefined}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={true}
              animationDuration={800}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
