"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface DonutChartData {
  name: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutChartData[];
  centerLabel?: string;
  centerValue?: string | number;
  size?: number;
}

export default function DonutChart({
  data,
  centerLabel,
  centerValue,
  size = 180,
}: DonutChartProps) {
  const hasData = data.some((d) => d.value > 0);

  if (!hasData) return null;

  return (
    <div className="relative animate-chart-enter" style={{ width: size, height: size, margin: "0 auto" }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="85%"
            paddingAngle={3}
            dataKey="value"
            isAnimationActive={true}
            animationDuration={800}
            animationBegin={200}
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel || centerValue !== undefined) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {centerValue !== undefined && (
            <span className="text-2xl font-bold text-slate-900">{centerValue}</span>
          )}
          {centerLabel && (
            <span className="text-xs text-slate-500">{centerLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
