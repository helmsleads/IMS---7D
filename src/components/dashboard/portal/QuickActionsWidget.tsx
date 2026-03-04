import Card from "@/components/ui/Card";
import Link from "next/link";
import { Truck, Package, CalendarCheck } from "lucide-react";

export default function QuickActionsWidget() {
  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
      <div className="space-y-3">
        <Link
          href="/portal/arrivals?tab=schedule"
          className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50 transition-all group"
        >
          <div className="p-3 bg-slate-100 rounded-xl group-hover:bg-slate-200 transition-colors">
            <CalendarCheck className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <p className="font-medium text-slate-900">Book Dock Appointment</p>
            <p className="text-sm text-slate-500">Schedule an inbound delivery</p>
          </div>
        </Link>

        <Link
          href="/portal/inventory"
          className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50 transition-all group"
        >
          <div className="p-3 bg-slate-100 rounded-xl group-hover:bg-slate-200 transition-colors">
            <Package className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <p className="font-medium text-slate-900">View Inventory</p>
            <p className="text-sm text-slate-500">Check your current stock levels</p>
          </div>
        </Link>

        <Link
          href="/portal/request-shipment"
          className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50 transition-all group"
        >
          <div className="p-3 bg-slate-100 rounded-xl group-hover:bg-slate-200 transition-colors">
            <Truck className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <p className="font-medium text-slate-900">Request Shipment</p>
            <p className="text-sm text-slate-500">Create a new outbound order</p>
          </div>
        </Link>
      </div>
    </Card>
  );
}
