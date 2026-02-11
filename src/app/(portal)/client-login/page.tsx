"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function ClientLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const redirectTo = searchParams.get("redirect") || "/portal/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        // User has portal access via client_users
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md border-t-4 border-teal-600">
        <h1 className="text-2xl font-bold text-center text-gray-900">
          7 Degrees Co
        </h1>
        <p className="text-center text-teal-600 mt-2 font-medium">
          Client Portal
        </p>
        <form onSubmit={handleLogin} className="mt-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}
          <div className="mb-4">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <div className="mb-6">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 text-white py-2 px-4 rounded-md hover:bg-teal-700 transition-colors font-medium disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Access Portal"}
          </button>
          <div className="mt-4 text-center">
            <a href="/forgot-password" className="text-sm text-teal-600 hover:text-teal-700">
              Forgot password?
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
