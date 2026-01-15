import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inbound Orders",
};

export default function InboundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
