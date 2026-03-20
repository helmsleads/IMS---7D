"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useReducedMotion } from "@/hooks/useReducedMotion";

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
  ariaLabel?: string;
}

export default function DonutChart({
  data,
  centerLabel,
  centerValue,
  size = 180,
  ariaLabel = "Donut chart",
}: DonutChartProps) {
  const prefersReducedMotion = useReducedMotion();
  const hasData = data.some((d) => d.value > 0);

  if (!hasData) return null;

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div role="img" aria-label={ariaLabel}>
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
              isAnimationActive={!prefersReducedMotion}
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
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th>Name</th>
            <th>Value</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry, i) => (
            <tr key={i}>
              <td>{entry.name}</td>
              <td>{entry.value}</td>
              <td>{total > 0 ? `${((entry.value / total) * 100).toFixed(1)}%` : "0%"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
