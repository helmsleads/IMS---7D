import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow ngrok for local development with Shopify webhooks
  allowedDevOrigins: [
    "teri-daydreamy-brandon.ngrok-free.dev",
    "*.ngrok-free.dev",
  ],
  // The Resend SDK declares `@react-email/render` as an (optional) peer
  // dependency, used only when sending React-component emails. We only send
  // pre-rendered HTML strings, so the import is unreachable at runtime — but
  // webpack still tries to resolve it during static analysis and warns.
  // Aliasing it to `false` tells webpack to treat it as an empty module.
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@react-email/render": false,
    };
    return config;
  },
  // Same alias for Turbopack so `npm run build:turbo` stays warning-free.
  turbopack: {
    resolveAlias: {
      "@react-email/render": { browser: "next/dist/compiled/noop-loader" },
    },
  },
  images: {
    // Allow images from these remote sources
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "**.supabase.in",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: "https",
        hostname: "via.placeholder.com",
      },
    ],
    // Enable blur placeholder generation
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};

export default nextConfig;
