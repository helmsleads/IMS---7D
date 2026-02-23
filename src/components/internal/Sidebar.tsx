"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useMobileMenu } from "@/lib/mobile-menu-context";
import { signOut } from "@/lib/auth";
import {
  LayoutDashboard,
  Package,
  Warehouse,
  MapPin,
  ArrowDownToLine,
  ArrowUpFromLine,
  RotateCcw,
  Users,
  UserCog,
  MessageSquare,
  BarChart3,
  LogOut,
  ExternalLink,
  Settings,
  X,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Layers,
  CreditCard,
  Box,
  AlertTriangle,
  ClipboardList,
  CheckSquare,
  FolderTree,
  PanelLeftClose,
  PanelLeft,
  Building2,
  ClipboardCheck,
  ShieldCheck,
  ListChecks,
} from "lucide-react";
import { getUnreadCount } from "@/lib/api/messages";
import { getPendingChecklistsCount } from "@/lib/api/checklists";
import { getPendingTaskCount } from "@/lib/api/warehouse-tasks";

interface NavLink {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  badgeKey?: string;
  children?: { label: string; path: string; icon?: React.ComponentType<{ className?: string }> }[];
}

interface NavGroup {
  label: string;
  links: NavLink[];
}

const navGroups: NavGroup[] = [
  {
    label: "",
    links: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    ],
  },
  {
    label: "Operations",
    links: [
      { label: "Inbound", icon: ArrowDownToLine, path: "/inbound" },
      { label: "Outbound", icon: ArrowUpFromLine, path: "/outbound" },
      { label: "Returns", icon: RotateCcw, path: "/returns" },
      { label: "Damage Reports", icon: AlertTriangle, path: "/damage-reports" },
      {
        label: "Tasks",
        icon: ClipboardCheck,
        path: "/tasks",
        badgeKey: "tasks",
        children: [
          { label: "All Tasks", path: "/tasks", icon: ClipboardCheck },
          { label: "Inspection", path: "/tasks/inspection", icon: ShieldCheck },
          { label: "Putaway", path: "/tasks/putaway", icon: ArrowDownToLine },
          { label: "Pick Lists", path: "/tasks/pick", icon: ListChecks },
        ],
      },
    ],
  },
  {
    label: "Warehouse",
    links: [
      {
        label: "Products",
        icon: Package,
        path: "/products",
        children: [
          { label: "All Products", path: "/products", icon: Package },
          { label: "Categories", path: "/products/categories", icon: FolderTree },
        ],
      },
      {
        label: "Inventory",
        icon: Warehouse,
        path: "/inventory",
        children: [
          { label: "All Inventory", path: "/inventory", icon: Warehouse },
          { label: "Pallet Breakdown", path: "/inventory/pallet-breakdown", icon: Package },
        ],
      },
      { label: "Lots", icon: Layers, path: "/lots" },
      { label: "Locations", icon: MapPin, path: "/locations" },
      { label: "Cycle Counts", icon: ClipboardList, path: "/cycle-counts" },
    ],
  },
  {
    label: "Management",
    links: [
      {
        label: "Clients",
        icon: Building2,
        path: "/clients",
        children: [
          { label: "All Clients", path: "/clients", icon: Building2 },
          { label: "Portal Users", path: "/clients/users", icon: UserCog },
        ],
      },
      {
        label: "Services",
        icon: Briefcase,
        path: "/services",
        children: [
          { label: "All Services", path: "/services", icon: Briefcase },
          { label: "Service Tiers", path: "/services/tiers", icon: Layers },
        ],
      },
      { label: "Billing", icon: CreditCard, path: "/billing" },
      { label: "Supplies", icon: Box, path: "/supplies" },
    ],
  },
  {
    label: "Other",
    links: [
      { label: "Messages", icon: MessageSquare, path: "/messages", badgeKey: "messages" },
      { label: "Checklists", icon: CheckSquare, path: "/checklists", badgeKey: "checklists" },
      { label: "Reports", icon: BarChart3, path: "/reports" },
      { label: "Settings", icon: Settings, path: "/settings" },
    ],
  },
];

