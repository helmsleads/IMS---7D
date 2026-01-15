"use client";

import { useEffect } from "react";
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
  Users,
  BarChart3,
  LogOut,
  ExternalLink,
  Settings,
  X,
} from "lucide-react";

const navLinks = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Products", icon: Package, path: "/products" },
  { label: "Inventory", icon: Warehouse, path: "/inventory" },
  { label: "Locations", icon: MapPin, path: "/locations" },
  { label: "Inbound", icon: ArrowDownToLine, path: "/inbound" },
  { label: "Outbound", icon: ArrowUpFromLine, path: "/outbound" },
  { label: "Clients", icon: Users, path: "/clients" },
  { label: "Reports", icon: BarChart3, path: "/reports" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { isOpen, setIsOpen } = useMobileMenu();

  // Close sidebar on navigation
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

  const userEmail = user?.email || "";
  const userInitials = userEmail
    ? userEmail.substring(0, 2).toUpperCase()
    : "?";

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
          fixed left-0 top-0 h-full w-64 bg-slate-900 flex flex-col z-50
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
      >
      <div className="p-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">7 Degrees Co</h1>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 text-slate-400 hover:text-white md:hidden"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-4">
        <ul className="space-y-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.path || pathname.startsWith(link.path + "/");
            return (
              <li key={link.path}>
                <Link
                  href={link.path}
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-md transition-colors
                    ${
                      isActive
                        ? "bg-white text-slate-900"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }
                  `}
                >
                  <link.icon className="w-5 h-5" />
                  <span>{link.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* View Client Portal */}
        <div className="mt-6 pt-6 border-t border-slate-800">
          <Link
            href="/portal"
            target="_blank"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-blue-400 hover:bg-slate-800 hover:text-blue-300 transition-colors"
          >
            <ExternalLink className="w-5 h-5" />
            <span>View Client Portal</span>
          </Link>
        </div>
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-medium">
            {userInitials}
          </div>
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
        </div>
      </div>
    </aside>
    </>
  );
}
