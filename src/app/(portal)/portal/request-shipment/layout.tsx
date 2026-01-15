import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Request Shipment",
};

export default function RequestShipmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
