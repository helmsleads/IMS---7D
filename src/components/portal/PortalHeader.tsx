"use client";

import { Menu } from "lucide-react";
import { useMobileMenu } from "@/lib/mobile-menu-context";

export default function PortalHeader() {
  const { toggle } = useMobileMenu();

  return (
    <header className="bg-white border-b border-slate-200 px-4 py-3 md:hidden">
      <div className="flex items-center justify-between">
        {/* Hamburger */}
        <button
          onClick={toggle}
          className="p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Centered Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">7D</span>
          </div>
          <span className="text-lg font-bold text-slate-900">7 Degrees</span>
        </div>

        {/* Spacer for centering */}
        <div className="w-10" />
      </div>
    </header>
  );
}
