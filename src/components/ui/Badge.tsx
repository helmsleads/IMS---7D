import { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info";
  size?: "sm" | "md";
  className?: string;
}

const variantStyles = {
  default: "bg-slate-100 text-slate-800 border border-slate-200",
  success: "bg-green-50 text-green-800 border border-green-200",
  warning: "bg-amber-50 text-amber-800 border border-amber-200",
  error: "bg-red-50 text-red-800 border border-red-200",
  info: "bg-indigo-50 text-indigo-800 border border-indigo-200",
};

const sizeStyles = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
};

export default function Badge({
  children,
  variant = "default",
  size = "sm",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
