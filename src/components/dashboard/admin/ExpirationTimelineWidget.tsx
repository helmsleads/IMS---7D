import Card from "@/components/ui/Card";
import { ExpirationTimelineItem } from "@/lib/api/dashboard";
import { Clock } from "lucide-react";
import Link from "next/link";

interface Props {
  timelineData: ExpirationTimelineItem[];
}

function getBarColor(days: number): string {
  if (days < 30) return "bg-red-500";
  if (days < 60) return "bg-amber-500";
  return "bg-emerald-500";
}

function getBarColorHex(days: number): string {
  if (days < 30) return "#EF4444";
  if (days < 60) return "#F59E0B";
  return "#10B981";
}

export default function ExpirationTimelineWidget({ timelineData }: Props) {
  const items = timelineData.slice(0, 8);
  const maxDays = 180;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Expiration Timeline</h3>
        <Link href="/lots" className="text-sm text-indigo-600 hover:text-indigo-800">
          Lots
        </Link>
      </div>
      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item, idx) => {
            const widthPercent = Math.min(
              Math.max((item.daysUntilExpiry / maxDays) * 100, 4),
              100
            );
            const expDate = new Date(item.expirationDate).toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric" }
            );

            return (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-36 flex-shrink-0 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {item.productName}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {item.lotNumber}
                  </p>
                </div>
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full ${getBarColor(item.daysUntilExpiry)} transition-all duration-500`}
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                  <div className="flex-shrink-0 text-right min-w-[72px]">
                    <span
                      className="text-xs font-medium"
                      style={{ color: getBarColorHex(item.daysUntilExpiry) }}
                    >
                      {item.daysUntilExpiry}d
                    </span>
                    <span className="text-xs text-slate-400 ml-1">{expDate}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <Clock className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 text-sm">No upcoming expirations</p>
        </div>
      )}
    </Card>
  );
}
