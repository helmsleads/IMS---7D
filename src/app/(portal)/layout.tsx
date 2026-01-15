"use client";

import { usePathname } from "next/navigation";
import { ClientProvider, useClient } from "@/lib/client-auth";
import ClientProtectedRoute from "@/components/portal/ClientProtectedRoute";
import PortalShell from "@/components/portal/PortalShell";

// Pages that don't require auth or shell
const PUBLIC_PATHS = ["/client-login", "/portal/login"];

function PortalContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { client } = useClient();
  const isPublicPage = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  // Public pages (login) - render without shell or protection
  if (isPublicPage) {
    return <>{children}</>;
  }

  // Protected pages - wrap with protection and shell
  return (
    <ClientProtectedRoute>
      <PortalShell companyName={client?.company_name || "Loading..."}>
        {children}
      </PortalShell>
    </ClientProtectedRoute>
  );
}

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientProvider>
      <PortalContent>{children}</PortalContent>
    </ClientProvider>
  );
}
