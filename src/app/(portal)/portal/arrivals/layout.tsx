import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Expected Arrivals",
};

export default function PortalArrivalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
