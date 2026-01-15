"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import CommandPalette from "@/components/ui/CommandPalette";

interface KeyboardShortcutsContextType {
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  isCommandPaletteOpen: boolean;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | undefined>(
  undefined
);

// Map paths to their "new" action routes
const NEW_ACTION_ROUTES: Record<string, string> = {
  "/products": "/products?new=true",
  "/clients": "/clients?new=true",
  "/inbound": "/inbound/new",
  "/outbound": "/outbound/new",
  "/locations": "/locations?new=true",
  "/inventory": "/inventory?new=true",
};

export function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const openCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(true);
  }, []);

  const closeCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(false);
  }, []);

  // Get the "new" route for the current path
  const getNewRoute = useCallback(() => {
    // Check exact match first
    if (NEW_ACTION_ROUTES[pathname]) {
      return NEW_ACTION_ROUTES[pathname];
    }
    // Check if current path starts with any of the base paths
    for (const [basePath, newRoute] of Object.entries(NEW_ACTION_ROUTES)) {
      if (pathname.startsWith(basePath)) {
        return newRoute;
      }
    }
    return null;
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Cmd/Ctrl + K: Open command palette (works even in inputs)
      if (modifier && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((open) => !open);
        return;
      }

      // Skip other shortcuts if in input
      if (isInput) return;

      // Cmd/Ctrl + N: Context-dependent new action
      if (modifier && e.key === "n") {
        const newRoute = getNewRoute();
        if (newRoute) {
          e.preventDefault();
          router.push(newRoute);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [getNewRoute, router]);

  return (
    <KeyboardShortcutsContext.Provider
      value={{
        openCommandPalette,
        closeCommandPalette,
        isCommandPaletteOpen,
      }}
    >
      {children}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={closeCommandPalette}
      />
    </KeyboardShortcutsContext.Provider>
  );
}

export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error(
      "useKeyboardShortcuts must be used within a KeyboardShortcutsProvider"
    );
  }
  return context;
}
