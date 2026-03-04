"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useClient } from "@/lib/client-auth";
import { useMobileMenu } from "@/lib/mobile-menu-context";
import { createClient } from "@/lib/supabase";
import { getMyUnreadCount } from "@/lib/api/portal-messages";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Truck,
  PackageOpen,
  RotateCcw,
  Layers,
  MessageSquare,
  Receipt,
  Plug,
  FileText,
  Settings,
  LogOut,
  X,
  ChevronDown,
  ChevronRight,
  Check,
  ArrowRightLeft,
  PanelLeftClose,
  PanelLeft,
  Eye,
  ArrowLeft,
} from "lucide-react";

interface NavLink {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  badgeKey?: string;
}

interface NavGroup {
  label: string;
  links: NavLink[];
}

const navGroups: NavGroup[] = [
  {
    label: "",
    links: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/portal/dashboard" },
    ],
  },
  {
    label: "Orders & Shipping",
    links: [
      { label: "Orders", icon: ClipboardList, path: "/portal/orders", badgeKey: "orders" },
      { label: "Request Shipment", icon: Truck, path: "/portal/request-shipment" },
      { label: "Arrivals", icon: PackageOpen, path: "/portal/arrivals" },
      { label: "Returns", icon: RotateCcw, path: "/portal/returns", badgeKey: "returns" },
    ],
  },
  {
    label: "Inventory",
    links: [
      { label: "Inventory", icon: Package, path: "/portal/inventory" },
      { label: "Lots", icon: Layers, path: "/portal/lots" },
    ],
  },
  {
    label: "Communication",
    links: [
      { label: "Messages", icon: MessageSquare, path: "/portal/messages", badgeKey: "messages" },
    ],
  },
  {
    label: "Account",
    links: [
      { label: "Billing", icon: Receipt, path: "/portal/billing" },
      { label: "Integrations", icon: Plug, path: "/portal/integrations" },
      { label: "Templates", icon: FileText, path: "/portal/templates" },
      { label: "Settings", icon: Settings, path: "/portal/settings" },
    ],
  },
];

const SIDEBAR_COLLAPSED_KEY = "portal-sidebar-collapsed";

function getRoleBadgeColor(role: string) {
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
}

