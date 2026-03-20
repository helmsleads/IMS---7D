import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  variant?: "admin" | "portal";
}

export default function Input({
  label,
  name,
  type = "text",
  error,
  hint,
  required,
  disabled,
  variant = "admin",
  className = "",
  ...props
}: InputProps) {
  const focusRing =
    variant === "portal"
      ? "focus-visible:ring-cyan-500 focus-visible:border-cyan-500"
      : "focus-visible:ring-indigo-500 focus-visible:border-indigo-500";

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
      <input
        id={name}
        name={name}
        type={type}
        disabled={disabled}
        className={`
          w-full px-3 py-2 border rounded-md transition-colors
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
