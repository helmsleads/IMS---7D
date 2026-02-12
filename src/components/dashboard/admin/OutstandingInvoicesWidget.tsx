import Card from "@/components/ui/Card";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatting";

interface InvoiceData {
  total: number;
  amount_paid?: number;
  due_date: string | null;
}

interface Props {
  outstandingInvoices: InvoiceData[];
  loading: boolean;
}

export default function OutstandingInvoicesWidget({ outstandingInvoices, loading }: Props) {
  const totalOutstanding = outstandingInvoices.reduce(
    (sum, inv) => sum + (inv.total - (inv.amount_paid || 0)),
    0
  );
  const overdueCount = outstandingInvoices.filter((inv) => {
    if (!inv.due_date) return false;
    return new Date(inv.due_date) < new Date();
  }).length;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Outstanding Invoices</h3>
        <Link
          href="/billing"
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          View Billing
        </Link>
      </div>
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
          totalOutstanding > 0 ? "bg-green-100" : "bg-slate-100"
        }`}>
          <CreditCard className={`w-6 h-6 ${
            totalOutstanding > 0 ? "text-green-600" : "text-slate-400"
          }`} />
        </div>
        <div>
          <p className="text-2xl font-semibold text-slate-900">
            {loading ? "\u2014" : formatCurrency(totalOutstanding)}
          </p>
          <p className="text-sm text-slate-500">Outstanding balance</p>
        </div>
      </div>
      <div className="space-y-2 border-t border-slate-100 pt-3">
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Open invoices</span>
          <span className="font-medium text-slate-900">
            {outstandingInvoices.length}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Overdue</span>
          <span className={`font-medium ${
            overdueCount > 0 ? "text-red-600" : "text-slate-900"
          }`}>
            {overdueCount}
          </span>
        </div>
      </div>
    </Card>
  );
}
