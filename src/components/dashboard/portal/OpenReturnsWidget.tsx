import Card from "@/components/ui/Card";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

interface Props {
  openReturns: number;
}

export default function OpenReturnsWidget({ openReturns }: Props) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${openReturns > 0 ? "bg-orange-100" : "bg-slate-100"}`}>
            <RotateCcw className={`w-6 h-6 ${openReturns > 0 ? "text-orange-600" : "text-slate-500"}`} />
          </div>
          <div>
            <p className="text-sm text-slate-500">Open Returns</p>
            <p className={`text-2xl font-bold ${openReturns > 0 ? "text-orange-600" : "text-slate-900"}`}>
              {openReturns}
            </p>
          </div>
        </div>
        <Link
          href="/portal/returns"
          className="text-sm text-cyan-600 hover:text-cyan-700 font-medium whitespace-nowrap"
        >
          View Returns
        </Link>
      </div>
    </Card>
  );
}
