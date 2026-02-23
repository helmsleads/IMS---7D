"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface HorizontalBarChartProps {
  data: { name: string; value: number; color?: string }[];
  height?: number;
  color?: string;
  valueFormatter?: (value: number) => string;
}

function CustomTooltip({
  active,
  payload,
  valueFormatter,
}: {
  active?: boolean;
  payload?: Array<{ payload: { name: string; value: number }; color: string }>;
  valueFormatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-slate-700">{d.name}</p>
      <p className="text-slate-900 font-semibold">
        {valueFormatter ? valueFormatter(d.value) : d.value}
      </p>
    </div>
  );
}

export default function HorizontalBarChart({
  data,
  height,
  color = "#4F46E5",
  valueFormatter,
}: HorizontalBarChartProps) {
  if (!data || data.length === 0) return null;

  const computedHeight = height || Math.max(data.length * 36, 120);

  return (
    <div className="animate-chart-enter" style={{ height: computedHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
            width={100}
          />
          <Tooltip content={<CustomTooltip valueFormatter={valueFormatter} />} cursor={{ fill: "rgba(148, 163, 184, 0.08)" }} />
          <Bar
            dataKey="value"
            radius={[0, 4, 4, 0]}
            isAnimationActive={true}
            animationDuration={800}
            barSize={20}
          >
            {data.map((entry, idx) => (
              <Cell key={idx} fill={entry.color || color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
