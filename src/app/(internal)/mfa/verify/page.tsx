"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function MfaVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const redirectTo = useMemo(
    () => searchParams.get("redirect") || "/dashboard",
    [searchParams]
  );

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace(`/login?redirect=${encodeURIComponent(redirectTo)}`);
        return;
      }

      const { data: staffUser, error: staffError } = await supabase
        .from("users")
        .select("id, active")
        .eq("id", user.id)
        .eq("active", true)
        .single();

      if (staffError || !staffUser) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      const [{ data: factorData }, { data: aalData }] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);

      if (aalData?.currentLevel === "aal2") {
        router.replace(redirectTo);
        return;
      }

      const verifiedFactor = (factorData?.totp ?? []).find(
        (factor) => factor.status === "verified"
      );

      if (!verifiedFactor) {
        router.replace(`/mfa/setup?redirect=${encodeURIComponent(redirectTo)}`);
        return;
      }

      setFactorId(verifiedFactor.id);
      setLoading(false);
    };

    void initialize();
  }, [redirectTo, router, supabase]);

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!factorId) {
      return;
    }

    setVerifying(true);
    setError("");
    try {
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({
          factorId,
        });
      if (challengeError || !challengeData) {
        setError(challengeError?.message || "Unable to create MFA challenge.");
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) {
        setError(verifyError.message || "Invalid verification code.");
        return;
      }

      router.replace(redirectTo);
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Verify Authenticator Code</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter the 6-digit code from your authenticator app to continue.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleVerify} className="mt-6 space-y-4">
          <Input
            label="Authenticator code"
            name="totp"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
          />
          <Button type="submit" className="w-full" loading={verifying}>
            Verify and continue
          </Button>
        </form>
      </div>
    </div>
  );
}
