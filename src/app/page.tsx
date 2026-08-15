"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { usePasswordSetupRedirect } from "@/hooks/use-password-setup-redirect";
import { BrandLogo } from "@/components/BrandLogo";
import { StagingLoginBanner } from "@/components/StagingLoginBanner";
import { ShopifyEmbedBreakout } from "@/components/ShopifyEmbedBreakout";
import {
  SHOPIFY_PORTAL_CONNECT_PATH,
  breakOutToPortalLogin,
  isShopifyEmbeddedRequest,
  shouldBreakOutOfShopifyEmbed,
} from "@/lib/shopify-embed";

export default function LoginPage() {
  const router = useRouter();
  usePasswordSetupRedirect();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shopifyEmbed, setShopifyEmbed] = useState(false);
  const [shopifyAutoBreakOut, setShopifyAutoBreakOut] = useState(false);

  // Shopify App URL / distribution install: send merchant to OAuth Install page.
  // Legacy install flow requires the app to start /admin/oauth/authorize.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const shop = params.get("shop");
    if (!shop || !shop.includes("myshopify.com")) return;
    if (!params.get("hmac") && !params.get("host")) return;
    // Already inside Admin iframe — break out / portal path handles that.
    if (shouldBreakOutOfShopifyEmbed()) return;

    const app = params.get("app") === "test" ? "test" : "live";
    const url = `/api/integrations/shopify/begin-install?shop=${encodeURIComponent(shop)}&app=${app}`;
    // Preserve hmac for server verification
    if (params.get("hmac")) {
      const q = new URLSearchParams();
      params.forEach((v, k) => q.set(k, v));
      q.set("app", app);
      window.location.replace(`/api/integrations/shopify/begin-install?${q.toString()}`);
      return;
    }
    window.location.replace(url);
  }, []);

  // Shopify App URL: auto-break out only inside Admin iframe / embedded=1.
  useEffect(() => {
    const embedded = shouldBreakOutOfShopifyEmbed();
    const fromShopify = isShopifyEmbeddedRequest();
    if (!embedded && !fromShopify) return;
    // begin-install redirect owns top-level shop+hmac installs
    if (
      fromShopify &&
      !embedded &&
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("shop")?.includes("myshopify.com")
    ) {
      return;
    }
    setShopifyEmbed(true);
    setShopifyAutoBreakOut(embedded);
    if (embedded) {
      breakOutToPortalLogin(SHOPIFY_PORTAL_CONNECT_PATH);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Never attempt password login inside Shopify's iframe — session won't stick.
    if (shouldBreakOutOfShopifyEmbed()) {
      setShopifyEmbed(true);
      setShopifyAutoBreakOut(true);
      breakOutToPortalLogin(SHOPIFY_PORTAL_CONNECT_PATH);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const normalizedEmail = email.trim().toLowerCase();

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (authError) {
      const message = authError.message.toLowerCase();
      setError(
        message.includes("invalid login credentials") ||
          message.includes("invalid email or password")
          ? "Invalid email or password. Use the same email that received the invitation."
          : authError.message
      );
      setLoading(false);
      return;
    }

    if (!authData.user) {
      setError("Login failed. Please try again.");
      setLoading(false);
      return;
    }

    // Staff: users table by id (maybeSingle avoids treating "no row" as a hard error)
    const { data: staffUser } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (staffUser) {
      router.push("/inventory");
      return;
    }

    // Fallback staff lookup by email (RLS edge cases)
    const { data: staffByEmail } = await supabase
      .from("users")
      .select("id, role")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (staffByEmail) {
      router.push("/inventory");
      return;
    }

    // Portal access via client_users (same path as /client-login)
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

      if (profile && !profile.password_set_at) {
        await supabase
          .from("user_profiles")
          .update({ password_set_at: new Date().toISOString() })
          .eq("id", authData.user.id);
      }

      router.push("/portal/dashboard");
      return;
    }

    // Legacy portal mapping via clients.auth_id
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
      "No staff or portal access is linked to this login. Client accounts should use Client Portal sign-in."
    );
    setLoading(false);
  };

  if (shopifyEmbed) {
    return (
      <ShopifyEmbedBreakout
        href={SHOPIFY_PORTAL_CONNECT_PATH}
        autoBreakOut={shopifyAutoBreakOut}
        title="Shopify app opened"
        description="If you just installed the app, check Settings → Apps → Installed in Shopify. Then open the 7D portal and connect the store from Integrations (Partners OAuth)."
        ctaLabel="Open Client Portal to connect"
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMDIwMjAiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnY0em0wLTZ2LTRoLTJ2NGgyek0zMCAzNGgtMnYtNGgydjR6bTAtNnYtNGgtMnY0aDJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20"></div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-5">
            <BrandLogo
              variant="stacked"
              width={168}
              height={172}
              className="drop-shadow-lg"
              priority
            />
          </div>
          <p className="text-slate-400 mt-1">Inventory Management System</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <StagingLoginBanner />
          <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
            Sign in to your account
          </h2>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm space-y-2">
                <p>{error}</p>
                <p>
                  <a
                    href="/client-login?redirect=%2Fportal%2Fdashboard"
                    className="font-medium underline hover:text-red-700"
                  >
                    Sign in to the Client Portal
                  </a>
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow pr-12"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold py-3 px-4 rounded-xl hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200 space-y-2">
            <p className="text-sm text-gray-500 text-center">
              Staff and client accounts use the same login.
              <br />
              You&apos;ll be directed to the appropriate portal.
            </p>
            <p className="text-sm text-center">
              <a
                href="/client-login?redirect=%2Fportal%2Fdashboard"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Client portal sign-in
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-slate-500 text-sm mt-8">
          &copy; {new Date().getFullYear()} 7 Degrees Co. All rights reserved.
        </p>
      </div>
    </div>
  );
}
