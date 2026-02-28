"use client";

import { ReactNode, useEffect, useState } from "react";
import { useClient } from "@/lib/client-auth";
import { MobileMenuProvider } from "@/lib/mobile-menu-context";
import PortalSidebar from "./PortalSidebar";
import PortalHeader from "./PortalHeader";
import ErrorBoundary from "@/components/ui/ErrorBoundary";

interface PortalShellProps {
  children: ReactNode;
  companyName: string;
}

const SIDEBAR_COLLAPSED_KEY = "portal-sidebar-collapsed";

export default function PortalShell({ children, companyName }: PortalShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isStaffPreview, impersonatedUser } = useClient();

  const hasBanner = isStaffPreview && impersonatedUser;

  // Load initial collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored === "true") {
      setSidebarCollapsed(true);
    }
  }, []);

  // Listen for sidebar toggle events
  useEffect(() => {
    const handleSidebarToggle = (event: CustomEvent<{ collapsed: boolean }>) => {
      setSidebarCollapsed(event.detail.collapsed);
    };

    window.addEventListener("portal-sidebar-toggle", handleSidebarToggle as EventListener);
    return () => {
      window.removeEventListener("portal-sidebar-toggle", handleSidebarToggle as EventListener);
    };
  }, []);

  return (
    <MobileMenuProvider>
      <div className="min-h-screen bg-slate-50">
        <PortalSidebar companyName={companyName} />
        <div
          className={`
            transition-all duration-300 ease-in-out
            ${sidebarCollapsed ? "md:ml-[72px]" : "md:ml-[264px]"}
            ${hasBanner ? "pt-10" : ""}
          `}
        >
          <PortalHeader />
          <main className="p-6 animate-fade-in-up">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </div>
    </MobileMenuProvider>
  );
}
