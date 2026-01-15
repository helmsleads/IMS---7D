"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useClient } from "@/lib/client-auth";

export default function ClientProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { client, loading } = useClient();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !client) {
      router.push("/client-login");
    }
  }, [client, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!client) {
    return null;
  }

  return <>{children}</>;
}
