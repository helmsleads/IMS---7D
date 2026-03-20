import Badge from "./Badge";
import { getStatusColor, type EntityType } from "@/lib/utils/status";
import { formatStatus } from "@/lib/utils/formatting";

interface StatusBadgeProps {
  status: string;
  entityType: EntityType;
  size?: "sm" | "md";
  className?: string;
}

type BadgeVariant = "default" | "success" | "warning" | "error" | "info";

/**
 * Maps a Tailwind bg class (from getStatusColor) to a semantic Badge variant.
 * This is the canonical mapping for the design system's status colors.
 */
const bgToVariant: Record<string, BadgeVariant> = {
  "bg-green-100": "success",
  "bg-yellow-100": "warning",
  "bg-red-100": "error",
  "bg-blue-100": "info",
  "bg-slate-100": "default",
  // Unmapped bg values (e.g., defaultColors from status.ts) fall through to ?? "default"
  "bg-purple-100": "warning",
  "bg-indigo-100": "info",
  "bg-cyan-100": "info",
  "bg-orange-100": "warning",
  "bg-teal-100": "info",
  "bg-pink-100": "error",
};

export default function StatusBadge({
  status,
  entityType,
  size = "sm",
  className = "",
}: StatusBadgeProps) {
  const colors = getStatusColor(status, entityType);
  const variant: BadgeVariant = bgToVariant[colors.bg] ?? "default";

  return (
    <Badge variant={variant} size={size} className={`${colors.bg} ${colors.text} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} mr-1.5`} />
      {formatStatus(status)}
    </Badge>
  );
}
