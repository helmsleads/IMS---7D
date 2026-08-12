"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { usePasswordSetupRedirect } from "@/hooks/use-password-setup-redirect";
import { BrandLogo } from "@/components/BrandLogo";
import { StagingLoginBanner } from "@/components/StagingLoginBanner";
import { ShopifyEmbedBreakout } from "@/components/ShopifyEmbedBreakout";
import {
  breakOutToPortalLogin,
  shouldBreakOutOfShopifyEmbed,
} from "@/lib/shopify-embed";

export default function ClientLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  usePasswordSetupRedirect();
  const redirectTo = searchParams.get("redirect") || "/portal/dashboard";
  const portalPath = `/client-login?redirect=${encodeURIComponent(redirectTo)}`;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shopifyEmbed, setShopifyEmbed] = useState(false);

  // If Shopify still embeds this page, break out so cookies work — never keep the form in-frame.
  useEffect(() => {
    if (!shouldBreakOutOfShopifyEmbed()) return;
    setShopifyEmbed(true);
    breakOutToPortalLogin(portalPath);
  }, [portalPath]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (shouldBreakOutOfShopifyEmbed()) {
        setShopifyEmbed(true);
        breakOutToPortalLogin(portalPath);
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

      if (authError) {
        setError(authError.message);
        return;
      }

      // First check if user has access via client_users table
      const { data: clientUserAccess } = await supabase
        .from("client_users")
        .select("id, client_id")
        .eq("user_id", authData.user.id)
        .limit(1);

      if (clientUserAccess && clientUserAccess.length > 0) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("password_set_at")
          .eq("id", authData.user.id)
          .maybeSingle();

        // Password login succeeded — they already have a password. Mark first-login complete.
        if (profile && !profile.password_set_at) {
          await supabase
            .from("user_profiles")
            .update({ password_set_at: new Date().toISOString() })
            .eq("id", authData.user.id);
        }

        router.push(redirectTo);
        return;
      }

      // Fall back to legacy auth_id check on clients table
      const { data: legacyClient } = await supabase
        .from("clients")
        .select("id")
        .eq("auth_id", authData.user.id)
        .maybeSingle();

      if (legacyClient) {
        router.push(redirectTo);
        return;
      }

      // Not a portal user — send staff/admins to the internal app instead of denying
      const { data: staffUser } = await supabase
        .from("users")
        .select("id, active")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (staffUser?.active) {
        router.push("/dashboard");
        return;
      }

      if (staffUser && !staffUser.active) {
        await supabase.auth.signOut();
        setError(
          "Your staff account has been deactivated. Please contact an administrator."
        );
        return;
      }

      const { data: staffByEmail } = await supabase
        .from("users")
        .select("id, active")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (staffByEmail?.active) {
        router.push("/dashboard");
        return;
      }

      // Neither portal nor staff
      await supabase.auth.signOut();
      setError(
        "Access denied. No portal or staff access found for this account. Please contact support."
      );
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (shopifyEmbed) {
    return (
      <ShopifyEmbedBreakout
        href={portalPath}
        title="Continue in the 7D Portal"
        description="Sign-in from inside Shopify Admin usually fails. Open this portal in a full browser tab, then connect Shopify from Integrations."
        ctaLabel="Open Client Portal"
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900">
      <div className="bg-white p-8 rounded-xl shadow-2xl shadow-black/20 w-full max-w-md border-t-4 border-t-cyan-500">
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
          Client Portal
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
            className="w-full !bg-gradient-to-b !from-cyan-500 !to-teal-600 !shadow-sm !shadow-cyan-600/20 hover:!from-cyan-600 hover:!to-teal-700"
          >
            Access Portal
          </Button>
          <p className="text-xs text-center text-slate-500">
            Staff accounts are routed to the team app automatically.
          </p>
          <div className="text-center">
            <a href="/forgot-password" className="text-sm text-cyan-600 hover:text-cyan-700">
              Forgot password?
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
