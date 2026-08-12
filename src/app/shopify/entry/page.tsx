"use client";

import { useEffect } from "react";
import { ShopifyEmbedBreakout } from "@/components/ShopifyEmbedBreakout";
import {
  SHOPIFY_PORTAL_CONNECT_PATH,
  breakOutToPortalLogin,
} from "@/lib/shopify-embed";

/**
 * Shopify Partner App URL should point here (not `/`).
 * Never shows a password form — only a top-level portal breakout.
 */
export default function ShopifyAppEntryPage() {
  useEffect(() => {
    breakOutToPortalLogin(SHOPIFY_PORTAL_CONNECT_PATH);
  }, []);

  return (
    <ShopifyEmbedBreakout
      href={SHOPIFY_PORTAL_CONNECT_PATH}
      title="Connect Shopify in the 7D Portal"
      description="This screen opened from Shopify Admin. Sign-in and store connection must happen in a full browser tab — not inside Admin."
      ctaLabel="Open Client Portal to connect"
      autoBreakOut={false}
    />
  );
}
