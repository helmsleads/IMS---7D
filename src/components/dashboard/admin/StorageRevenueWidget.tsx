import Card from "@/components/ui/Card";
import { Warehouse } from "lucide-react";

export default function StorageRevenueWidget() {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Storage Revenue / Sq Ft</h3>
        <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
          Coming Soon
        </span>
      </div>
      <div className="text-center py-8">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <Warehouse className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-slate-500 text-sm max-w-xs mx-auto">
          This widget requires warehouse zone configuration to calculate revenue per square foot.
        </p>
      </div>
    </Card>
  );
}
