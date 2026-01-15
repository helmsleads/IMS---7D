"use client";

import { Package, Users, DollarSign, AlertTriangle, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Card from "@/components/ui/Card";
import Link from "next/link";

interface ReportCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
}

const reports: ReportCard[] = [
  {
    id: "inventory-summary",
    title: "Inventory Summary",
    description: "Current stock levels by product and location with quantity on hand and reserved",
    icon: <Package className="w-6 h-6" />,
    href: "/reports/inventory-summary",
    color: "bg-blue-100 text-blue-600",
  },
  {
    id: "inventory-valuation",
    title: "Inventory Valuation",
    description: "Total inventory value breakdown by product, client, and warehouse location",
    icon: <DollarSign className="w-6 h-6" />,
    href: "/reports/inventory-valuation",
    color: "bg-green-100 text-green-600",
  },
  {
    id: "low-stock",
    title: "Low Stock Report",
    description: "Products currently at or below their reorder point requiring attention",
    icon: <AlertTriangle className="w-6 h-6" />,
    href: "/reports/low-stock",
    color: "bg-red-100 text-red-600",
  },
  {
    id: "order-history",
    title: "Order History",
    description: "Complete history of outbound orders with status, dates, and client details",
    icon: <ArrowUpFromLine className="w-6 h-6" />,
    href: "/reports/order-history",
    color: "bg-purple-100 text-purple-600",
  },
  {
    id: "inbound-history",
    title: "Inbound History",
    description: "Complete history of inbound purchase orders with supplier and receiving details",
    icon: <ArrowDownToLine className="w-6 h-6" />,
    href: "/reports/inbound-history",
    color: "bg-cyan-100 text-cyan-600",
  },
  {
    id: "client-activity",
    title: "Client Activity",
    description: "Order volume, inventory holdings, and activity summary by client",
    icon: <Users className="w-6 h-6" />,
    href: "/reports/client-activity",
    color: "bg-amber-100 text-amber-600",
  },
];

export default function ReportsPage() {
  return (
    <AppShell
      title="Reports"
      subtitle="Generate and view warehouse reports"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report) => (
          <Link
            key={report.id}
            href={report.href}
            className="block h-full hover:shadow-md transition-shadow rounded-lg"
          >
            <Card>
              <div className="flex flex-col">
                <div className={`w-12 h-12 rounded-lg ${report.color} flex items-center justify-center mb-4`}>
                  {report.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {report.title}
                </h3>
                <p className="text-sm text-gray-500">
                  {report.description}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
