interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
}

const sizeStyles = {
  sm: "h-4 w-4",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

export default function Spinner({ size = "md", label = "Loading" }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={`
        motion-safe:animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600
        ${sizeStyles[size]}
      `}
    />
  );
}
