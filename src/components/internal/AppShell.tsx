"use client";

import { ReactNode, useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { MobileMenuProvider } from "@/lib/mobile-menu-context";

interface AppShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

export default function AppShell({
  title,
  subtitle,
  actions,
  children,
}: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Load initial state from localStorage
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

    window.addEventListener("sidebar-toggle", handleSidebarToggle as EventListener);
    return () => {
      window.removeEventListener("sidebar-toggle", handleSidebarToggle as EventListener);
    };
  }, []);

  return (
    <MobileMenuProvider>
      <div className="min-h-screen bg-slate-50">
        <Sidebar />
        <div
          className={`
            transition-all duration-300 ease-in-out
            ${sidebarCollapsed ? "md:ml-[72px]" : "md:ml-64"}
          `}
        >
          <Header title={title} subtitle={subtitle} actions={actions} />
          <main className="p-6 animate-fade-in-up">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </div>
    </MobileMenuProvider>
  );
}
