import Card from "@/components/ui/Card";
import Link from "next/link";
import { PackageCheck } from "lucide-react";
import { formatDate } from "@/lib/utils/formatting";

interface RecentArrival {
  id: string;
  order_number: string;
  received_at: string;
  product_summary: string;
}

interface Props {
  recentArrivalsList: RecentArrival[];
}

export default function RecentArrivalsWidget({ recentArrivalsList }: Props) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Recent Arrivals</h2>
        <Link
          href="/portal/inventory"
          className="text-sm text-cyan-600 hover:text-cyan-700 font-medium"
        >
          View All
        </Link>
      </div>

      {recentArrivalsList.length > 0 ? (
        <div className="space-y-3">
          {recentArrivalsList.map((arrival) => (
            <div
              key={arrival.id}
              className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0"
            >
              <div>
                <p className="font-medium text-slate-900">{arrival.order_number}</p>
                <p className="text-sm text-slate-500">{arrival.product_summary}</p>
              </div>
              <span className="text-sm text-slate-400">
                {formatDate(arrival.received_at)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-500">
          <PackageCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>No recent arrivals</p>
          <p className="text-sm mt-1">
            Inbound shipments will appear here
          </p>
        </div>
      )}
    </Card>
  );
}
