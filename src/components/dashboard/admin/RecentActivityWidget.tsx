import Card from "@/components/ui/Card";
import Link from "next/link";
import {
  Plus,
  Truck,
  PackageCheck,
  Trash2,
  FileText,
} from "lucide-react";

interface RecentActivity {
  id: string;
  action: string;
  entity_type: string;
  details: Record<string, string>;
  user_email: string | null;
  created_at: string;
}

function ActivityIcon({ action }: { action: string }) {
  const map: Record<string, { icon: React.ReactNode; bg: string }> = {
    created:  { icon: <Plus className="w-3 h-3" />, bg: "bg-green-500 text-white" },
    shipped:  { icon: <Truck className="w-3 h-3" />, bg: "bg-purple-500 text-white" },
    received: { icon: <PackageCheck className="w-3 h-3" />, bg: "bg-blue-500 text-white" },
    deleted:  { icon: <Trash2 className="w-3 h-3" />, bg: "bg-red-500 text-white" },
  };
  const entry = map[action] || { icon: <FileText className="w-3 h-3" />, bg: "bg-slate-400 text-white" };

  return (
    <div className={`w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-white ${entry.bg}`}>
      {entry.icon}
    </div>
  );
}

const ACTION_MAP: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  deleted: "Deleted",
  status_changed: "Status changed",
  stock_adjustment: "Stock adjusted",
  shipped: "Shipped",
  received: "Received",
};

const ENTITY_MAP: Record<string, string> = {
  product: "Product",
  client: "Client",
  inbound_order: "Inbound Order",
  outbound_order: "Outbound Order",
  inventory: "Inventory",
  outbound_item: "Outbound Item",
  inbound_item: "Inbound Item",
};

interface Props {
  recentActivity: RecentActivity[];
}

export default function RecentActivityWidget({ recentActivity }: Props) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Recent Activity</h3>
        {recentActivity.length > 0 && (
          <Link
            href="/activity"
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            View All
          </Link>
        )}
      </div>
      {recentActivity.length === 0 ? (
        <p className="text-slate-500 text-sm">No recent activity.</p>
      ) : (
        <div className="relative">
          <div className="absolute left-[11px] top-3 bottom-3 w-px bg-slate-200" />
          <div className="space-y-4">
            {recentActivity.slice(0, 8).map((activity) => {
              const details = activity.details as Record<string, string>;
              const identifier = details?.order_number || details?.po_number || details?.sku || details?.company_name || details?.name || "";
              const activityUserName = activity.user_email?.split("@")[0] || "System";

              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 text-sm relative"
                >
                  <ActivityIcon action={activity.action} />
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-slate-900">
                      {ENTITY_MAP[activity.entity_type] || activity.entity_type}{" "}
                      {identifier && (
                        <span className="font-medium">{identifier}</span>
                      )}{" "}
                      <span className="text-slate-500">
                        {(ACTION_MAP[activity.action] || activity.action).toLowerCase()}
                      </span>
                      {activityUserName !== "System" && (
                        <span className="text-slate-500"> by {activityUserName}</span>
                      )}
                    </p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {new Date(activity.created_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
