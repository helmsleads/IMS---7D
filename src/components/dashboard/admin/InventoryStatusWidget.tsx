import Link from "next/link";
import { CheckCircle, Lock, AlertTriangle, Package } from "lucide-react";
import Card from "@/components/ui/Card";
import { InventoryStatusBreakdown } from "@/lib/api/dashboard";

interface Props {
  statusBreakdown: InventoryStatusBreakdown | null;
  loading?: boolean;
}

function StatusCard({
  icon,
  label,
  value,
  bgColor,
  iconColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  bgColor: string;
  iconColor: string;
}) {
  return (
    <div className={`rounded-lg p-3 ${bgColor}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className={iconColor}>{icon}</div>
        <span className="text-xs font-medium text-slate-600">{label}</span>
      </div>
      <p className="text-lg font-semibold text-slate-900">
        {value.toLocaleString()} <span className="text-xs font-normal text-slate-500">units</span>
      </p>
    </div>
  );
}

export default function InventoryStatusWidget({ statusBreakdown, loading }: Props) {
  if (loading || !statusBreakdown) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Inventory by Status</h3>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg bg-slate-50 p-3 h-20 animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  const { available, reserved, damaged, quarantine, totalOnHand } = statusBreakdown;
  const damagedQuarantine = damaged + quarantine;

  // Proportional bar segments
  const segments = [
    { label: "Available", value: available, color: "bg-green-500" },
    { label: "Reserved", value: reserved, color: "bg-blue-500" },
    { label: "Dmg/Quar", value: damagedQuarantine, color: "bg-red-500" },
  ].filter((s) => s.value > 0);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Inventory by Status</h3>
        <Link href="/inventory" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
          View All
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatusCard
          icon={<CheckCircle className="w-4 h-4" />}
          label="Available"
          value={available}
          bgColor="bg-green-50"
          iconColor="text-green-600"
        />
        <StatusCard
          icon={<Lock className="w-4 h-4" />}
          label="Reserved"
          value={reserved}
          bgColor="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatusCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Damaged / Quarantine"
          value={damagedQuarantine}
          bgColor="bg-red-50"
          iconColor="text-red-600"
        />
        <StatusCard
          icon={<Package className="w-4 h-4" />}
          label="Total On Hand"
          value={totalOnHand}
          bgColor="bg-indigo-50"
          iconColor="text-indigo-600"
        />
      </div>

      {/* Proportional Bar */}
      {totalOnHand > 0 && (
        <div>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100">
            {segments.map((seg) => (
              <div
                key={seg.label}
                className={`${seg.color} transition-all duration-500`}
                style={{ width: `${Math.max((seg.value / totalOnHand) * 100, 1)}%` }}
              />
            ))}
          </div>
          <div className="flex gap-4 mt-2">
            {segments.map((seg) => (
              <div key={seg.label} className="flex items-center gap-1.5 text-xs text-slate-500">
                <div className={`w-2 h-2 rounded-full ${seg.color}`} />
                {seg.label} ({Math.round((seg.value / totalOnHand) * 100)}%)
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
