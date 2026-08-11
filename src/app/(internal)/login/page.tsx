"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { usePasswordSetupRedirect } from "@/hooks/use-password-setup-redirect";
import { BrandLogo } from "@/components/BrandLogo";
import { StagingLoginBanner } from "@/components/StagingLoginBanner";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  usePasswordSetupRedirect();
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const normalizedEmail = email.trim().toLowerCase();

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      // Prefer staff/admin when present
      const { data: staffUser } = await supabase
        .from("users")
        .select("id, active")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (staffUser?.active) {
        router.push(redirectTo);
        return;
      }

      if (staffUser && !staffUser.active) {
        await supabase.auth.signOut();
        setError(
          "Your account has been deactivated. Please contact an administrator."
        );
        return;
      }

      // Not staff — fall through to client portal users
      const { data: clientUserAccess } = await supabase
        .from("client_users")
        .select("id")
        .eq("user_id", authData.user.id)
        .limit(1);

      if (clientUserAccess && clientUserAccess.length > 0) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("password_set_at")
          .eq("id", authData.user.id)
          .maybeSingle();

        if (profile && !profile.password_set_at) {
          await supabase
            .from("user_profiles")
            .update({ password_set_at: new Date().toISOString() })
            .eq("id", authData.user.id);
        }

        router.push("/portal/dashboard");
        return;
      }

      const { data: legacyClient } = await supabase
        .from("clients")
        .select("id")
        .eq("auth_id", authData.user.id)
        .maybeSingle();

      if (legacyClient) {
        router.push("/portal/dashboard");
        return;
      }

      await supabase.auth.signOut();
      setError(
        "Access denied. No staff or portal access found for this account. Please contact support."
      );
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      <div className="bg-white p-8 rounded-xl shadow-2xl shadow-black/20 w-full max-w-md">
        <div className="flex justify-center mb-5">
          <BrandLogo
            variant="stacked"
            width={140}
            height={143}
            className="h-28 w-auto"
            priority
          />
        </div>
        <p className="text-center text-slate-500 text-sm font-medium tracking-wide uppercase">
          Team Login
        </p>
        <div className="mt-4">
          <StagingLoginBanner />
        </div>
        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
          <Input
            label="Email"
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-600 text-sm"
              tabIndex={-1}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <Button
            type="submit"
            loading={loading}
            className="w-full"
          >
            Sign In
          </Button>
          <p className="text-xs text-center text-slate-500">
            Client accounts are routed to the portal automatically.
          </p>
        </form>
      </div>
    </div>
  );
}
