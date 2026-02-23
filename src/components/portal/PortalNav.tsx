"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  PackageOpen,
  Truck,
  ClipboardList,
  Briefcase,
  CreditCard,
  RotateCcw,
  MessageSquare,
  TrendingUp,
  FileText,
  LogOut,
  Menu,
  X,
  Building2,
  ChevronRight,
  ChevronDown,
  Settings,
  Check,
  ArrowRightLeft,
  Eye,
  ArrowLeft,
  Plug,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useClient } from "@/lib/client-auth";
import { getMyUnreadCount } from "@/lib/api/portal-messages";

interface PortalNavProps {
  companyName: string;
}

// Primary nav links shown in the main bar
const PRIMARY_LINKS = [
  { href: "/portal/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/inventory", label: "Inventory", icon: Package },
  { href: "/portal/request-shipment", label: "Ship", icon: Truck },
  { href: "/portal/orders", label: "Orders", icon: ClipboardList },
  { href: "/portal/messages", label: "Messages", icon: MessageSquare },
];

// Secondary nav links shown in the "More" dropdown
const SECONDARY_LINKS = [
  { href: "/portal/arrivals", label: "Arrivals", icon: PackageOpen },
  { href: "/portal/templates", label: "Templates", icon: FileText },
  { href: "/portal/returns", label: "Returns", icon: RotateCcw },
  { href: "/portal/profitability", label: "Profitability", icon: TrendingUp },
  { href: "/portal/services", label: "Services", icon: Briefcase },
  { href: "/portal/plan", label: "My Plan", icon: CreditCard },
  { href: "/portal/integrations", label: "Integrations", icon: Plug },
  { href: "/portal/settings", label: "Settings", icon: Settings },
];

// All links for mobile menu
const ALL_LINKS = [...PRIMARY_LINKS, ...SECONDARY_LINKS];

