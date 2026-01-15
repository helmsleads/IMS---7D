import { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Orders",
};

export default function PortalOrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
