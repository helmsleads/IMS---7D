import Card from "@/components/ui/Card";
import { DaysOfSupplyItem } from "@/lib/api/dashboard";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

interface Props {
  supplyData: DaysOfSupplyItem[];
}

export default function DaysOfSupplyWidget({ supplyData }: Props) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Days of Supply</h3>
        <Link href="/inventory" className="text-sm text-indigo-600 hover:text-indigo-800">
          Inventory
        </Link>
      </div>
      {supplyData.length > 0 ? (
        <div className="space-y-3">
          {supplyData.slice(0, 8).map((item) => {
            const urgency = item.daysOfSupply <= 7 ? "critical" : item.daysOfSupply <= 14 ? "warning" : "ok";
            return (
              <div key={item.sku} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-900 truncate">{item.productName}</p>
                    {urgency === "critical" && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500">{item.sku} &middot; {item.qtyOnHand} units &middot; {item.avgDailyUsage}/day</p>
                </div>
                <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${
                  urgency === "critical" ? "bg-red-100 text-red-700" :
                  urgency === "warning" ? "bg-amber-100 text-amber-700" :
                  "bg-green-100 text-green-700"
                }`}>
                  {item.daysOfSupply}d
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-slate-500 text-sm text-center py-4">No usage data available</p>
      )}
    </Card>
  );
}
