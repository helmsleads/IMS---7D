"use client";

import { useEffect, useState } from "react";
import { ShopifyEmbedBreakout } from "@/components/ShopifyEmbedBreakout";
import {
  SHOPIFY_PORTAL_CONNECT_PATH,
  breakOutToPortalLogin,
  shouldBreakOutOfShopifyEmbed,
} from "@/lib/shopify-embed";

/**
 * Optional Shopify Partner App URL target (not required — `/` works too).
 * Auto-break out only when embedded in Admin; top-level install stays put.
 */
export default function ShopifyAppEntryPage() {
  const [autoBreakOut, setAutoBreakOut] = useState(false);

  useEffect(() => {
    const embedded = shouldBreakOutOfShopifyEmbed();
    setAutoBreakOut(embedded);
    if (embedded) {
      breakOutToPortalLogin(SHOPIFY_PORTAL_CONNECT_PATH);
    }
  }, []);

  return (
    <ShopifyEmbedBreakout
      href={SHOPIFY_PORTAL_CONNECT_PATH}
      title="Connect Shopify in the 7D Portal"
      description="This screen opened from Shopify Admin. Sign-in and store connection must happen in a full browser tab — not inside Admin. If you just installed, confirm the app under Settings → Apps → Installed, then connect from Integrations."
      ctaLabel="Open Client Portal to connect"
      autoBreakOut={autoBreakOut}
    />
  );
}
