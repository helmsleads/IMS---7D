import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SWRProvider } from "@/lib/swr-config";
import { ToastProvider } from "@/components/ui/Toast";
import { KeyboardShortcutsProvider } from "@/lib/keyboard-shortcuts";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

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
    <html lang="en" className={`${inter.className} antialiased`} style={{ fontFeatureSettings: "'cv02', 'cv03', 'cv04', 'cv11'" }}>
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
