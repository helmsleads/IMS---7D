import { Loader2 } from "lucide-react";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
  size?: "sm" | "md";
  variant?: "admin" | "portal";
  className?: string;
}

export default function Toggle({
  checked,
  onChange,
  disabled = false,
  loading = false,
  size = "md",
  variant = "admin",
  className = "",
}: ToggleProps) {
  const trackSize = size === "sm" ? "h-5 w-9" : "h-6 w-11";
  const thumbSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const thumbTranslate = size === "sm"
    ? (checked ? "translate-x-4" : "translate-x-0.5")
    : (checked ? "translate-x-6" : "translate-x-1");

  const checkedColor = variant === "portal" ? "bg-cyan-600" : "bg-indigo-600";
  const focusRing =
    variant === "portal"
      ? "focus-visible:ring-cyan-500"
      : "focus-visible:ring-indigo-500";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && !loading && onChange(!checked)}
      disabled={disabled || loading}
      className={`
        relative inline-flex items-center rounded-full transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${focusRing}
        ${trackSize}
        ${checked ? checkedColor : "bg-slate-200"}
        ${className}
      `}
    >
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className={`animate-spin text-white ${size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"}`} />
        </span>
      ) : (
        <span
          className={`
            inline-block rounded-full bg-white shadow transition-transform
            ${thumbSize} ${thumbTranslate}
          `}
        />
      )}
    </button>
  );
}
