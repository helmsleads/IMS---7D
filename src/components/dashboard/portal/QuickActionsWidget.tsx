import Card from "@/components/ui/Card";
import Link from "next/link";
import { Truck, Package, ClipboardList } from "lucide-react";

export default function QuickActionsWidget() {
  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
      <div className="space-y-3">
        <Link
          href="/portal/request-shipment"
          className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50 transition-all group"
        >
          <div className="p-3 bg-cyan-100 rounded-xl group-hover:bg-cyan-200 transition-colors">
            <Truck className="w-5 h-5 text-cyan-600" />
          </div>
          <div>
            <p className="font-medium text-slate-900">Request Shipment</p>
            <p className="text-sm text-slate-500">Create a new outbound order</p>
          </div>
        </Link>

        <Link
          href="/portal/inventory"
          className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50 transition-all group"
        >
          <div className="p-3 bg-green-100 rounded-xl group-hover:bg-green-200 transition-colors">
            <Package className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-slate-900">View Inventory</p>
            <p className="text-sm text-slate-500">Check your current stock levels</p>
          </div>
        </Link>

        <Link
          href="/portal/orders"
          className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50 transition-all group"
        >
          <div className="p-3 bg-purple-100 rounded-xl group-hover:bg-purple-200 transition-colors">
            <ClipboardList className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="font-medium text-slate-900">Track Orders</p>
            <p className="text-sm text-slate-500">View order status and history</p>
          </div>
        </Link>
      </div>
    </Card>
  );
}
