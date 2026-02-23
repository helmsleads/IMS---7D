"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function ClientLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const redirectTo = searchParams.get("redirect") || "/portal/dashboard";

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
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
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
        router.push(redirectTo);
        return;
      }

      // Fall back to legacy auth_id check on clients table
      const { data: legacyClient } = await supabase
        .from("clients")
        .select("id")
        .eq("auth_id", authData.user.id)
        .single();

      if (legacyClient) {
        router.push(redirectTo);
        return;
      }

      // No portal access found
      await supabase.auth.signOut();
      setError("Access denied. You don't have portal access. Please contact your administrator.");
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900">
      <div className="bg-white p-8 rounded-xl shadow-2xl shadow-black/20 w-full max-w-md border-t-4 border-t-cyan-500">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-600/20">
            <span className="text-white font-bold text-xl">7D</span>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center text-slate-900">
          7 Degrees Co
        </h1>
        <p className="text-center text-cyan-600 mt-1 font-medium">
          Client Portal
        </p>
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
