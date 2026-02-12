import Card from "@/components/ui/Card";
import Link from "next/link";
import { Package } from "lucide-react";

interface ExpectedArrival {
  id: string;
  po_number: string;
  supplier: string;
  expected_date: string | null;
  status: string;
}

interface Props {
  expectedArrivals: ExpectedArrival[];
}

export default function ExpectedArrivalsWidget({ expectedArrivals }: Props) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Expected Arrivals</h3>
        {expectedArrivals.length > 0 && (
          <Link
            href="/inbound"
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            View All
          </Link>
        )}
      </div>
      {expectedArrivals.length === 0 ? (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <Package className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 text-sm">No pending arrivals</p>
        </div>
      ) : (
        <div className="space-y-3">
          {expectedArrivals.slice(0, 5).map((arrival) => {
            const isOverdue = arrival.expected_date && new Date(arrival.expected_date) < new Date(new Date().toISOString().split("T")[0]);
            return (
              <Link
                key={arrival.id}
                href={`/inbound/${arrival.id}`}
                className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 hover:bg-slate-50 -mx-2 px-2 rounded"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900 truncate">
                    {arrival.po_number}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{arrival.supplier}</p>
                </div>
                <div className="text-right ml-4">
                  <p className={`font-medium ${isOverdue ? "text-red-600" : "text-slate-900"}`}>
                    {arrival.expected_date
                      ? new Date(arrival.expected_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      : "No date"}
                  </p>
                  <p className="text-xs text-slate-500 capitalize">
                    {arrival.status.replace("_", " ")}
                  </p>
                </div>
              </Link>
            );
          })}
          {expectedArrivals.length > 5 && (
            <p className="text-sm text-slate-500 text-center pt-2">
              and {expectedArrivals.length - 5} more...
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
