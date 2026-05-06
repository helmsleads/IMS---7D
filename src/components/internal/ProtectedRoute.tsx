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
  const isMfaRoute = pathname.startsWith("/mfa");

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Not logged in at all - redirect to login
        router.push("/login");
      } else if (!isStaff) {
        // Logged in but not staff - redirect to portal
        // This prevents portal users from accessing internal routes
        router.push("/portal/dashboard");
      } else if (!isMfaVerified && !isMfaRoute) {
        const nextPath = hasTotpFactor ? "/mfa/verify" : "/mfa/setup";
        router.push(`${nextPath}?redirect=${encodeURIComponent(pathname)}`);
      }
    }
  }, [user, isStaff, isMfaVerified, hasTotpFactor, isMfaRoute, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Must be logged in AND be staff to see internal content
  if (!user || !isStaff || (!isMfaVerified && !isMfaRoute)) {
    return null;
  }

  return <>{children}</>;
}
