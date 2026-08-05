import Image from "next/image";

const LOGO_SRC = {
  icon: "/brand/7d-logo-icon-transparent.png",
  horizontal: "/brand/7d-logo-horizontal-transparent.png",
  stacked: "/brand/7d-logo-stacked-transparent.png",
  vertical: "/brand/7d-logo-vertical-transparent.png",
} as const;

type LogoVariant = keyof typeof LOGO_SRC;

interface BrandLogoProps {
  variant?: LogoVariant;
  className?: string;
  alt?: string;
  /** Intrinsic width hint for next/image (horizontal default). */
  width?: number;
  height?: number;
  priority?: boolean;
}

const DEFAULT_SIZE: Record<LogoVariant, { width: number; height: number }> = {
  icon: { width: 40, height: 29 },
  horizontal: { width: 180, height: 35 },
  stacked: { width: 120, height: 123 },
  vertical: { width: 120, height: 77 },
};

export function BrandLogo({
  variant = "horizontal",
  className = "",
  alt = "Seven Degrees",
  width,
  height,
  priority = false,
}: BrandLogoProps) {
  const src = LOGO_SRC[variant];
  const size = DEFAULT_SIZE[variant];
  return (
    <Image
      src={src}
      alt={alt}
      width={width ?? size.width}
      height={height ?? size.height}
      className={["object-contain", className].filter(Boolean).join(" ")}
      priority={priority}
    />
  );
}
