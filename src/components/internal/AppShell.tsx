import { ReactNode } from "react";
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

export default function AppShell({
  title,
  subtitle,
  actions,
  children,
}: AppShellProps) {
  return (
    <MobileMenuProvider>
      <div className="min-h-screen bg-gray-100">
        <Sidebar />
        <div className="md:ml-64">
          <Header title={title} subtitle={subtitle} actions={actions} />
          <main className="p-6">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </div>
    </MobileMenuProvider>
  );
}
