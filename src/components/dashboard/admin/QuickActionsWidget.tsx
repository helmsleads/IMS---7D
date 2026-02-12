import Card from "@/components/ui/Card";
import Link from "next/link";
import { Plus, ArrowRightLeft } from "lucide-react";

interface Props {
  onStockAdjustment: () => void;
}

export default function QuickActionsWidget({ onStockAdjustment }: Props) {
  return (
    <Card>
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/inbound/new"
          className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all"
        >
          <Plus className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-medium text-slate-700">New PO</span>
        </Link>
        <Link
          href="/outbound/new"
          className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all"
        >
          <Plus className="w-5 h-5 text-purple-600" />
          <span className="text-sm font-medium text-slate-700">New Order</span>
        </Link>
        <button
          onClick={onStockAdjustment}
          className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all text-left"
        >
          <ArrowRightLeft className="w-5 h-5 text-amber-600" />
          <span className="text-sm font-medium text-slate-700">Stock Adjustment</span>
        </button>
        <Link
          href="/products?action=new"
          className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all"
        >
          <Plus className="w-5 h-5 text-green-600" />
          <span className="text-sm font-medium text-slate-700">Add Product</span>
        </Link>
      </div>
    </Card>
  );
}
