"use client";

import { Menu } from "lucide-react";
import { useMobileMenu } from "@/lib/mobile-menu-context";
import { BrandLogo } from "@/components/BrandLogo";

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
        <div className="flex items-center">
          <BrandLogo variant="horizontal" width={148} height={29} className="h-7 w-auto" />
        </div>

        {/* Spacer for centering */}
        <div className="w-10" />
      </div>
    </header>
  );
}
