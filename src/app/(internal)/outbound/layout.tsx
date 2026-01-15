import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Outbound Orders",
};

export default function OutboundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
