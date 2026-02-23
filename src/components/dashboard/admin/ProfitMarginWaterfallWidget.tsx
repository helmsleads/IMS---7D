import Card from "@/components/ui/Card";
import { WaterfallChart } from "@/components/ui/charts";
import { WaterfallItem } from "@/lib/api/dashboard";
import { formatCurrency } from "@/lib/utils/formatting";
import { TrendingUp } from "lucide-react";

interface Props {
  waterfallData: WaterfallItem[];
}

export default function ProfitMarginWaterfallWidget({
  waterfallData,
}: Props) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Profit Margin Waterfall
        </h3>
      </div>
      {waterfallData.length > 0 ? (
        <WaterfallChart
          data={waterfallData}
          valueFormatter={(v) => formatCurrency(v, 0)}
        />
      ) : (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <TrendingUp className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 text-sm">No profit margin data yet</p>
        </div>
      )}
    </Card>
  );
}
