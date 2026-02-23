import Badge from "./Badge";
import { getStatusColor, type EntityType } from "@/lib/utils/status";
import { formatStatus } from "@/lib/utils/formatting";

interface StatusBadgeProps {
  status: string;
  entityType: EntityType;
  size?: "sm" | "md";
  className?: string;
}

const variantMap: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  "bg-green-100": "success",
  "bg-yellow-100": "warning",
  "bg-red-100": "error",
  "bg-blue-100": "info",
  "bg-gray-100": "default",
};

export default function StatusBadge({
  status,
  entityType,
  size = "sm",
  className = "",
}: StatusBadgeProps) {
  const colors = getStatusColor(status, entityType);
  const variant = variantMap[colors.bg] ?? "default";

  return (
    <Badge variant={variant} size={size} className={`${colors.bg} ${colors.text} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} mr-1.5`} />
      {formatStatus(status)}
    </Badge>
  );
}
