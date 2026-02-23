"use client";

import { ReactNode, useState, useRef, useEffect } from "react";
import { Menu, MoreVertical, Search, Command } from "lucide-react";
import { useMobileMenu } from "@/lib/mobile-menu-context";
import { useKeyboardShortcuts } from "@/lib/keyboard-shortcuts";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function Header({
  title,
  subtitle,
  actions,
}: HeaderProps) {
  const { toggle } = useMobileMenu();
  const { openCommandPalette } = useKeyboardShortcuts();
  const [actionsOpen, setActionsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4">
      {/* Mobile Header */}
      <div className="flex md:hidden items-center justify-between">
        {/* Hamburger */}
        <button
          onClick={toggle}
          className="p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Centered Logo */}
        <span className="text-lg font-bold text-slate-900">7 Degrees</span>

        {/* Search + Actions */}
        <div className="flex items-center">
          <button
            onClick={openCommandPalette}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>
          {/* Actions Dropdown */}
          {actions && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setActionsOpen(!actionsOpen)}
                className="p-2 -mr-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                aria-label="Actions menu"
              >
                <MoreVertical className="w-6 h-6" />
              </button>
              {actionsOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg ring-1 ring-black/5 py-2 z-50">
                  <div
                    className="px-3 py-2 flex flex-col gap-2"
                    onClick={() => setActionsOpen(false)}
                  >
                    {actions}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Title (below header bar) */}
      <div className="md:hidden mt-4">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && (
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        )}
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          {subtitle && (
            <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* Quick Search Button */}
          <button
            onClick={openCommandPalette}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg ring-1 ring-slate-200/50 transition-colors"
          >
            <Search className="w-4 h-4" />
            <span>Search</span>
            <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium text-slate-400 bg-white border border-slate-300 rounded">
              <Command className="w-3 h-3" />K
            </kbd>
          </button>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>
    </header>
  );
}