export default function PortalSidebar({ companyName }: { companyName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    client,
    availableClients,
    switchClient,
    currentRole,
    isStaffPreview,
    impersonatedClientId,
    impersonatedUser,
    exitImpersonation,
  } = useClient();
  const { isOpen, setIsOpen } = useMobileMenu();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [pendingReturnsCount, setPendingReturnsCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const showClientSwitcher = availableClients.length > 1 || isStaffPreview;

  // Load collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored === "true") {
      setIsCollapsed(true);
    }
  }, []);

  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newState));
    window.dispatchEvent(
      new CustomEvent("portal-sidebar-toggle", { detail: { collapsed: newState } })
    );
  };

  // Fetch badge counts
  useEffect(() => {
    const supabase = createClient();

    const fetchBadgeCounts = async () => {
      if (!client || client.id === "staff-preview") return;
      try {
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
    const interval = setInterval(fetchBadgeCounts, 30000);
    return () => clearInterval(interval);
  }, [client]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setClientDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close menus on navigation
  useEffect(() => {
    setIsOpen(false);
    setClientDropdownOpen(false);
  }, [pathname, setIsOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleLogout = async () => {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/client-login");
  };

  const handleSwitchClient = (clientId: string) => {
    switchClient(clientId);
    setClientDropdownOpen(false);
    router.refresh();
  };

  const isActive = (href: string) => {
    if (href === "/portal/dashboard") {
      return pathname === "/portal" || pathname === "/portal/dashboard";
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  const getBadgeForLink = (link: NavLink) => {
    if (link.badgeKey === "messages" && unreadCount > 0) {
      return { count: unreadCount, color: "bg-red-500" };
    }
    if (link.badgeKey === "orders" && activeOrdersCount > 0) {
      return { count: activeOrdersCount, color: "bg-cyan-500" };
    }
    if (link.badgeKey === "returns" && pendingReturnsCount > 0) {
      return { count: pendingReturnsCount, color: "bg-orange-500" };
    }
    return null;
  };

  const hasBanner = isStaffPreview && impersonatedUser;

  return (
    <>
      {/* Staff Impersonation Banner */}
      {hasBanner && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white py-2 px-4 sticky top-0 z-[60] w-full overflow-hidden">
          <div className="flex items-center justify-between gap-3">
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

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 h-full bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 flex flex-col z-50
          transform transition-all duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
          ${isCollapsed ? "w-[72px]" : "w-[264px]"}
          ${hasBanner ? "top-10" : "top-0"}
        `}
      >
        {/* Header - Company Switcher */}
        <div
          className={`p-4 flex items-center border-b border-slate-700/50 ${
            isCollapsed ? "justify-center" : "justify-between"
          }`}
        >
          {!isCollapsed ? (
            <div className="flex items-center gap-3 flex-1 min-w-0" ref={dropdownRef}>
              {showClientSwitcher ? (
                <div className="relative flex-1 min-w-0">
                  <button
                    onClick={() => setClientDropdownOpen(!clientDropdownOpen)}
                    className="flex items-center gap-3 w-full hover:bg-white/5 rounded-lg p-1 -m-1 transition-colors"
                  >
                    <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">
                        {companyName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-semibold text-white truncate">{companyName}</p>
                      <p className="text-xs text-slate-400">Client Portal</p>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${
                        clientDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Client Dropdown */}
                  {clientDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-2 bg-slate-800 rounded-xl shadow-lg ring-1 ring-white/10 py-2 z-[100]">
                      <div className="px-3 py-2 border-b border-slate-700">
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
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
                                ${isSelected ? "bg-cyan-500/10" : "hover:bg-white/5"}
                              `}
                            >
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                  isSelected
                                    ? "bg-gradient-to-br from-cyan-500 to-teal-600"
                                    : "bg-slate-700"
                                }`}
                              >
                                <span
                                  className={`font-semibold text-sm ${
                                    isSelected ? "text-white" : "text-slate-300"
                                  }`}
                                >
                                  {access.client.company_name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-sm font-medium truncate ${
                                    isSelected ? "text-cyan-400" : "text-white"
                                  }`}
                                >
                                  {access.client.company_name}
                                </p>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${getRoleBadgeColor(
                                      access.role
                                    )}`}
                                  >
                                    {access.role.charAt(0).toUpperCase() + access.role.slice(1)}
                                  </span>
                                  {access.is_primary && (
                                    <span className="text-[10px] text-slate-500">Primary</span>
                                  )}
                                </div>
                              </div>
                              {isSelected && (
                                <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link href="/portal/dashboard" className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">
                      {companyName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{companyName}</p>
                    <p className="text-xs text-slate-400">Client Portal</p>
                  </div>
                </Link>
              )}
            </div>
          ) : (
            <Link
              href="/portal/dashboard"
              className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-lg flex items-center justify-center flex-shrink-0"
              title={companyName}
            >
              <span className="text-white font-bold text-sm">
                {companyName.charAt(0).toUpperCase()}
              </span>
            </Link>
          )}

          {/* Close button (mobile) */}
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 text-slate-400 hover:text-white md:hidden"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Collapse toggle (desktop) */}
          <button
            onClick={toggleCollapsed}
            className="hidden md:flex p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-md transition-colors"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <PanelLeft className="w-5 h-5" />
            ) : (
              <PanelLeftClose className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 overflow-y-auto">
          {navGroups.map((group, groupIndex) => (
            <div
              key={group.label || "top"}
              className={groupIndex > 0 ? "mt-4 pt-4 border-t border-slate-700/50" : "mt-2"}
            >
              {group.label && !isCollapsed && (
                <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  {group.label}
                </p>
              )}
              {isCollapsed && group.label && (
                <div className="mx-auto w-6 border-t border-slate-700 mb-2" />
              )}
              <ul className="space-y-0.5">
                {group.links.map((link) => {
                  const active = isActive(link.path);
                  const badge = getBadgeForLink(link);

                  return (
                    <li key={link.path}>
                      <Link
                        href={link.path}
                        className={`
                          flex items-center gap-3 rounded-md transition-colors group relative
                          ${isCollapsed ? "justify-center p-3" : "justify-between px-3 py-2"}
                          ${
                            active
                              ? "bg-cyan-500/15 text-white border-l-[3px] border-cyan-400"
                              : "text-slate-300 hover:bg-white/5 hover:text-white"
                          }
                        `}
                        title={isCollapsed ? link.label : undefined}
                      >
                        <div className={`flex items-center ${isCollapsed ? "" : "gap-3"}`}>
                          <link.icon className="w-5 h-5" />
                          {!isCollapsed && <span>{link.label}</span>}
                        </div>

                        {/* Badge (expanded) */}
                        {!isCollapsed && badge && (
                          <span
                            className={`px-2 py-0.5 text-xs font-medium ${badge.color} text-white rounded-full min-w-[20px] text-center`}
                          >
                            {badge.count > 99 ? "99+" : badge.count}
                          </span>
                        )}

                        {/* Badge dot (collapsed) */}
                        {isCollapsed && badge && (
                          <span
                            className={`absolute top-1 right-1 w-2 h-2 ${badge.color} rounded-full`}
                          />
                        )}

                        {/* Tooltip (collapsed) */}
                        {isCollapsed && (
                          <span className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                            {link.label}
                            {badge && (
                              <span
                                className={`ml-2 px-1.5 py-0.5 text-xs ${badge.color} rounded-full`}
                              >
                                {badge.count}
                              </span>
                            )}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-slate-700/50">
          <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"}`}>
            <div className="w-10 h-10 rounded-full bg-slate-700 ring-2 ring-cyan-500/30 flex items-center justify-center text-white font-medium flex-shrink-0">
              {companyName.charAt(0).toUpperCase()}
            </div>
            {!isCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{companyName}</p>
                  {currentRole && (
                    <span
                      className={`inline-block px-2 py-0.5 text-xs rounded-full ${getRoleBadgeColor(
                        currentRole
                      )}`}
                    >
                      {currentRole.charAt(0).toUpperCase() + currentRole.slice(1)}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="p-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
          {isCollapsed && (
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full mt-2 p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-md transition-colors group relative disabled:opacity-50"
              title="Logout"
            >
              <LogOut className="w-5 h-5 mx-auto" />
              <span className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                Logout
              </span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
