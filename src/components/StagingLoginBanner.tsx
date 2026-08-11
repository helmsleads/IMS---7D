"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  PRODUCTION_APP_ORIGIN,
  shouldShowStagingLoginBanner,
} from "@/lib/app-env";

/**
 * Shown on login pages when this deploy is not production.
 * Many users still bookmark the old (now staging) URL.
 */
export function StagingLoginBanner() {
  const [show, setShow] = useState(() => shouldShowStagingLoginBanner());

  useEffect(() => {
    setShow(shouldShowStagingLoginBanner(window.location.hostname));
  }, []);

  if (!show) return null;

  return (
    <div
      role="status"
      className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-left"
    >
      <p className="text-sm font-semibold text-amber-900">
        Staging server — for development only
      </p>
      <p className="mt-1 text-sm text-amber-800">
        Production is at{" "}
        <a
          href={PRODUCTION_APP_ORIGIN}
          className="font-medium underline underline-offset-2 hover:text-amber-950"
        >
          app.7degreesco.com
        </a>
        .
      </p>
      <a
        href={PRODUCTION_APP_ORIGIN}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
      >
        Go to production
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
