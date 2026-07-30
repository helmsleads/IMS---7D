"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

const inflightTokens = new Set<string>();

export default function CrossLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setError("Missing cross-login token.");
      return;
    }

    const storageKey = `7d_cross_login_${token}`;
    if (sessionStorage.getItem(storageKey) === "done") {
      router.replace("/portal/dashboard");
      return;
    }
    if (inflightTokens.has(token) || sessionStorage.getItem(storageKey) === "pending") {
      return;
    }

    inflightTokens.add(token);
    sessionStorage.setItem(storageKey, "pending");

    let cancelled = false;

    async function exchange() {
      try {
        const res = await fetch("/api/cross-login/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || `Cross-login failed (${res.status})`);
        }

        const data = await res.json();
        if (!data.token_hash) {
          throw new Error("No sign-in token returned");
        }

        const supabase = createClient();
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: data.token_hash,
          type: data.type || "magiclink",
        });

        if (otpError) {
          throw new Error(otpError.message);
        }

        sessionStorage.setItem(storageKey, "done");
        if (cancelled) return;

        // Password setup is via invite email only — cross-login always auto-enters
        router.replace(data.next || "/portal/dashboard");
      } catch (err) {
        sessionStorage.removeItem(storageKey);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Cross-login failed");
        }
      } finally {
        inflightTokens.delete(token!);
      }
    }

    exchange();
    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">Cross-Login Failed</h1>
          <p className="mt-3 text-sm text-red-600">{error}</p>
          <a
            href="/client-login"
            className="mt-4 inline-block text-sm font-medium text-cyan-600 hover:underline"
          >
            Go to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
        <p className="mt-4 text-sm text-gray-600">Signing you in to 7D...</p>
      </div>
    </div>
  );
}
