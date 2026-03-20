"use client";

import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface MiniSparklineProps {
  data: { value: number }[];
  color?: string;
  height?: number;
  ariaLabel?: string;
}

export default function MiniSparkline({
  data,
  color = "#4F46E5",
  height = 40,
  ariaLabel = "Sparkline chart",
}: MiniSparklineProps) {
  const prefersReducedMotion = useReducedMotion();

  if (!data || data.length < 2) return null;

  const min = Math.min(...data.map((d) => d.value));
  const max = Math.max(...data.map((d) => d.value));

  return (
    <div role="img" aria-label={ariaLabel}>
      <div className="animate-chart-enter" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <defs>
              <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#spark-${color.replace("#", "")})`}
              isAnimationActive={!prefersReducedMotion}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="sr-only">
        {ariaLabel}: {data.length} data points, min {min}, max {max}
      </p>
    </div>
  );
}
