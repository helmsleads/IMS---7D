"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isStaff, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Not logged in at all - redirect to login
        router.push("/login");
      } else if (!isStaff) {
        // Logged in but not staff - redirect to portal
        // This prevents portal users from accessing internal routes
        router.push("/portal/dashboard");
      }
    }
  }, [user, isStaff, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Must be logged in AND be staff to see internal content
  if (!user || !isStaff) {
    return null;
  }

  return <>{children}</>;
}
