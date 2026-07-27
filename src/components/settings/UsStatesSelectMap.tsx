"use client";

import { useMemo, useState } from "react";
import {
  US_MAP_VIEWBOX,
  US_STATE_NAMES,
  US_STATE_PATHS,
} from "@/lib/dtc/us-state-paths";

type UsStatesSelectMapProps = {
  selected: string[];
  onToggle: (code: string) => void;
  /** Extra codes not drawn on the continental map (e.g. PR). */
  extraCodes?: string[];
};

export default function UsStatesSelectMap({
  selected,
  onToggle,
  extraCodes = ["PR"],
}: UsStatesSelectMapProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const mapCodes = useMemo(
    () => Object.keys(US_STATE_PATHS).sort(),
    [],
  );

  const hoverLabel = hovered
    ? `${hovered} — ${US_STATE_NAMES[hovered] || hovered}${
        selectedSet.has(hovered) ? " (restricted)" : ""
      }`
    : "Click a state to toggle restricted shipping";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-600 min-h-[1.25rem]">{hoverLabel}</p>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-red-500 border border-red-600" />
            Restricted
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-slate-100 border border-slate-300" />
            Allowed
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-gradient-to-b from-slate-50 to-white p-3 sm:p-4 overflow-hidden">
        <svg
          viewBox={US_MAP_VIEWBOX}
          role="img"
          aria-label="United States map for selecting alcohol shipping restrictions"
          className="w-full h-auto max-h-[420px]"
        >
          <title>US alcohol restricted states map</title>
          {mapCodes.map((code) => {
            const isSelected = selectedSet.has(code);
            const isHovered = hovered === code;
            return (
              <path
                key={code}
                d={US_STATE_PATHS[code]}
                data-state={code}
                tabIndex={0}
                role="button"
                aria-pressed={isSelected}
                aria-label={`${US_STATE_NAMES[code] || code}${
                  isSelected ? ", restricted" : ", allowed"
                }`}
                onClick={() => onToggle(code)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onToggle(code);
                  }
                }}
                onMouseEnter={() => setHovered(code)}
                onMouseLeave={() => setHovered((current) => (current === code ? null : current))}
                onFocus={() => setHovered(code)}
                onBlur={() => setHovered((current) => (current === code ? null : current))}
                className="cursor-pointer outline-none transition-[fill,stroke-width] duration-100"
                style={{
                  fill: isSelected ? "#ef4444" : isHovered ? "#e2e8f0" : "#f8fafc",
                  stroke: isSelected ? "#b91c1c" : isHovered ? "#64748b" : "#94a3b8",
                  strokeWidth: isHovered || isSelected ? 1.4 : 0.8,
                }}
              />
            );
          })}
        </svg>
      </div>

      {extraCodes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">Also:</span>
          {extraCodes.map((code) => {
            const isSelected = selectedSet.has(code);
            return (
              <button
                key={code}
                type="button"
                onClick={() => onToggle(code)}
                onMouseEnter={() => setHovered(code)}
                onMouseLeave={() => setHovered((current) => (current === code ? null : current))}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  isSelected
                    ? "bg-red-500 text-white border-red-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-slate-50"
                }`}
                aria-pressed={isSelected}
              >
                {code}
                {US_STATE_NAMES[code] ? ` — ${US_STATE_NAMES[code]}` : ""}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
