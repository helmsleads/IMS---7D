import Card from "@/components/ui/Card";
import { CalendarHeatmap } from "@/components/ui/charts";
import { CalendarDay } from "@/lib/api/dashboard";
import { Calendar } from "lucide-react";
import Link from "next/link";

interface Props {
  calendarData: CalendarDay[];
}

export default function InboundForecastWidget({ calendarData }: Props) {
  const totalExpected = calendarData.reduce((s, d) => s + d.count, 0);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Inbound Forecast</h3>
        <Link href="/inbound" className="text-sm text-indigo-600 hover:text-indigo-800">
          Inbound
        </Link>
      </div>
      {calendarData.length > 0 ? (
        <>
          <p className="text-sm text-slate-500 mb-3">
            <span className="text-xl font-bold text-slate-900">{totalExpected}</span>{" "}
            expected shipments over 90 days
          </p>
          <CalendarHeatmap data={calendarData} days={90} />
        </>
      ) : (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <Calendar className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 text-sm">No upcoming inbound shipments</p>
        </div>
      )}
    </Card>
  );
}
