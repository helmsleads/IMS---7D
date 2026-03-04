import Link from "next/link";
import { ShoppingBag, TrendingUp, Calendar, PackageOpen } from "lucide-react";
import Card from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils/formatting";
import { SalesSummaryData } from "@/lib/api/dashboard";

interface Props {
  salesData: SalesSummaryData | null;
  loading?: boolean;
}

function MiniCard({
  icon,
  label,
  cases,
  revenue,
  bgColor,
  iconColor,
}: {
  icon: React.ReactNode;
  label: string;
  cases: number;
  revenue: number;
  bgColor: string;
  iconColor: string;
}) {
  return (
    <div className={`rounded-lg p-3 ${bgColor}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={iconColor}>{icon}</div>
        <span className="text-xs font-medium text-slate-600">{label}</span>
      </div>
      <p className="text-lg font-semibold text-slate-900">
        {cases.toLocaleString()} <span className="text-xs font-normal text-slate-500">cases</span>
      </p>
      <p className="text-sm text-slate-600">{formatCurrency(revenue, 0)}</p>
    </div>
  );
}

export default function SalesSummaryWidget({ salesData, loading }: Props) {
  if (loading || !salesData) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Sales Summary</h3>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg bg-slate-50 p-3 h-24 animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Sales Summary</h3>
        <Link href="/outbound" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
          View Orders
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MiniCard
          icon={<Calendar className="w-4 h-4" />}
          label="Current Month"
          cases={salesData.currentMonth.cases}
          revenue={salesData.currentMonth.revenue}
          bgColor="bg-blue-50"
          iconColor="text-blue-600"
        />
        <MiniCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Year to Date"
          cases={salesData.yearToDate.cases}
          revenue={salesData.yearToDate.revenue}
          bgColor="bg-green-50"
          iconColor="text-green-600"
        />
        <MiniCard
          icon={<ShoppingBag className="w-4 h-4" />}
          label="Last 12 Months"
          cases={salesData.last12Months.cases}
          revenue={salesData.last12Months.revenue}
          bgColor="bg-indigo-50"
          iconColor="text-indigo-600"
        />
        <MiniCard
          icon={<PackageOpen className="w-4 h-4" />}
          label="Open Orders"
          cases={salesData.openOrders.cases}
          revenue={salesData.openOrders.revenue}
          bgColor="bg-amber-50"
          iconColor="text-amber-600"
        />
      </div>
    </Card>
  );
}
