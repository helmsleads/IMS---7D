interface SpinnerProps {
  size?: "sm" | "md" | "lg";
}

const sizeStyles = {
  sm: "h-4 w-4",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

export default function Spinner({ size = "md" }: SpinnerProps) {
  return (
    <div
      className={`
        animate-spin rounded-full border-2 border-gray-200 border-t-blue-600
        ${sizeStyles[size]}
      `}
    />
  );
}
