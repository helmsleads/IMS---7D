"use client";

import { useState } from "react";
import Image from "next/image";
import { Package } from "lucide-react";

type ImageSize = "xs" | "sm" | "md" | "lg" | "xl" | "full";

interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  size?: ImageSize;
  className?: string;
  priority?: boolean;
}

// Size configurations
const sizeConfig: Record<ImageSize, { width: number; height: number; iconSize: string }> = {
  xs: { width: 32, height: 32, iconSize: "w-4 h-4" },
  sm: { width: 40, height: 40, iconSize: "w-5 h-5" },
  md: { width: 64, height: 64, iconSize: "w-8 h-8" },
  lg: { width: 96, height: 96, iconSize: "w-10 h-10" },
  xl: { width: 128, height: 128, iconSize: "w-12 h-12" },
  full: { width: 400, height: 400, iconSize: "w-24 h-24" },
};

// Base64 blur placeholder - a subtle gray shimmer
const shimmerBlur = `data:image/svg+xml;base64,${Buffer.from(
  `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shimmer" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#f3f4f6">
          <animate attributeName="offset" values="-2; 1" dur="2s" repeatCount="indefinite"/>
        </stop>
        <stop offset="50%" style="stop-color:#e5e7eb">
          <animate attributeName="offset" values="-1; 2" dur="2s" repeatCount="indefinite"/>
        </stop>
        <stop offset="100%" style="stop-color:#f3f4f6">
          <animate attributeName="offset" values="0; 3" dur="2s" repeatCount="indefinite"/>
        </stop>
      </linearGradient>
    </defs>
    <rect width="400" height="400" fill="url(#shimmer)"/>
  </svg>`
).toString("base64")}`;

// Simple gray placeholder for blur effect
const blurDataURL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwEPwAB/D//Z";

export default function ProductImage({
  src,
  alt,
  size = "md",
  className = "",
  priority = false,
}: ProductImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const config = sizeConfig[size];

  // If no source or error loading, show fallback
  if (!src || hasError) {
    return (
      <div
        className={`
          flex items-center justify-center bg-gray-100 rounded-lg
          ${size === "full" ? "w-full aspect-square" : ""}
          ${className}
        `}
        style={size !== "full" ? { width: config.width, height: config.height } : undefined}
      >
        <Package className={`${config.iconSize} text-gray-300`} />
      </div>
    );
  }

  // For full size images, use fill layout
  if (size === "full") {
    return (
      <div className={`relative w-full aspect-square overflow-hidden rounded-lg bg-gray-100 ${className}`}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
          className={`
            object-cover transition-opacity duration-300
            ${isLoading ? "opacity-0" : "opacity-100"}
          `}
          placeholder="blur"
          blurDataURL={blurDataURL}
          priority={priority}
          onLoad={() => setIsLoading(false)}
          onError={() => setHasError(true)}
        />
        {isLoading && (
          <div className="absolute inset-0 bg-gray-200 animate-pulse" />
        )}
      </div>
    );
  }

  // For fixed size images
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-gray-100 flex-shrink-0 ${className}`}
      style={{ width: config.width, height: config.height }}
    >
      <Image
        src={src}
        alt={alt}
        width={config.width}
        height={config.height}
        className={`
          object-cover w-full h-full transition-opacity duration-300
          ${isLoading ? "opacity-0" : "opacity-100"}
        `}
        placeholder="blur"
        blurDataURL={blurDataURL}
        priority={priority}
        onLoad={() => setIsLoading(false)}
        onError={() => setHasError(true)}
      />
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
    </div>
  );
}

/**
 * ProductImage for use in cards/grids with aspect ratio container
 */
interface ProductImageCardProps {
  src: string | null | undefined;
  alt: string;
  aspectRatio?: "square" | "4:3" | "3:2";
  className?: string;
  priority?: boolean;
}

export function ProductImageCard({
  src,
  alt,
  aspectRatio = "square",
  className = "",
  priority = false,
}: ProductImageCardProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const aspectClasses = {
    square: "aspect-square",
    "4:3": "aspect-[4/3]",
    "3:2": "aspect-[3/2]",
  };

  if (!src || hasError) {
    return (
      <div
        className={`
          relative w-full ${aspectClasses[aspectRatio]} bg-gray-100
          flex items-center justify-center ${className}
        `}
      >
        <Package className="w-16 h-16 text-gray-300" />
      </div>
    );
  }

  return (
    <div className={`relative w-full ${aspectClasses[aspectRatio]} overflow-hidden bg-gray-100 ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        className={`
          object-cover transition-opacity duration-300
          ${isLoading ? "opacity-0" : "opacity-100"}
        `}
        placeholder="blur"
        blurDataURL={blurDataURL}
        priority={priority}
        onLoad={() => setIsLoading(false)}
        onError={() => setHasError(true)}
      />
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
    </div>
  );
}

/**
 * Thumbnail variant for tables and lists
 */
interface ProductThumbnailProps {
  src: string | null | undefined;
  alt: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ProductThumbnail({
  src,
  alt,
  size = "md",
  className = "",
}: ProductThumbnailProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const sizeClasses = {
    sm: { container: "w-8 h-8", icon: "w-4 h-4" },
    md: { container: "w-10 h-10", icon: "w-5 h-5" },
    lg: { container: "w-12 h-12", icon: "w-6 h-6" },
  };

  const config = sizeClasses[size];

  if (!src || hasError) {
    return (
      <div
        className={`
          ${config.container} rounded-lg bg-gray-100
          flex items-center justify-center flex-shrink-0 ${className}
        `}
      >
        <Package className={`${config.icon} text-gray-400`} />
      </div>
    );
  }

  return (
    <div className={`${config.container} relative rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="48px"
        className={`
          object-cover transition-opacity duration-200
          ${isLoading ? "opacity-0" : "opacity-100"}
        `}
        onLoad={() => setIsLoading(false)}
        onError={() => setHasError(true)}
      />
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
    </div>
  );
}
