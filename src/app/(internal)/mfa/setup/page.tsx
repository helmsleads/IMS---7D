"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

interface TotpEnrollment {
  factorId: string;
  qrCode: string | null;
  secret: string | null;
  uri: string | null;
}

export default function MfaSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const redirectTo = useMemo(
    () => searchParams.get("redirect") || "/dashboard",
    [searchParams]
  );

  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);

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

      const hasVerifiedTotp = (factorData?.totp ?? []).some(
        (factor) => factor.status === "verified"
      );
      if (aalData?.currentLevel === "aal2") {
        router.replace(redirectTo);
        return;
      }

      if (hasVerifiedTotp) {
        router.replace(`/mfa/verify?redirect=${encodeURIComponent(redirectTo)}`);
        return;
      }

      setLoading(false);
    };

    void initialize();
  }, [redirectTo, router, supabase]);

  const startEnrollment = async () => {
    setEnrolling(true);
    setError("");
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Internal Login",
      });

      if (enrollError || !data) {
        setError(enrollError?.message || "Unable to start MFA enrollment.");
        return;
      }

      setEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code ?? null,
        secret: data.totp.secret ?? null,
        uri: data.totp.uri ?? null,
      });
    } finally {
      setEnrolling(false);
    }
  };

  const verifyEnrollment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!enrollment) {
      return;
    }

    setVerifying(true);
    setError("");
    try {
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({
          factorId: enrollment.factorId,
        });

      if (challengeError || !challengeData) {
        setError(challengeError?.message || "Unable to challenge MFA factor.");
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollment.factorId,
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
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Set Up Authenticator App</h1>
        <p className="mt-2 text-sm text-slate-600">
          Internal access requires TOTP MFA. Scan the QR code and verify with your 6-digit code.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {!enrollment ? (
          <Button className="mt-6 w-full" loading={enrolling} onClick={startEnrollment}>
            Generate MFA QR Code
          </Button>
        ) : (
          <div className="mt-6 space-y-5">
            {enrollment.qrCode ? (
              <div
                className="flex justify-center rounded-lg border border-slate-200 bg-white p-4"
                dangerouslySetInnerHTML={{ __html: enrollment.qrCode }}
              />
            ) : null}

            {enrollment.secret && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                Secret key: <span className="font-mono">{enrollment.secret}</span>
              </div>
            )}

            {enrollment.uri && (
              <p className="text-xs text-slate-500 break-all">
                If QR scanning is unavailable, use this URI: {enrollment.uri}
              </p>
            )}

            <form onSubmit={verifyEnrollment} className="space-y-4">
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
              <Button className="w-full" type="submit" loading={verifying}>
                Verify and continue
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