// Flatten for auto-expand logic
const navLinks: NavLink[] = navGroups.flatMap((g) => g.links);

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { isOpen, setIsOpen } = useMobileMenu();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [pendingChecklists, setPendingChecklists] = useState(0);
  const [pendingTasks, setPendingTasks] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored === "true") {
      setIsCollapsed(true);
    }
  }, []);

  // Save collapsed state to localStorage
  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newState));
    // Dispatch event so AppShell can listen
    window.dispatchEvent(new CustomEvent("sidebar-toggle", { detail: { collapsed: newState } }));
  };

  // Fetch unread message count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const count = await getUnreadCount();
        setUnreadMessages(count);
      } catch (err) {
        console.error("Failed to fetch unread count:", err);
      }
    };

    // Fetch immediately
    fetchUnreadCount();

    // Poll every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(interval);
  }, []);

  // Fetch pending checklists count
  useEffect(() => {
    const fetchPendingChecklists = async () => {
      try {
        const count = await getPendingChecklistsCount();
        setPendingChecklists(count);
      } catch (err) {
        console.error("Failed to fetch pending checklists count:", err);
      }
    };

    // Fetch immediately
    fetchPendingChecklists();

    // Poll every 60 seconds
    const interval = setInterval(fetchPendingChecklists, 60000);

    return () => clearInterval(interval);
  }, []);

  // Fetch pending tasks count
  useEffect(() => {
    const fetchPendingTasks = async () => {
      try {
        const count = await getPendingTaskCount();
        setPendingTasks(count);
      } catch (err) {
        console.error("Failed to fetch pending tasks count:", err);
      }
    };

    fetchPendingTasks();
    const interval = setInterval(fetchPendingTasks, 60000);
    return () => clearInterval(interval);
  }, []);

  // Auto-expand parent items based on current path
  useEffect(() => {
    navLinks.forEach((link) => {
      if (link.children) {
        const isChildActive = link.children.some(
          (child) => pathname === child.path || pathname.startsWith(child.path + "/")
        );
        if (isChildActive && !expandedItems.includes(link.path)) {
          setExpandedItems((prev) => [...prev, link.path]);
        }
      }
    });
  }, [pathname]);

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    setIsOpen(false);
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
    await signOut();
    router.push("/login");
  };

  const toggleExpanded = (path: string) => {
    if (isCollapsed) return; // Don't expand when collapsed
    setExpandedItems((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const userEmail = user?.email || "";
  const userInitials = userEmail
    ? userEmail.substring(0, 2).toUpperCase()
    : "?";

  const isLinkActive = (link: NavLink) => {
    if (link.children) {
      return link.children.some(
        (child) => pathname === child.path || pathname.startsWith(child.path + "/")
      );
    }
    return pathname === link.path || pathname.startsWith(link.path + "/");
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 h-full bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 flex flex-col z-50
          transform transition-all duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
          ${isCollapsed ? "w-[72px]" : "w-64"}
        `}
      >
        {/* Header */}
        <div className={`p-4 flex items-center border-b border-slate-700/50 ${isCollapsed ? "justify-center" : "justify-between"}`}>
          {!isCollapsed && (
            <h1 className="text-xl font-bold text-white">7 Degrees Co</h1>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 text-slate-400 hover:text-white md:hidden"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
          {/* Collapse toggle - desktop only */}
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

        <nav className="flex-1 px-2 overflow-y-auto">
          {navGroups.map((group, groupIndex) => (
            <div key={group.label || "top"} className={groupIndex > 0 ? "mt-4 pt-4 border-t border-slate-700/50" : ""}>
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
                  const isActive = isLinkActive(link);
                  const isExpanded = expandedItems.includes(link.path) && !isCollapsed;
                  const hasChildren = link.children && link.children.length > 0;

                  return (
                    <li key={link.path}>
                      {hasChildren ? (
                        <>
                          {isCollapsed ? (
                            <Link
                              href={link.path}
                              className={`
                                flex items-center justify-center p-3 rounded-md transition-colors group relative
                                ${
                                  isActive
                                    ? "bg-indigo-500/15 text-white border-l-[3px] border-indigo-400"
                                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                                }
                              `}
                              title={link.label}
                            >
                              <link.icon className="w-5 h-5" />
                              <span className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                                {link.label}
                              </span>
                            </Link>
                          ) : (
                            <>
                              <button
                                onClick={() => toggleExpanded(link.path)}
                                className={`
                                  w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md transition-colors
                                  ${
                                    isActive
                                      ? "bg-indigo-500/15 text-white border-l-[3px] border-indigo-400"
                                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                                  }
                                `}
                              >
                                <div className="flex items-center gap-3">
                                  <link.icon className="w-5 h-5" />
                                  <span>{link.label}</span>
                                </div>
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                              {isExpanded && (
                                <ul className="mt-1 ml-4 space-y-0.5">
                                  {link.children!.map((child) => {
                                    const isChildActive =
                                      pathname === child.path ||
                                      (child.path !== "/services" && child.path !== "/products" && child.path !== "/inventory" && pathname.startsWith(child.path + "/"));
                                    const ChildIcon = child.icon;
                                    return (
                                      <li key={child.path}>
                                        <Link
                                          href={child.path}
                                          className={`
                                            flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm
                                            ${
                                              isChildActive
                                                ? "bg-indigo-500/10 text-indigo-300 border-l-2 border-indigo-400"
                                                : "text-slate-400 hover:bg-white/5 hover:text-white"
                                            }
                                          `}
                                        >
                                          {ChildIcon && <ChildIcon className="w-4 h-4" />}
                                          <span>{child.label}</span>
                                        </Link>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <Link
                          href={link.path}
                          className={`
                            flex items-center gap-3 rounded-md transition-colors group relative
                            ${isCollapsed ? "justify-center p-3" : "justify-between px-3 py-2"}
                            ${
                              isActive
                                ? "bg-indigo-500/15 text-white border-l-[3px] border-indigo-400"
                                : "text-slate-300 hover:bg-white/5 hover:text-white"
                            }
                          `}
                          title={isCollapsed ? link.label : undefined}
                        >
                          <div className={`flex items-center ${isCollapsed ? "" : "gap-3"}`}>
                            <link.icon className="w-5 h-5" />
                            {!isCollapsed && <span>{link.label}</span>}
                          </div>
                          {!isCollapsed && link.badgeKey === "messages" && unreadMessages > 0 && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-indigo-500 text-white rounded-full min-w-[20px] text-center">
                              {unreadMessages > 99 ? "99+" : unreadMessages}
                            </span>
                          )}
                          {!isCollapsed && link.badgeKey === "checklists" && pendingChecklists > 0 && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-amber-500 text-white rounded-full min-w-[20px] text-center">
                              {pendingChecklists > 99 ? "99+" : pendingChecklists}
                            </span>
                          )}
                          {!isCollapsed && link.badgeKey === "tasks" && pendingTasks > 0 && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-indigo-500 text-white rounded-full min-w-[20px] text-center">
                              {pendingTasks > 99 ? "99+" : pendingTasks}
                            </span>
                          )}
                          {isCollapsed && link.badgeKey === "messages" && unreadMessages > 0 && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-indigo-500 rounded-full" />
                          )}
                          {isCollapsed && link.badgeKey === "checklists" && pendingChecklists > 0 && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full" />
                          )}
                          {isCollapsed && link.badgeKey === "tasks" && pendingTasks > 0 && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-indigo-500 rounded-full" />
                          )}
                          {isCollapsed && (
                            <span className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                              {link.label}
                            </span>
                          )}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {/* View Client Portal */}
          <div className="mt-6 pt-6 border-t border-slate-700/50">
            <Link
              href="/portal"
              target="_blank"
              className={`
                flex items-center rounded-md text-indigo-400 hover:bg-white/5 hover:text-indigo-300 transition-colors group relative
                ${isCollapsed ? "justify-center p-3" : "gap-3 px-3 py-2"}
              `}
              title={isCollapsed ? "View Client Portal" : undefined}
            >
              <ExternalLink className="w-5 h-5" />
              {!isCollapsed && <span>View Client Portal</span>}
              {/* Tooltip when collapsed */}
              {isCollapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                  View Client Portal
                </span>
              )}
            </Link>
          </div>
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-slate-700/50">
          <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"}`}>
            <div className="w-10 h-10 rounded-full bg-slate-700 ring-2 ring-indigo-500/30 flex items-center justify-center text-white font-medium flex-shrink-0">
              {userInitials}
            </div>
            {!isCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{userEmail}</p>
                  <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-300">
                    Admin
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
          {/* Logout button when collapsed */}
          {isCollapsed && (
            <button
              onClick={handleLogout}
              className="w-full mt-2 p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-md transition-colors group relative"
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
