"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import type { InventoryHealthItem } from "@/lib/api/dashboard";

type FilterTab = "all" | "critical" | "low" | "healthy" | "overstock" | "no-movement";
type SortKey = "product" | "onHand" | "velocity" | "mos" | "status";
type SortDir = "asc" | "desc";

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "low", label: "Low" },
  { key: "healthy", label: "Healthy" },
  { key: "overstock", label: "Overstock" },
  { key: "no-movement", label: "No Movement" },
];

const STATUS_STYLES: Record<InventoryHealthItem["status"], string> = {
  critical: "text-red-600",
  low: "text-amber-600",
  healthy: "text-slate-600",
  overstock: "text-slate-500",
  "no-movement": "text-slate-400",
};

const STATUS_LABELS: Record<InventoryHealthItem["status"], string> = {
  critical: "Critical",
  low: "Low",
  healthy: "Healthy",
  overstock: "Overstock",
  "no-movement": "No Mvmt",
};

const STATUS_ORDER: Record<InventoryHealthItem["status"], number> = {
  critical: 0,
  low: 1,
  healthy: 2,
  overstock: 3,
  "no-movement": 4,
};

const MAX_VISIBLE = 8;

interface Props {
  items: InventoryHealthItem[];
  loading?: boolean;
}

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`ml-1 inline-block transition-colors ${active ? "text-slate-700" : "text-slate-300"}`}>
      {active && dir === "desc" ? "\u2193" : "\u2191"}
    </span>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i}>
          <td className="py-2.5 pr-4">
            <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
            <div className="h-3 w-16 bg-slate-50 rounded animate-pulse mt-1" />
          </td>
          <td className="py-2.5 px-3"><div className="h-4 w-12 bg-slate-100 rounded animate-pulse ml-auto" /></td>
          <td className="py-2.5 px-3"><div className="h-4 w-10 bg-slate-100 rounded animate-pulse ml-auto" /></td>
          <td className="py-2.5 px-3"><div className="h-4 w-8 bg-slate-100 rounded animate-pulse ml-auto" /></td>
          <td className="py-2.5 pl-3"><div className="h-4 w-14 bg-slate-100 rounded animate-pulse ml-auto" /></td>
        </tr>
      ))}
    </>
  );
}

function getSortValue(item: InventoryHealthItem, key: SortKey): string | number {
  switch (key) {
    case "product": return item.productName.toLowerCase();
    case "onHand": return item.qtyOnHand;
    case "velocity": return item.avgDailyUsage;
    case "mos": return item.status === "no-movement" ? -1 : item.monthsOfSupply;
    case "status": return STATUS_ORDER[item.status];
  }
}

export default function InventoryOverviewWidget({ items, loading }: Props) {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [sortKey, setSortKey] = useState<SortKey>("mos");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "product" ? "asc" : "asc");
    }
  };

  const counts = {
    critical: items?.filter((i) => i.status === "critical").length || 0,
    low: items?.filter((i) => i.status === "low").length || 0,
  };

  const sorted = useMemo(() => {
    const filtered = activeTab === "all"
      ? items || []
      : (items || []).filter((i) => i.status === activeTab);

    return [...filtered].sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, activeTab, sortKey, sortDir]);

  const visible = sorted.slice(0, MAX_VISIBLE);
  const hasMore = sorted.length > MAX_VISIBLE;

  const summaryParts: string[] = [];
  if (counts.critical > 0) summaryParts.push(`${counts.critical} critical`);
  if (counts.low > 0) summaryParts.push(`${counts.low} low`);

  const thBase = "text-xs font-medium text-slate-400 uppercase tracking-wider py-2.5 cursor-pointer select-none hover:text-slate-600 transition-colors";

  return (
    <Card padding="none">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-medium text-slate-900">Inventory Health</h3>
          {summaryParts.length > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">{summaryParts.join(", ")}</p>
          )}
        </div>
        <Link
          href="/inventory"
          className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
        >
          View all
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="px-5 flex gap-4 border-b border-slate-100">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "text-slate-900 border-slate-900 font-semibold"
                : "text-slate-400 border-transparent hover:text-slate-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className={`text-left ${thBase} px-5`} onClick={() => handleSort("product")}>
                Product<SortIndicator active={sortKey === "product"} dir={sortDir} />
              </th>
              <th className={`text-right ${thBase} px-3`} onClick={() => handleSort("onHand")}>
                On Hand<SortIndicator active={sortKey === "onHand"} dir={sortDir} />
              </th>
              <th className={`text-right ${thBase} px-3`} onClick={() => handleSort("velocity")}>
                Velocity<SortIndicator active={sortKey === "velocity"} dir={sortDir} />
              </th>
              <th className={`text-right ${thBase} px-3`} onClick={() => handleSort("mos")}>
                MOS<SortIndicator active={sortKey === "mos"} dir={sortDir} />
              </th>
              <th className={`text-right ${thBase} px-5`} onClick={() => handleSort("status")}>
                Status<SortIndicator active={sortKey === "status"} dir={sortDir} />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <SkeletonRows />
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-slate-400">
                  No products found
                </td>
              </tr>
            ) : (
              visible.map((item) => (
                <tr key={item.sku} className="hover:bg-slate-25 transition-colors">
                  <td className="py-2.5 px-5">
                    <div className="text-sm text-slate-700 font-medium truncate max-w-[200px]">{item.productName}</div>
                    <div className="text-xs text-slate-400 font-mono">{item.sku}</div>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">
                    {item.qtyOnHand.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-slate-500">
                    {item.avgDailyUsage > 0 ? `${item.avgDailyUsage}/d` : "\u2014"}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">
                    {item.status === "no-movement" ? "\u2014" : item.monthsOfSupply.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-5 text-right">
                    <span className={`text-xs font-semibold ${STATUS_STYLES[item.status]}`}>
                      {STATUS_LABELS[item.status]}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {hasMore && !loading && (
        <div className="px-5 py-3 border-t border-slate-100">
          <Link
            href="/inventory"
            className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            View all {sorted.length} products
          </Link>
        </div>
      )}
    </Card>
  );
}
