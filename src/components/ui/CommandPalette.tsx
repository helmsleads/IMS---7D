"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  Package,
  Warehouse,
  MapPin,
  ArrowDownToLine,
  ArrowUpFromLine,
  Users,
  BarChart3,
  Settings,
  Plus,
  FileText,
  Command,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
  category: "navigation" | "action";
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const navigate = useCallback(
    (path: string) => {
      router.push(path);
      onClose();
    },
    [router, onClose]
  );

  const commands: CommandItem[] = [
    // Navigation
    {
      id: "nav-dashboard",
      label: "Go to Dashboard",
      icon: <LayoutDashboard className="w-5 h-5" />,
      action: () => navigate("/dashboard"),
      keywords: ["home", "overview", "stats"],
      category: "navigation",
    },
    {
      id: "nav-products",
      label: "Go to Products",
      icon: <Package className="w-5 h-5" />,
      action: () => navigate("/products"),
      keywords: ["items", "catalog", "sku"],
      category: "navigation",
    },
    {
      id: "nav-inventory",
      label: "Go to Inventory",
      icon: <Warehouse className="w-5 h-5" />,
      action: () => navigate("/inventory"),
      keywords: ["stock", "warehouse", "quantity"],
      category: "navigation",
    },
    {
      id: "nav-locations",
      label: "Go to Locations",
      icon: <MapPin className="w-5 h-5" />,
      action: () => navigate("/locations"),
      keywords: ["warehouse", "facility", "sites"],
      category: "navigation",
    },
    {
      id: "nav-inbound",
      label: "Go to Inbound Orders",
      icon: <ArrowDownToLine className="w-5 h-5" />,
      action: () => navigate("/inbound"),
      keywords: ["receiving", "incoming", "shipments"],
      category: "navigation",
    },
    {
      id: "nav-outbound",
      label: "Go to Outbound Orders",
      icon: <ArrowUpFromLine className="w-5 h-5" />,
      action: () => navigate("/outbound"),
      keywords: ["shipping", "fulfillment", "dispatch"],
      category: "navigation",
    },
    {
      id: "nav-clients",
      label: "Go to Clients",
      icon: <Users className="w-5 h-5" />,
      action: () => navigate("/clients"),
      keywords: ["customers", "accounts", "companies"],
      category: "navigation",
    },
    {
      id: "nav-reports",
      label: "Go to Reports",
      icon: <BarChart3 className="w-5 h-5" />,
      action: () => navigate("/reports"),
      keywords: ["analytics", "data", "charts"],
      category: "navigation",
    },
    {
      id: "nav-settings",
      label: "Go to Settings",
      icon: <Settings className="w-5 h-5" />,
      action: () => navigate("/settings"),
      keywords: ["preferences", "config", "options"],
      category: "navigation",
    },
    // Quick Actions
    {
      id: "action-new-product",
      label: "New Product",
      description: "Create a new product",
      icon: <Plus className="w-5 h-5" />,
      action: () => navigate("/products?new=true"),
      keywords: ["add", "create", "product"],
      category: "action",
    },
    {
      id: "action-new-inbound",
      label: "New Inbound Order",
      description: "Create receiving order",
      icon: <ArrowDownToLine className="w-5 h-5" />,
      action: () => navigate("/inbound/new"),
      keywords: ["add", "create", "receiving", "shipment"],
      category: "action",
    },
    {
      id: "action-new-outbound",
      label: "New Outbound Order",
      description: "Create shipping order",
      icon: <ArrowUpFromLine className="w-5 h-5" />,
      action: () => navigate("/outbound/new"),
      keywords: ["add", "create", "shipping", "fulfillment"],
      category: "action",
    },
    {
      id: "action-new-client",
      label: "New Client",
      description: "Add a new client",
      icon: <Users className="w-5 h-5" />,
      action: () => navigate("/clients?new=true"),
      keywords: ["add", "create", "customer", "account"],
      category: "action",
    },
    {
      id: "action-low-stock",
      label: "Low Stock Report",
      description: "View items below reorder point",
      icon: <FileText className="w-5 h-5" />,
      action: () => navigate("/reports/low-stock"),
      keywords: ["report", "reorder", "shortage"],
      category: "action",
    },
  ];

  const filteredCommands = commands.filter((cmd) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(searchLower) ||
      cmd.description?.toLowerCase().includes(searchLower) ||
      cmd.keywords?.some((k) => k.toLowerCase().includes(searchLower))
    );
  });

  const groupedCommands = {
    action: filteredCommands.filter((c) => c.category === "action"),
    navigation: filteredCommands.filter((c) => c.category === "navigation"),
  };

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = listRef.current?.querySelector(
      `[data-index="${selectedIndex}"]`
    );
    selectedElement?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, onClose]);

  if (!isOpen) return null;

  let flatIndex = -1;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden mx-4">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search commands..."
            className="flex-1 text-gray-900 placeholder-gray-400 outline-none text-base"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-400 bg-gray-100 rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              No results found for "{search}"
            </div>
          ) : (
            <>
              {/* Quick Actions */}
              {groupedCommands.action.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Quick Actions
                  </div>
                  {groupedCommands.action.map((cmd) => {
                    flatIndex++;
                    const index = flatIndex;
                    return (
                      <button
                        key={cmd.id}
                        data-index={index}
                        onClick={cmd.action}
                        className={`
                          w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                          ${
                            selectedIndex === index
                              ? "bg-blue-50 text-blue-900"
                              : "text-gray-700 hover:bg-gray-50"
                          }
                        `}
                      >
                        <span
                          className={
                            selectedIndex === index
                              ? "text-blue-600"
                              : "text-gray-400"
                          }
                        >
                          {cmd.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{cmd.label}</p>
                          {cmd.description && (
                            <p className="text-sm text-gray-500 truncate">
                              {cmd.description}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Navigation */}
              {groupedCommands.navigation.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Navigation
                  </div>
                  {groupedCommands.navigation.map((cmd) => {
                    flatIndex++;
                    const index = flatIndex;
                    return (
                      <button
                        key={cmd.id}
                        data-index={index}
                        onClick={cmd.action}
                        className={`
                          w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                          ${
                            selectedIndex === index
                              ? "bg-blue-50 text-blue-900"
                              : "text-gray-700 hover:bg-gray-50"
                          }
                        `}
                      >
                        <span
                          className={
                            selectedIndex === index
                              ? "text-blue-600"
                              : "text-gray-400"
                          }
                        >
                          {cmd.icon}
                        </span>
                        <span className="font-medium">{cmd.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-gray-600">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-gray-600">↓</kbd>
              <span className="ml-1">Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-gray-600">↵</kbd>
              <span className="ml-1">Select</span>
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Command className="w-3 h-3" />K to open
          </span>
        </div>
      </div>
    </div>
  );
}
