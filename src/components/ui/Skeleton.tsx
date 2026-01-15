import { ReactNode } from "react";

interface SkeletonProps {
  className?: string;
}

/**
 * Base skeleton with shimmer animation
 */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${className}`}
      aria-hidden="true"
    />
  );
}

/**
 * Text line skeleton
 */
interface SkeletonTextProps {
  lines?: number;
  className?: string;
  /** Width of last line (e.g., "75%", "w-3/4") */
  lastLineWidth?: string;
}

export function SkeletonText({
  lines = 1,
  className = "",
  lastLineWidth = "75%",
}: SkeletonTextProps) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-gray-200 rounded animate-pulse"
          style={{
            width: i === lines - 1 && lines > 1 ? lastLineWidth : "100%",
          }}
        />
      ))}
    </div>
  );
}

/**
 * Avatar/circle skeleton
 */
interface SkeletonAvatarProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function SkeletonAvatar({ size = "md", className = "" }: SkeletonAvatarProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
    xl: "w-16 h-16",
  };

  return (
    <div
      className={`rounded-full bg-gray-200 animate-pulse ${sizeClasses[size]} ${className}`}
      aria-hidden="true"
    />
  );
}

/**
 * Card skeleton with optional header, body, and footer
 */
interface SkeletonCardProps {
  hasHeader?: boolean;
  hasFooter?: boolean;
  bodyLines?: number;
  className?: string;
}

export function SkeletonCard({
  hasHeader = true,
  hasFooter = false,
  bodyLines = 3,
  className = "",
}: SkeletonCardProps) {
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {hasHeader && (
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <SkeletonAvatar size="md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        </div>
      )}

      <div className="p-4">
        <SkeletonText lines={bodyLines} />
      </div>

      {hasFooter && (
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Table row skeleton
 */
interface SkeletonTableRowProps {
  columns: number;
  className?: string;
}

export function SkeletonTableRow({ columns, className = "" }: SkeletonTableRowProps) {
  return (
    <tr className={`border-b border-gray-100 ${className}`} aria-hidden="true">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

/**
 * Full table skeleton with header and rows
 */
interface SkeletonTableProps {
  columns: number;
  rows?: number;
  hasHeader?: boolean;
  className?: string;
}

export function SkeletonTable({
  columns,
  rows = 5,
  hasHeader = true,
  className = "",
}: SkeletonTableProps) {
  return (
    <div className={`overflow-x-auto ${className}`} aria-hidden="true">
      <table className="w-full">
        {hasHeader && (
          <thead>
            <tr className="border-b border-gray-200">
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-4 py-3 text-left">
                  <Skeleton className="h-4 w-20" />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * List item skeleton
 */
interface SkeletonListItemProps {
  hasAvatar?: boolean;
  hasAction?: boolean;
  className?: string;
}

export function SkeletonListItem({
  hasAvatar = true,
  hasAction = false,
  className = "",
}: SkeletonListItemProps) {
  return (
    <div
      className={`flex items-center gap-3 p-4 ${className}`}
      aria-hidden="true"
    >
      {hasAvatar && <SkeletonAvatar size="md" />}
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      {hasAction && <Skeleton className="h-8 w-8 rounded-md" />}
    </div>
  );
}

/**
 * List skeleton
 */
interface SkeletonListProps {
  items?: number;
  hasAvatar?: boolean;
  hasAction?: boolean;
  divided?: boolean;
  className?: string;
}

export function SkeletonList({
  items = 5,
  hasAvatar = true,
  hasAction = false,
  divided = true,
  className = "",
}: SkeletonListProps) {
  return (
    <div
      className={`${divided ? "divide-y divide-gray-100" : "space-y-2"} ${className}`}
      aria-hidden="true"
    >
      {Array.from({ length: items }).map((_, i) => (
        <SkeletonListItem key={i} hasAvatar={hasAvatar} hasAction={hasAction} />
      ))}
    </div>
  );
}

/**
 * Stats card skeleton (like dashboard stats)
 */
interface SkeletonStatCardProps {
  className?: string;
}

export function SkeletonStatCard({ className = "" }: SkeletonStatCardProps) {
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}
      aria-hidden="true"
    >
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
    </div>
  );
}

/**
 * Form field skeleton
 */
interface SkeletonFormFieldProps {
  hasLabel?: boolean;
  className?: string;
}

export function SkeletonFormField({
  hasLabel = true,
  className = "",
}: SkeletonFormFieldProps) {
  return (
    <div className={`space-y-1.5 ${className}`} aria-hidden="true">
      {hasLabel && <Skeleton className="h-4 w-24" />}
      <Skeleton className="h-10 w-full rounded-md" />
    </div>
  );
}

/**
 * Button skeleton
 */
interface SkeletonButtonProps {
  size?: "sm" | "md" | "lg";
  width?: string;
  className?: string;
}

export function SkeletonButton({
  size = "md",
  width = "w-24",
  className = "",
}: SkeletonButtonProps) {
  const sizeClasses = {
    sm: "h-8",
    md: "h-10",
    lg: "h-12",
  };

  return (
    <Skeleton
      className={`${sizeClasses[size]} ${width} rounded-md ${className}`}
    />
  );
}

/**
 * Page header skeleton
 */
interface SkeletonPageHeaderProps {
  hasSubtitle?: boolean;
  hasAction?: boolean;
  className?: string;
}

export function SkeletonPageHeader({
  hasSubtitle = true,
  hasAction = true,
  className = "",
}: SkeletonPageHeaderProps) {
  return (
    <div
      className={`flex items-center justify-between ${className}`}
      aria-hidden="true"
    >
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        {hasSubtitle && <Skeleton className="h-4 w-64" />}
      </div>
      {hasAction && <SkeletonButton size="md" width="w-32" />}
    </div>
  );
}

/**
 * Image/thumbnail skeleton
 */
interface SkeletonImageProps {
  aspectRatio?: "square" | "video" | "wide";
  className?: string;
}

export function SkeletonImage({
  aspectRatio = "square",
  className = "",
}: SkeletonImageProps) {
  const aspectClasses = {
    square: "aspect-square",
    video: "aspect-video",
    wide: "aspect-[2/1]",
  };

  return (
    <Skeleton
      className={`w-full ${aspectClasses[aspectRatio]} rounded-lg ${className}`}
    />
  );
}

/**
 * Badge skeleton
 */
export function SkeletonBadge({ className = "" }: SkeletonProps) {
  return <Skeleton className={`h-5 w-16 rounded-full ${className}`} />;
}

/**
 * Wrapper to show skeleton while loading
 */
interface SkeletonWrapperProps {
  loading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
}

export function SkeletonWrapper({
  loading,
  skeleton,
  children,
}: SkeletonWrapperProps) {
  if (loading) {
    return <>{skeleton}</>;
  }
  return <>{children}</>;
}
