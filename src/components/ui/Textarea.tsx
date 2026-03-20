import { TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  variant?: "admin" | "portal";
}

export default function Textarea({
  label,
  name,
  error,
  hint,
  required,
  disabled,
  variant = "admin",
  className = "",
  rows = 3,
  ...props
}: TextareaProps) {
  const focusRing =
    variant === "portal"
      ? "focus-visible:ring-cyan-500"
      : "focus-visible:ring-indigo-500";

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={name}
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        id={name}
        name={name}
        disabled={disabled}
        rows={rows}
        className={`
          w-full px-3 py-2 border rounded-md transition-colors resize-vertical
          focus:outline-none focus-visible:ring-2 focus-visible:border-transparent
          disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed
          ${
            error
              ? "border-red-500 focus-visible:ring-red-500"
              : `border-slate-300 ${focusRing}`
          }
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      {hint && !error && (
        <p className="mt-1 text-sm text-slate-500">{hint}</p>
      )}
    </div>
  );
}
