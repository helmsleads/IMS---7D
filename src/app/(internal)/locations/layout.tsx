import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Locations",
};

export default function LocationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
