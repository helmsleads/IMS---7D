"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import type { InventoryHealthItem } from "@/lib/api/dashboard";

type FilterTab = "all" | "critical" | "low" | "healthy" | "overstock" | "no-movement";
type SortKey = "product" | "onHand" | "v1m" | "v3m" | "v6m" | "mos" | "status";
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
          <td className="py-2.5 px-2"><div className="h-4 w-12 bg-slate-100 rounded animate-pulse ml-auto" /></td>
          <td className="py-2.5 px-2"><div className="h-4 w-10 bg-slate-100 rounded animate-pulse ml-auto" /></td>
          <td className="py-2.5 px-2"><div className="h-4 w-10 bg-slate-100 rounded animate-pulse ml-auto" /></td>
          <td className="py-2.5 px-2"><div className="h-4 w-10 bg-slate-100 rounded animate-pulse ml-auto" /></td>
          <td className="py-2.5 px-2"><div className="h-4 w-8 bg-slate-100 rounded animate-pulse ml-auto" /></td>
          <td className="py-2.5 pl-2"><div className="h-4 w-14 bg-slate-100 rounded animate-pulse ml-auto" /></td>
        </tr>
      ))}
    </>
  );
}

function getSortValue(item: InventoryHealthItem, key: SortKey): string | number {
  switch (key) {
    case "product": return item.productName.toLowerCase();
    case "onHand": return item.qtyOnHand;
    case "v1m": return item.avgDailyUsage;
    case "v3m": return item.avgDailyUsage3m;
    case "v6m": return item.avgDailyUsage6m;
    case "mos": return item.status === "no-movement" ? -1 : item.monthsOfSupply;
    case "status": return STATUS_ORDER[item.status];
  }
}

/** Show trend arrow comparing current velocity to a longer-term baseline */
function VelocityTrend({ current, baseline }: { current: number; baseline: number }) {
  if (baseline === 0 || current === 0) return null;
  const pctChange = ((current - baseline) / baseline) * 100;
  if (Math.abs(pctChange) < 10) return null; // ignore <10% changes
  if (pctChange > 0) {
    return <span className="text-green-500 text-[10px] ml-0.5">{"\u2191"}</span>;
  }
  return <span className="text-red-400 text-[10px] ml-0.5">{"\u2193"}</span>;
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
      <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
        <table className="w-full text-sm" style={{ tableLayout: "fixed", minWidth: "640px" }}>
          <colgroup>
            <col style={{ width: "28%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "12%" }} />
          </colgroup>
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-slate-100">
              <th className={`text-left ${thBase} px-5`} onClick={() => handleSort("product")}>
                Product<SortIndicator active={sortKey === "product"} dir={sortDir} />
              </th>
              <th className={`text-center ${thBase} px-2`} onClick={() => handleSort("onHand")}>
                On Hand<SortIndicator active={sortKey === "onHand"} dir={sortDir} />
              </th>
              <th className={`text-center ${thBase} px-2`} onClick={() => handleSort("v1m")}>
                1M Vel<SortIndicator active={sortKey === "v1m"} dir={sortDir} />
              </th>
              <th className={`text-center ${thBase} px-2`} onClick={() => handleSort("v3m")}>
                3M Vel<SortIndicator active={sortKey === "v3m"} dir={sortDir} />
              </th>
              <th className={`text-center ${thBase} px-2`} onClick={() => handleSort("v6m")}>
                6M Vel<SortIndicator active={sortKey === "v6m"} dir={sortDir} />
              </th>
              <th className={`text-center ${thBase} px-2`} onClick={() => handleSort("mos")}>
                MOS<SortIndicator active={sortKey === "mos"} dir={sortDir} />
              </th>
              <th className={`text-center ${thBase} px-2`} onClick={() => handleSort("status")}>
                Status<SortIndicator active={sortKey === "status"} dir={sortDir} />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <SkeletonRows />
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                  No products found
                </td>
              </tr>
            ) : (
              sorted.map((item) => (
                <tr key={item.sku} className="hover:bg-slate-25 transition-colors">
                  <td className="py-2.5 px-5">
                    <div className="text-sm text-slate-700 font-medium truncate">{item.productName}</div>
                    <div className="text-xs text-slate-400 font-mono truncate">{item.sku}</div>
                  </td>
                  <td className="py-2.5 px-2 text-center tabular-nums text-slate-700">
                    {item.qtyOnHand.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-2 text-center tabular-nums text-slate-500">
                    {item.avgDailyUsage > 0 ? (
                      <span>
                        {item.avgDailyUsage}/d
                        <VelocityTrend current={item.avgDailyUsage} baseline={item.avgDailyUsage3m} />
                      </span>
                    ) : "\u2014"}
                  </td>
                  <td className="py-2.5 px-2 text-center tabular-nums text-slate-500">
                    {item.avgDailyUsage3m > 0 ? `${item.avgDailyUsage3m}/d` : "\u2014"}
                  </td>
                  <td className="py-2.5 px-2 text-center tabular-nums text-slate-500">
                    {item.avgDailyUsage6m > 0 ? `${item.avgDailyUsage6m}/d` : "\u2014"}
                  </td>
                  <td className="py-2.5 px-2 text-center tabular-nums text-slate-700">
                    {item.status === "no-movement" ? "\u2014" : item.monthsOfSupply.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-2 text-center">
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
      <div className="px-5 py-3 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">{sorted.length} products</span>
          <Link
            href="/inventory"
            className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            View all
          </Link>
        </div>
      </div>
    </Card>
  );
}
