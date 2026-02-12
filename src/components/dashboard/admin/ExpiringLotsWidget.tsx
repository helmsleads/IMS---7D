import Card from "@/components/ui/Card";
import Link from "next/link";
import { Calendar } from "lucide-react";

interface ExpiringLot {
  id: string;
  lot_number: string | null;
  batch_number: string | null;
  expiration_date: string | null;
  product?: { name: string } | null;
}

interface Props {
  expiringLots: ExpiringLot[];
  loading: boolean;
}

export default function ExpiringLotsWidget({ expiringLots, loading }: Props) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Expiring Lots</h3>
        <Link
          href="/reports/lot-expiration"
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          View All
        </Link>
      </div>
      {expiringLots.length === 0 ? (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
            <Calendar className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-slate-500 text-sm">No lots expiring soon</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-orange-600">
                {loading ? "\u2014" : expiringLots.length}
              </p>
              <p className="text-sm text-slate-500">
                Lots expiring in 30 days
              </p>
            </div>
          </div>
          <div className="space-y-2 border-t border-slate-100 pt-3">
            {expiringLots.slice(0, 3).map((lot) => {
              const daysLeft = lot.expiration_date
                ? Math.ceil(
                    (new Date(lot.expiration_date).getTime() - new Date().getTime()) /
                      (1000 * 60 * 60 * 24)
                  )
                : 0;
              return (
                <Link
                  key={lot.id}
                  href={`/lots/${lot.id}`}
                  className="flex items-center justify-between py-1 hover:bg-slate-50 -mx-2 px-2 rounded"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {lot.lot_number || lot.batch_number}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {lot.product?.name}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    daysLeft <= 7
                      ? "bg-red-100 text-red-700"
                      : daysLeft <= 14
                      ? "bg-orange-100 text-orange-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {daysLeft <= 0 ? "Expired" : `${daysLeft}d`}
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}
