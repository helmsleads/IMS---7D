import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portal Dashboard",
};

export default function PortalDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
