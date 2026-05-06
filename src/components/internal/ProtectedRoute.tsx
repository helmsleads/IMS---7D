"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isStaff, isMfaVerified, hasTotpFactor, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isLoginRoute = pathname === "/login";
  const isMfaRoute = pathname.startsWith("/mfa");

  useEffect(() => {
    if (isLoginRoute) {
      return;
    }

    if (!loading) {
      if (!user) {
        // Not logged in at all - redirect to login
        router.replace("/login");
      } else if (!isStaff) {
        // Logged in but not staff - redirect to portal
        // This prevents portal users from accessing internal routes
        router.replace("/portal/dashboard");
      } else if (!isMfaVerified && !isMfaRoute) {
        const nextPath = hasTotpFactor ? "/mfa/verify" : "/mfa/setup";
        router.replace(`${nextPath}?redirect=${encodeURIComponent(pathname)}`);
      }
    }
  }, [user, isStaff, isMfaVerified, hasTotpFactor, isLoginRoute, isMfaRoute, loading, pathname, router]);

  if (isLoginRoute) {
    return <>{children}</>;
  }

  if (loading || !user || !isStaff || (!isMfaVerified && !isMfaRoute)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return <>{children}</>;
}
