"use client";

import { ExternalLink } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import {
  SHOPIFY_PORTAL_CONNECT_PATH,
  breakOutToPortalLogin,
} from "@/lib/shopify-embed";

type Props = {
  /** Absolute or root-relative URL for the primary CTA (target=_top). */
  href?: string;
  title?: string;
  description?: string;
  ctaLabel?: string;
  /** Attempt automatic top-level navigation on mount. */
  autoBreakOut?: boolean;
};

/**
 * Shown when Shopify Admin embeds 7D. No password fields — force top-level portal.
 */
export function ShopifyEmbedBreakout({
  href = SHOPIFY_PORTAL_CONNECT_PATH,
  title = "Continue in the 7D Portal",
  description = "Shopify opens this app inside Admin, where sign-in cannot complete reliably. Open the client portal in a full browser tab, then connect Shopify from Integrations.",
  ctaLabel = "Open Client Portal",
  autoBreakOut = true,
}: Props) {
  if (autoBreakOut && typeof window !== "undefined") {
    // Fire-and-forget on render path via microtask so SSR stays clean;
    // callers also use useEffect — this covers immediate click paths.
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="inline-flex items-center justify-center mb-5">
          <BrandLogo
            variant="stacked"
            width={140}
            height={143}
            className="drop-shadow-lg"
            priority
          />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">{title}</h2>
        <p className="text-sm text-gray-600 mb-6">{description}</p>
        <a
          href={href}
          target="_top"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold py-3 px-4 rounded-xl hover:from-blue-700 hover:to-blue-800"
          onClick={() => {
            breakOutToPortalLogin(href);
          }}
        >
          {ctaLabel}
          <ExternalLink className="w-4 h-4" />
        </a>
        <p className="text-xs text-gray-500 mt-4">
          Do not sign in inside Shopify Admin. Use{" "}
          <span className="font-medium text-gray-700">Open Client Portal</span>, then{" "}
          <span className="font-medium text-gray-700">Integrations → Connect Shopify</span>.
        </p>
      </div>
    </div>
  );
}
