"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";

const VALID_OTP_TYPES = new Set([
  "invite",
  "recovery",
  "signup",
  "magiclink",
  "email",
]);

function parseAuthTokenFromUrl(): {
  tokenHash: string | null;
  type: string | null;
} {
  if (typeof window === "undefined") {
    return { tokenHash: null, type: null };
  }

  const hashRaw = window.location.hash.replace(/^#/, "");
  const hashParams = new URLSearchParams(hashRaw);
  const searchParams = new URLSearchParams(window.location.search);

  return {
    tokenHash:
      hashParams.get("token_hash") || searchParams.get("token_hash"),
    type: hashParams.get("type") || searchParams.get("type"),
  };
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="relative bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border-t-4 border-t-teal-600 text-center">
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-600/20">
            <span className="text-white font-bold text-xl">7D</span>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function AcceptInviteContent() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [message] = useState("Opening your invitation...");

  useEffect(() => {
    let active = true;

    const run = async () => {
      const { tokenHash, type } = parseAuthTokenFromUrl();

      if (!tokenHash || !type || !VALID_OTP_TYPES.has(type)) {
        router.replace("/reset-password?error=invalid_link");
        return;
      }

      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as EmailOtpType,
      });

      if (!active) return;

      if (error) {
        console.error("accept-invite verifyOtp failed:", error.message);
        const reason = encodeURIComponent(error.message);
        const isExpired =
          error.message.toLowerCase().includes("expired") ||
          error.message.toLowerCase().includes("invalid");
        router.replace(
          `/reset-password?error=${isExpired ? "otp_expired" : "auth_callback"}&reason=${reason}`
        );
        return;
      }

      const setup =
        type === "invite" ? "invite" : type === "recovery" ? "recovery" : "invite";
      router.replace(`/reset-password?setup=${setup}`);
    };

    void run();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  return (
    <AuthShell>
      <div className="inline-block w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mb-4" />
      <p className="text-gray-600 font-medium">{message}</p>
      <p className="text-sm text-gray-400 mt-1">This only takes a moment</p>
    </AuthShell>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <AuthShell>
          <div className="inline-block w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mb-4" />
          <p className="text-gray-600 font-medium">Loading...</p>
        </AuthShell>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
