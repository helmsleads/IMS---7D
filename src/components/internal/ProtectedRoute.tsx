"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isStaff, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isLoginRoute = pathname === "/login";

  useEffect(() => {
    if (isLoginRoute) {
      return;
    }

    if (!loading) {
      if (!user) {
        router.replace("/login");
      } else if (!isStaff) {
        router.replace("/portal/dashboard");
      }
    }
  }, [user, isStaff, isLoginRoute, loading, router]);

  if (isLoginRoute) {
    return <>{children}</>;
  }

  if (loading || !user || !isStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return <>{children}</>;
}
