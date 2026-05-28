"use client";

import { useEffect, useState } from "react";
import {
  getPortalAccountManager,
  PortalAccountManager,
} from "@/lib/api/portal-messages";

export function usePortalAccountManager(clientId: string | undefined) {
  const [accountManager, setAccountManager] =
    useState<PortalAccountManager | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId || clientId === "staff-preview") {
      setAccountManager(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getPortalAccountManager(clientId)
      .then((manager) => {
        if (!cancelled) {
          setAccountManager(manager);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAccountManager(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return { accountManager, loading };
}

function ManagerAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center flex-shrink-0"
      aria-hidden
    >
      <span className="text-white font-semibold text-base">{initial}</span>
    </div>
  );
}

/** Account manager card — use on the portal Messages page only. */
export default function PortalAccountManagerInfo({
  clientId,
}: {
  clientId: string | undefined;
}) {
  const { accountManager, loading } = usePortalAccountManager(clientId);

  if (loading || !accountManager) {
    return null;
  }

  return (
    <div className="flex items-center gap-4 rounded-xl border border-cyan-100 bg-gradient-to-r from-cyan-50 to-white px-4 py-3">
      <ManagerAvatar name={accountManager.name} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-cyan-700">
          Your account manager
        </p>
        <p className="text-lg font-semibold text-slate-900 truncate">
          {accountManager.name}
        </p>
        <p className="text-sm text-slate-500 mt-0.5">
          Send messages here — no personal phone numbers needed.
        </p>
      </div>
    </div>
  );
}
