"use client";

import { SWRConfig } from "swr";
import { ReactNode } from "react";

interface SWRProviderProps {
  children: ReactNode;
}

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        // Revalidate on window focus
        revalidateOnFocus: true,
        // Revalidate when network reconnects
        revalidateOnReconnect: true,
        // Keep showing stale data while revalidating
        revalidateIfStale: true,
        // Dedupe requests within 2 seconds
        dedupingInterval: 2000,
        // Retry failed requests
        errorRetryCount: 3,
        errorRetryInterval: 1000,
        // Focus throttle to prevent too many revalidations
        focusThrottleInterval: 5000,
        // Show stale data immediately, then revalidate
        keepPreviousData: true,
        // Don't revalidate on mount if data is fresh (within 30s)
        revalidateOnMount: true,
        // Refresh interval (0 = disabled, can be overridden per-hook)
        refreshInterval: 0,
        // Custom fetcher (default for all useSWR calls)
        fetcher: async (url: string) => {
          const res = await fetch(url);
          if (!res.ok) {
            const error = new Error("An error occurred while fetching data.");
            throw error;
          }
          return res.json();
        },
        // Error handler
        onError: (error, key) => {
          if (process.env.NODE_ENV === "development") {
            console.error(`SWR Error [${key}]:`, error);
          }
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
