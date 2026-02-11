import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow ngrok for local development with Shopify webhooks
  allowedDevOrigins: [
    "teri-daydreamy-brandon.ngrok-free.dev",
    "*.ngrok-free.dev",
  ],
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
