import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Client Portal",
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