export default function PortalNav({ companyName }: PortalNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { client, availableClients, switchClient, currentRole, isStaffPreview, impersonatedClientId, impersonatedUser, exitImpersonation } = useClient();

  // Staff can always switch clients (they see all clients)
  const showClientSwitcher = availableClients.length > 1 || isStaffPreview;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [pendingReturnsCount, setPendingReturnsCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Fetch notification badge counts (messages, active orders, pending returns)
  useEffect(() => {
    const supabase = createClient();

    const fetchBadgeCounts = async () => {
      // Skip if no client or if in staff preview mode without a real client
      // "staff-preview" is a fake ID used when staff views portal without impersonating
      if (!client || client.id === "staff-preview") return;
      try {
        // Fetch all counts in parallel
        const [unread, activeOrders, pendingReturns] = await Promise.all([
          getMyUnreadCount(client.id),
          supabase
            .from("outbound_orders")
            .select("*", { count: "exact", head: true })
            .eq("client_id", client.id)
            .in("status", ["pending", "confirmed", "processing", "packed"]),
          supabase
            .from("returns")
            .select("*", { count: "exact", head: true })
            .eq("client_id", client.id)
            .in("status", ["requested", "approved"]),
        ]);

        setUnreadCount(unread);
        setActiveOrdersCount(activeOrders.count || 0);
        setPendingReturnsCount(pendingReturns.count || 0);
      } catch (err) {
        console.error("Failed to fetch badge counts:", err);
      }
    };

    fetchBadgeCounts();

    // Refresh every 30 seconds
    const interval = setInterval(fetchBadgeCounts, 30000);
    return () => clearInterval(interval);
  }, [client]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setClientDropdownOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close menus on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
    setClientDropdownOpen(false);
    setMoreMenuOpen(false);
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

  const handleSwitchClient = (clientId: string) => {
    switchClient(clientId);
    setClientDropdownOpen(false);
    // Refresh the current page to load new client data
    router.refresh();
  };

  const isActive = (href: string) => {
    if (href === "/portal/dashboard") {
      return pathname === "/portal" || pathname === "/portal/dashboard";
    }
    return pathname.startsWith(href);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-purple-100 text-purple-700";
      case "admin":
        return "bg-blue-100 text-blue-700";
      case "member":
        return "bg-gray-100 text-gray-700";
      case "viewer":
        return "bg-gray-100 text-gray-600";
      case "staff":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <>
      {/* Staff Impersonation Banner */}
      {isStaffPreview && impersonatedUser && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white py-2 px-4 sticky top-0 z-[60] w-full overflow-hidden">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Eye className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium truncate">
                Viewing <strong>{impersonatedUser.full_name || impersonatedUser.email}</strong>&apos;s Portal
              </span>
              {availableClients.length > 1 && (
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded flex-shrink-0 hidden sm:inline">
                  {availableClients.length} clients
                </span>
              )}
            </div>
            <button
              onClick={exitImpersonation}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-amber-600 hover:bg-amber-50 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Exit to Dashboard</span>
              <span className="sm:hidden">Exit</span>
            </button>
          </div>
        </div>
      )}
      <nav className={`bg-white border-b border-slate-200 shadow-sm sticky ${isStaffPreview && impersonatedClientId ? 'top-10' : 'top-0'} z-50 w-full`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 min-w-0">
            {/* Logo */}
            <div className="flex items-center flex-shrink-0">
              <Link href="/portal/dashboard" className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">7D</span>
                </div>
                <div className="hidden sm:block">
                  <span className="font-semibold text-slate-900">7 Degrees</span>
                  <span className="text-xs text-slate-500 block -mt-1">Client Portal</span>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation - Primary Links (centered) */}
            <div className="hidden lg:flex items-center gap-1 h-full flex-1 justify-center">
              {PRIMARY_LINKS.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.href);
                const badgeCount =
                  link.href === "/portal/messages" ? unreadCount :
                  link.href === "/portal/orders" ? activeOrdersCount : 0;
                const showBadge = badgeCount > 0;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`
                      relative flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-all whitespace-nowrap rounded-lg
                      ${active
                        ? "bg-cyan-50 text-cyan-700"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                      }
                    `}
                  >
                    <span className="relative">
                      <Icon className="w-4 h-4" />
                      {showBadge && (
                        <span className={`absolute -top-1.5 -right-1.5 w-4 h-4 text-white text-[10px] font-bold rounded-full flex items-center justify-center ${
                          link.href === "/portal/messages" ? "bg-red-500" : "bg-cyan-500"
                        }`}>
                          {badgeCount > 9 ? "9+" : badgeCount}
                        </span>
                      )}
                    </span>
                    {link.label}
                  </Link>
                );
              })}

              {/* More Dropdown */}
              <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                  className={`
                    relative flex items-center gap-1 px-3 py-1.5 text-sm font-medium transition-all rounded-lg
                    ${SECONDARY_LINKS.some(link => isActive(link.href))
                      ? "bg-cyan-50 text-cyan-700"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }
                  `}
                >
                  <span className="relative">
                    <Menu className="w-4 h-4" />
                    {pendingReturnsCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full" />
                    )}
                  </span>
                  More
                  <ChevronDown className={`w-3 h-3 transition-transform ${moreMenuOpen ? "rotate-180" : ""}`} />
                </button>

                {moreMenuOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg ring-1 ring-black/5 py-1 z-[100]">
                    {SECONDARY_LINKS.map((link) => {
                      const Icon = link.icon;
                      const active = isActive(link.href);
                      const returnsBadge = link.href === "/portal/returns" && pendingReturnsCount > 0;
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={`
                            flex items-center gap-3 px-4 py-2 text-sm transition-colors
                            ${active
                              ? "bg-cyan-50 text-cyan-600"
                              : "text-slate-700 hover:bg-slate-50"
                            }
                          `}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="flex-1">{link.label}</span>
                          {returnsBadge && (
                            <span className="w-5 h-5 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                              {pendingReturnsCount > 9 ? "9+" : pendingReturnsCount}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <button
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        <LogOut className="w-4 h-4" />
                        {loggingOut ? "Logging out..." : "Logout"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side - Company Switcher (Desktop) */}
            <div className="hidden lg:flex items-center gap-2 flex-shrink-0 ml-auto">
              {/* Client Switcher */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setClientDropdownOpen(!clientDropdownOpen)}
                  className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors
                    ${showClientSwitcher
                      ? "bg-white ring-1 ring-slate-200 hover:bg-slate-50 cursor-pointer"
                      : "bg-white ring-1 ring-slate-200"
                    }
                  `}
                >
                  <div className="w-7 h-7 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-md flex items-center justify-center">
                    <span className="text-white font-semibold text-xs">
                      {companyName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-medium text-slate-700 max-w-[150px] truncate block">
                      {companyName}
                    </span>
                    {currentRole && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${getRoleBadgeColor(currentRole)}`}>
                        {currentRole.charAt(0).toUpperCase() + currentRole.slice(1)}
                      </span>
                    )}
                  </div>
                  {showClientSwitcher && (
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${clientDropdownOpen ? "rotate-180" : ""}`} />
                  )}
                </button>

                {/* Client Dropdown */}
                {clientDropdownOpen && showClientSwitcher && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg ring-1 ring-black/5 py-2 z-[100]">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Switch Account
                      </p>
                    </div>
                    <div className="max-h-64 overflow-y-auto py-1">
                      {availableClients.map((access) => {
                        const isSelected = client?.id === access.client_id;
                        return (
                          <button
                            key={access.client_id}
                            onClick={() => handleSwitchClient(access.client_id)}
                            className={`
                              w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors
                              ${isSelected ? "bg-cyan-50" : "hover:bg-slate-50"}
                            `}
                          >
                            <div className={`
                              w-9 h-9 rounded-lg flex items-center justify-center
                              ${isSelected
                                ? "bg-gradient-to-br from-cyan-500 to-teal-600"
                                : "bg-slate-200"
                              }
                            `}>
                              <span className={`font-semibold text-sm ${isSelected ? "text-white" : "text-slate-600"}`}>
                                {access.client.company_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium truncate ${isSelected ? "text-cyan-700" : "text-slate-900"}`}>
                                {access.client.company_name}
                              </p>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${getRoleBadgeColor(access.role)}`}>
                                  {access.role.charAt(0).toUpperCase() + access.role.slice(1)}
                                </span>
                                {access.is_primary && (
                                  <span className="text-xs text-gray-500">Primary</span>
                                )}
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {availableClients.length > 3 && (
                      <div className="px-3 py-2 border-t border-gray-100">
                        <p className="text-xs text-gray-500 text-center">
                          {availableClients.length} accounts available
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Menu Button - Touch friendly 44x44 */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden flex items-center justify-center w-11 h-11 -mr-2 ml-auto rounded-lg text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors"
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
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Panel */}
      <div
        className={`
          fixed top-16 left-0 right-0 bottom-0 bg-white z-40 lg:hidden
          transform transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Company Info / Switcher */}
          <div className="px-4 py-4 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {companyName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-500">Logged in as</p>
                <p className="font-semibold text-slate-900 truncate">{companyName}</p>
                {currentRole && (
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${getRoleBadgeColor(currentRole)}`}>
                    {currentRole.charAt(0).toUpperCase() + currentRole.slice(1)}
                  </span>
                )}
              </div>
            </div>

            {/* Mobile Client Switcher */}
            {showClientSwitcher && (
              <div className="mt-3">
                <button
                  onClick={() => setClientDropdownOpen(!clientDropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700"
                >
                  <span className="flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-gray-500" />
                    Switch Account
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${clientDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {clientDropdownOpen && (
                  <div className="mt-2 bg-white border border-slate-200 rounded-lg overflow-hidden">
                    {availableClients.map((access) => {
                      const isSelected = client?.id === access.client_id;
                      return (
                        <button
                          key={access.client_id}
                          onClick={() => handleSwitchClient(access.client_id)}
                          className={`
                            w-full flex items-center gap-3 px-3 py-3 text-left border-b border-slate-100 last:border-b-0
                            ${isSelected ? "bg-cyan-50" : "active:bg-slate-50"}
                          `}
                        >
                          <div className={`
                            w-8 h-8 rounded-lg flex items-center justify-center
                            ${isSelected ? "bg-gradient-to-br from-cyan-500 to-teal-600" : "bg-slate-200"}
                          `}>
                            <span className={`font-semibold text-sm ${isSelected ? "text-white" : "text-slate-600"}`}>
                              {access.client.company_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium truncate ${isSelected ? "text-cyan-700" : "text-slate-900"}`}>
                              {access.client.company_name}
                            </p>
                            <span className={`text-xs font-medium ${getRoleBadgeColor(access.role)} px-1.5 py-0.5 rounded`}>
                              {access.role}
                            </span>
                          </div>
                          {isSelected && (
                            <Check className="w-5 h-5 text-cyan-600" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation Links - Touch friendly with min-height 48px */}
          <nav className="flex-1 overflow-y-auto py-2">
            {ALL_LINKS.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              const badgeCount =
                link.href === "/portal/messages" ? unreadCount :
                link.href === "/portal/orders" ? activeOrdersCount :
                link.href === "/portal/returns" ? pendingReturnsCount : 0;
              const showBadge = badgeCount > 0;
              const badgeColor =
                link.href === "/portal/messages" ? "bg-red-500" :
                link.href === "/portal/returns" ? "bg-orange-500" :
                "bg-blue-500";

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`
                    flex items-center gap-4 px-4 min-h-[52px] text-base font-medium transition-colors
                    ${active
                      ? "bg-cyan-50 text-cyan-600 border-l-4 border-cyan-600"
                      : "text-slate-700 hover:bg-slate-50 active:bg-slate-100 border-l-4 border-transparent"
                    }
                  `}
                >
                  <span className="relative">
                    <Icon className={`w-5 h-5 ${active ? "text-cyan-600" : "text-slate-500"}`} />
                    {showBadge && (
                      <span className={`absolute -top-1 -right-1 w-4 h-4 ${badgeColor} text-white text-[10px] font-bold rounded-full flex items-center justify-center`}>
                        {badgeCount > 9 ? "9+" : badgeCount}
                      </span>
                    )}
                  </span>
                  <span className="flex-1">{link.label}</span>
                  {showBadge && (
                    <span className={`px-2 py-0.5 ${badgeColor} text-white text-xs font-bold rounded-full`}>
                      {badgeCount}
                    </span>
                  )}
                  <ChevronRight className={`w-5 h-5 ${active ? "text-cyan-400" : "text-slate-300"}`} />
                </Link>
              );
            })}
          </nav>

          {/* Logout Button - Fixed at bottom, touch friendly */}
          <div className="border-t border-slate-200 p-4 bg-white">
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
