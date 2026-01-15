import { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Inventory",
};

export default function PortalInventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
