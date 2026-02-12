import Card from "@/components/ui/Card";
import Link from "next/link";
import { TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatting";

interface MonthlyProfitability {
  netProfit: number;
  totalRevenue: number;
  totalCost: number;
  marginPercentage: number;
  orderCount: number;
  unitsSold: number;
}

interface Props {
  profitability: MonthlyProfitability;
}

export default function ProfitabilityWidget({ profitability }: Props) {
  return (
    <Card accent={profitability.netProfit >= 0 ? "green" : "red"}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${profitability.netProfit >= 0 ? "bg-green-100" : "bg-red-100"}`}>
            <TrendingUp className={`w-5 h-5 ${profitability.netProfit >= 0 ? "text-green-600" : "text-red-600"}`} />
          </div>
          <p className="text-sm font-medium text-slate-700">This Month&apos;s Profitability</p>
        </div>
        <Link
          href="/portal/profitability"
          className="text-sm text-cyan-600 hover:text-cyan-700 font-medium whitespace-nowrap"
        >
          Details
        </Link>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className={`text-2xl font-bold ${profitability.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(profitability.netProfit)}
          </p>
          <p className="text-xs text-slate-500">net profit</p>
        </div>
        <div className="text-right">
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${
            profitability.marginPercentage >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}>
            {profitability.marginPercentage >= 0 ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )}
            {Math.abs(profitability.marginPercentage).toFixed(1)}%
          </div>
          <p className="text-xs text-slate-500 mt-1">margin</p>
        </div>
      </div>
    </Card>
  );
}
