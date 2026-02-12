"use client";

import { ReactNode } from "react";
import { useAnimatedNumber } from "@/lib/hooks/useAnimatedNumber";
import MiniSparkline from "@/components/ui/charts/MiniSparkline";

interface StatCardProps {
  icon: ReactNode;
  iconColor?: string;
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  loading?: boolean;
  sparklineData?: { value: number }[];
  sparklineColor?: string;
}

function SkeletonStatCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-slate-100 animate-pulse" />
        <div className="flex-1">
          <div className="h-3 w-20 bg-slate-100 rounded animate-pulse mb-2" />
          <div className="h-7 w-24 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function AnimatedValue({ value }: { value: string | number }) {
  const numericValue = typeof value === "number" ? value : null;
  const animated = useAnimatedNumber(numericValue ?? 0);

  if (numericValue !== null) {
    return <>{animated.toLocaleString()}</>;
  }

  // For string values like "$12,345" — try to animate the numeric part
  const match = typeof value === "string" ? value.match(/^([^0-9]*)([0-9][0-9,]*)(.*)$/) : null;
  if (match) {
    const [, prefix, numStr, suffix] = match;
    const num = parseInt(numStr.replace(/,/g, ""), 10);
    return <AnimatedStringValue prefix={prefix} target={num} suffix={suffix} />;
  }

  return <>{value}</>;
}

function AnimatedStringValue({ prefix, target, suffix }: { prefix: string; target: number; suffix: string }) {
  const animated = useAnimatedNumber(target);
  return <>{prefix}{animated.toLocaleString()}{suffix}</>;
}

export default function StatCard({
  icon,
  iconColor = "bg-blue-50 text-blue-600",
  label,
  value,
  change,
  changeLabel,
  loading = false,
  sparklineData,
  sparklineColor,
}: StatCardProps) {
  if (loading) return <SkeletonStatCard />;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 transition-all duration-200 hover:shadow-md hover:border-slate-300">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl ring-1 ring-current/10 flex items-center justify-center ${iconColor}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-500 truncate">{label}</p>
          <p className="text-2xl font-bold text-slate-900 tracking-tight">
            <AnimatedValue value={value} />
          </p>
        </div>
        {change !== undefined && (
          <div className="text-right">
            <span
              className={`inline-flex items-center text-sm font-medium ${
                change >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {change >= 0 ? "+" : ""}
              {change}%
            </span>
            {changeLabel && (
              <p className="text-xs text-slate-400 mt-0.5">{changeLabel}</p>
            )}
          </div>
        )}
      </div>
      {sparklineData && sparklineData.length >= 2 && (
        <div className="mt-3 -mx-1">
          <MiniSparkline data={sparklineData} color={sparklineColor} height={32} />
        </div>
      )}
    </div>
  );
}
