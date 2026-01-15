"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  PackageOpen,
  Truck,
  ClipboardList,
  LogOut,
  Menu,
  X,
  Building2,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase";

interface PortalNavProps {
  companyName: string;
}

const NAV_LINKS = [
  { href: "/portal/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/inventory", label: "Inventory", icon: Package },
  { href: "/portal/arrivals", label: "Arrivals", icon: PackageOpen },
  { href: "/portal/request-shipment", label: "Request Shipment", icon: Truck },
  { href: "/portal/orders", label: "My Orders", icon: ClipboardList },
];

export default function PortalNav({ companyName }: PortalNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Close menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const handleLogout = async () => {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/client-login");
  };

  const isActive = (href: string) => {
    if (href === "/portal/dashboard") {
      return pathname === "/portal" || pathname === "/portal/dashboard";
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/portal/dashboard" className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">7D</span>
                </div>
                <div className="hidden sm:block">
                  <span className="font-semibold text-gray-900">7 Degrees</span>
                  <span className="text-xs text-gray-500 block -mt-1">Client Portal</span>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1 h-full">
              {NAV_LINKS.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.href);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`
                      relative flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors
                      ${active
                        ? "text-blue-600"
                        : "text-gray-600 hover:text-gray-900"
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                    {active && (
                      <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-full" />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Right Side - Company & Logout (Desktop) */}
            <div className="hidden md:flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
                <Building2 className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700 max-w-[200px] truncate">
                  {companyName}
                </span>
              </div>

              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                {loggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>

            {/* Mobile Menu Button - Touch friendly 44x44 */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex items-center justify-center w-11 h-11 -mr-2 rounded-lg text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Panel */}
      <div
        className={`
          fixed top-16 left-0 right-0 bottom-0 bg-white z-40 md:hidden
          transform transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Company Info */}
          <div className="px-4 py-4 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-500">Logged in as</p>
                <p className="font-semibold text-gray-900 truncate">{companyName}</p>
              </div>
            </div>
          </div>

          {/* Navigation Links - Touch friendly with min-height 48px */}
          <nav className="flex-1 overflow-y-auto py-2">
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`
                    flex items-center gap-4 px-4 min-h-[52px] text-base font-medium transition-colors
                    ${active
                      ? "bg-blue-50 text-blue-600 border-l-4 border-blue-600"
                      : "text-gray-700 hover:bg-gray-50 active:bg-gray-100 border-l-4 border-transparent"
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 ${active ? "text-blue-600" : "text-gray-500"}`} />
                  <span className="flex-1">{link.label}</span>
                  <ChevronRight className={`w-5 h-5 ${active ? "text-blue-400" : "text-gray-300"}`} />
                </Link>
              );
            })}
          </nav>

          {/* Logout Button - Fixed at bottom, touch friendly */}
          <div className="border-t border-gray-200 p-4 bg-white">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full flex items-center justify-center gap-3 min-h-[48px] px-4 text-base font-medium text-red-600 bg-red-50 hover:bg-red-100 active:bg-red-200 rounded-xl transition-colors disabled:opacity-50"
            >
              <LogOut className="w-5 h-5" />
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
