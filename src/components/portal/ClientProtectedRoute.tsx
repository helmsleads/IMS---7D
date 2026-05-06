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
      router.replace("/client-login");
    }
  }, [client, loading, router]);

  if (loading || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return <>{children}</>;
}
