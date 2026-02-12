import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
  accent?: "indigo" | "amber" | "red" | "green" | "cyan";
}

const paddingStyles = {
  none: "p-0",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

const accentColors = {
  indigo: "border-l-[3px] border-l-indigo-500",
  amber: "border-l-[3px] border-l-amber-500",
  red: "border-l-[3px] border-l-red-500",
  green: "border-l-[3px] border-l-green-500",
  cyan: "border-l-[3px] border-l-cyan-500",
};

export default function Card({
  children,
  title,
  subtitle,
  actions,
  padding = "md",
  className = "",
  onClick,
  accent,
}: CardProps) {
  const hasHeader = title || subtitle || actions;

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden transition-all duration-200 ${accent ? accentColors[accent] : ""} ${className} ${onClick ? "cursor-pointer hover:shadow-md hover:border-slate-300" : ""}`}
      onClick={onClick}
    >
      {hasHeader && (
        <div className="flex items-start justify-between px-6 pt-6 pb-0">
          <div>
            {title && (
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            )}
            {subtitle && (
              <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
            )}
          </div>
          {actions && <div className="ml-4">{actions}</div>}
        </div>
      )}
      <div className={paddingStyles[padding]}>{children}</div>
    </div>
  );
}
