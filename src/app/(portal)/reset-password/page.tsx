"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, AlertCircle, Eye, EyeOff, Clock, Link2Off, Mail, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import {
  getAuthLinkErrorFromUrl,
  getHashSessionTokens,
  isInviteOrRecoveryHash,
  clearAuthHashFromUrl,
  clearAuthCodeFromUrl,
} from "@/lib/auth-password-setup";

type LinkFailureKind = "expired" | "invalid" | "callback";

function AuthShell({
  children,
  accent = "teal",
}: {
  children: React.ReactNode;
  accent?: "teal" | "amber" | "red";
}) {
  const border =
    accent === "amber"
      ? "border-t-amber-500"
      : accent === "red"
        ? "border-t-red-500"
        : "border-t-teal-600";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMDIwMjAiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnY0em0wLTZ2LTRoLTJ2NGgyek0zMCAzNGgtMnYtNGgydjR6bTAtNnYtNGgtMnY0aDJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20" />
      <div
        className={`relative bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border-t-4 ${border}`}
      >
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

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [isInvite, setIsInvite] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkFailureKind, setLinkFailureKind] =
    useState<LinkFailureKind>("invalid");
  const [loginPath, setLoginPath] = useState<"/login" | "/client-login">(
    "/client-login"
  );

  const resolveLoginPath = async (
    userId: string
  ): Promise<"/login" | "/client-login"> => {
    const { data: staffUser } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    const path = staffUser ? "/login" : "/client-login";
    setLoginPath(path);
    return path;
  };

  useEffect(() => {
    let active = true;

    const succeed = async (userId: string, invite = false) => {
      if (!active) return;
      if (invite) setIsInvite(true);
      setIsValidSession(true);
      await resolveLoginPath(userId);
    };

    const fail = (message?: string, kind: LinkFailureKind = "invalid") => {
      if (!active) return;
      if (message) setLinkError(message);
      setLinkFailureKind(kind);
      setIsValidSession(false);
    };

    const resolveSession = async () => {
      const params = new URLSearchParams(window.location.search);
      const callbackError = params.get("error");
      const authLinkError = getAuthLinkErrorFromUrl();

      if (params.get("expired") === "1") {
        fail(
          "This invitation or password reset link has expired. Security links are only valid for a limited time.",
          "expired"
        );
        return;
      }

      if (authLinkError) {
        fail(
          authLinkError,
          authLinkError.toLowerCase().includes("expired") ? "expired" : "invalid"
        );
        return;
      }

      if (callbackError) {
        fail(
          "We could not complete sign-in from that link. It may have already been used or timed out.",
          "callback"
        );
        return;
      }

      const hashTokens = getHashSessionTokens();
      if (hashTokens) {
        const inviteFlow = isInviteOrRecoveryHash();
        const { error: sessionError } = await supabase.auth.setSession(hashTokens);
        clearAuthHashFromUrl();

        if (sessionError) {
          fail(sessionError.message);
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          await succeed(user.id, inviteFlow);
          return;
        }

        fail("Could not verify your link. Please request a new one.");
        return;
      }

      const code = params.get("code");
      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        clearAuthCodeFromUrl();

        if (exchangeError) {
          fail(exchangeError.message);
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          await succeed(user.id, true);
          return;
        }

        fail("Could not verify your link. Please request a new one.");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (user) {
        const inviteFlow =
          params.get("type") === "recovery" || params.get("type") === "invite";
        await succeed(user.id, inviteFlow);
        return;
      }

      fail("This invitation or password reset link is invalid or has expired.");
    };

    void resolveSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active || !session?.user) return;

      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setIsInvite(true);
        setIsValidSession(true);
        await resolveLoginPath(session.user.id);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const setupResponse = await fetch("/api/auth/complete-password-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const setupResult = (await setupResponse.json()) as {
        error?: string;
      };

      if (!setupResponse.ok) {
        setError(
          setupResult.error ||
            "Could not save your password. Open the invitation link again and try once more."
        );
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const redirectTo = user
        ? await resolveLoginPath(user.id)
        : loginPath;

      await supabase.auth.signOut();
      router.replace(redirectTo);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (isValidSession === null) {
    return (
      <AuthShell>
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-600 font-medium">Verifying your link...</p>
          <p className="text-sm text-gray-400 mt-1">This only takes a moment</p>
        </div>
      </AuthShell>
    );
  }

  if (isValidSession === false) {
    const isExpired = linkFailureKind === "expired";
    const title = isExpired
      ? "This link has expired"
      : linkFailureKind === "callback"
        ? "Link could not be opened"
        : "Invalid link";

    const description =
      linkError ||
      (isExpired
        ? "Invitation and reset links expire after a short time for security."
        : "This invitation or password reset link is invalid or has already been used.");

    const Icon = isExpired ? Clock : linkFailureKind === "callback" ? Link2Off : AlertCircle;
    const iconWrap = isExpired
      ? "bg-amber-100 text-amber-600"
      : "bg-red-100 text-red-600";
    const accent = isExpired ? "amber" : "red";

    return (
      <AuthShell accent={accent}>
        <div className="text-center">
          <div
            className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4 ${iconWrap}`}
          >
            <Icon className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
          <p className="text-gray-600 mb-6">{description}</p>

          <div className="text-left bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
            <p className="text-sm font-medium text-gray-900 mb-2">What you can do</p>
            <ul className="text-sm text-gray-600 space-y-2">
              {isExpired ? (
                <>
                  <li className="flex gap-2">
                    <Mail className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
                    <span>
                      Request a new password reset email if you already have an account.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <ArrowRight className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
                    <span>
                      Ask your administrator to send a fresh invitation if you are setting up a new account.
                    </span>
                  </li>
                </>
              ) : (
                <>
                  <li className="flex gap-2">
                    <ArrowRight className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
                    <span>Open the most recent email — older links stop working once a new one is sent.</span>
                  </li>
                  <li className="flex gap-2">
                    <Mail className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
                    <span>Request a new password reset or invitation from your administrator.</span>
                  </li>
                </>
              )}
            </ul>
          </div>

          <div className="space-y-3">
            <Link href="/forgot-password">
              <Button className="w-full">Request password reset</Button>
            </Link>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/login">
                <Button variant="secondary" className="w-full">
                  Staff login
                </Button>
              </Link>
              <Link href="/client-login">
                <Button variant="secondary" className="w-full">
                  Client login
                </Button>
              </Link>
            </div>
            <Link
              href="/"
              className="block text-center text-sm text-gray-500 hover:text-gray-700 pt-1"
            >
              Back to main sign in
            </Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
        <div className="text-center mb-6">
          <div className="mx-auto w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-teal-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {isInvite ? "Create Your Password" : "Set New Password"}
          </h1>
          <p className="text-gray-600 mt-2">
            {isInvite
              ? "Choose a password for your account. You will use this with the email address that received the invitation."
              : "Please enter your new password below."}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {isInvite ? "Password" : "New Password"}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="mb-6">
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Confirm Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              id="confirmPassword"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          <div className="mb-6 p-3 bg-gray-50 rounded-md">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Password requirements:
            </p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li className={password.length >= 8 ? "text-green-600" : ""}>
                {password.length >= 8 ? "✓" : "○"} At least 8 characters
              </li>
              <li
                className={
                  password === confirmPassword && confirmPassword
                    ? "text-green-600"
                    : ""
                }
              >
                {password === confirmPassword && confirmPassword ? "✓" : "○"}{" "}
                Passwords match
              </li>
            </ul>
          </div>

          <Button
            type="submit"
            loading={loading}
            disabled={
              loading || password.length < 8 || password !== confirmPassword
            }
            className="w-full"
          >
            {isInvite ? "Create Password" : "Reset Password"}
          </Button>
        </form>
    </AuthShell>
  );
}
