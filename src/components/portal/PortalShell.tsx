"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { Eye, ArrowLeft } from "lucide-react";
import { useClient } from "@/lib/client-auth";
import PortalNav from "./PortalNav";
import ErrorBoundary from "@/components/ui/ErrorBoundary";

interface PortalShellProps {
  children: ReactNode;
  companyName: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function PortalShell({
  children,
  companyName,
  title,
  subtitle,
  actions,
}: PortalShellProps) {
  const { isStaffPreview } = useClient();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Staff Preview Banner */}
      {isStaffPreview && (
        <div className="bg-amber-500 text-amber-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Staff Preview Mode - You are viewing the client portal as a staff member
                </span>
              </div>
              <Link
                href="/inventory"
                className="flex items-center gap-1 text-sm font-medium hover:underline"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Internal App
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <PortalNav companyName={companyName} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        {(title || actions) && (
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                {title && (
                  <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                )}
                {subtitle && (
                  <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
                )}
              </div>
              {actions && (
                <div className="flex-shrink-0">{actions}</div>
              )}
            </div>
          </div>
        )}

        {/* Page Content */}
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-600 to-blue-700 rounded flex items-center justify-center">
                <span className="text-white font-bold text-xs">7D</span>
              </div>
              <span className="text-sm text-gray-500">
                7 Degrees Co. Client Portal
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <a href="#" className="hover:text-gray-700 transition-colors">
                Help & Support
              </a>
              <a href="#" className="hover:text-gray-700 transition-colors">
                Contact Us
              </a>
              <span>© {new Date().getFullYear()} 7 Degrees Co.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
