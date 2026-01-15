import type { Metadata } from "next";
import "./globals.css";
import { SWRProvider } from "@/lib/swr-config";
import { ToastProvider } from "@/components/ui/Toast";
import { KeyboardShortcutsProvider } from "@/lib/keyboard-shortcuts";

export const metadata: Metadata = {
  title: {
    template: "%s | 7 Degrees",
    default: "7 Degrees Inventory Management",
  },
  description: "Inventory management system for 7 Degrees Co.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SWRProvider>
          <ToastProvider>
            <KeyboardShortcutsProvider>{children}</KeyboardShortcutsProvider>
          </ToastProvider>
        </SWRProvider>
      </body>
    </html>
  );
}
