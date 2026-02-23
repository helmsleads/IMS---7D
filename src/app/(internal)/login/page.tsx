"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
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
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      // Verify user is staff (exists in users table and is active)
      const { data: staffUser, error: staffError } = await supabase
        .from("users")
        .select("id, active")
        .eq("id", authData.user.id)
        .single();

      if (staffError || !staffUser) {
        await supabase.auth.signOut();
        setError("Access denied. This login is for staff members only.");
        return;
      }

      if (!staffUser.active) {
        await supabase.auth.signOut();
        setError("Your account has been deactivated. Please contact an administrator.");
        return;
      }

      router.push(redirectTo);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      <div className="bg-white p-8 rounded-xl shadow-2xl shadow-black/20 w-full max-w-md">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <span className="text-white font-bold text-xl">7D</span>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center text-slate-900">
          7 Degrees Co
        </h1>
        <p className="text-center text-slate-400 mt-1">Team Login</p>
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
        </form>
      </div>
    </div>
  );
}
