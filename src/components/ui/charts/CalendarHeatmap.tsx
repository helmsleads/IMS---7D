"use client";

import { useMemo } from "react";

interface CalendarDay {
  date: string; // YYYY-MM-DD
  count: number;
}

interface CalendarHeatmapProps {
  data: CalendarDay[];
  days?: number;
}

const COLORS = [
  "#F1F5F9", // slate-100 — zero
  "#C7D2FE", // indigo-200 — low
  "#818CF8", // indigo-400 — medium
  "#4F46E5", // indigo-600 — high
];

function getColor(count: number, max: number): string {
  if (count === 0 || max === 0) return COLORS[0];
  const ratio = count / max;
  if (ratio <= 0.33) return COLORS[1];
  if (ratio <= 0.66) return COLORS[2];
  return COLORS[3];
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function CalendarHeatmap({ data, days = 90 }: CalendarHeatmapProps) {
  const { grid, months, maxCount, weeks } = useMemo(() => {
    // Build lookup
    const lookup = new Map<string, number>();
    let maxCount = 0;
    for (const d of data) {
      lookup.set(d.date, d.count);
      if (d.count > maxCount) maxCount = d.count;
    }

    // Generate day list ending today
    const today = new Date();
    const dayList: { date: Date; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayList.push({ date: d, count: lookup.get(key) || 0 });
    }

    // Arrange into weeks (columns), rows = day of week (0=Sun, 6=Sat)
    const grid: { date: Date; count: number; col: number; row: number }[] = [];
    let col = 0;
    let prevWeek = -1;

    for (const day of dayList) {
      const dow = day.date.getDay();
      // Get ISO week number to detect week boundary
      const weekStart = new Date(day.date);
      weekStart.setDate(weekStart.getDate() - dow);
      const weekKey = weekStart.toISOString().slice(0, 10);

      if (prevWeek === -1) {
        prevWeek = 0;
        col = 0;
      } else if (dow === 0) {
        col++;
      }

      grid.push({ ...day, col, row: dow });
    }

    const weeks = col + 1;

    // Collect month labels at first occurrence of each month
    const months: { label: string; col: number }[] = [];
    let lastMonth = -1;
    for (const cell of grid) {
      const m = cell.date.getMonth();
      if (m !== lastMonth) {
        lastMonth = m;
        months.push({ label: MONTH_LABELS[m], col: cell.col });
      }
    }

    return { grid, months, maxCount, weeks };
  }, [data, days]);

  const cellSize = 12;
  const cellGap = 2;
  const step = cellSize + cellGap;
  const topMargin = 16;
  const svgWidth = weeks * step + cellGap;
  const svgHeight = 7 * step + topMargin + cellGap;

  return (
    <div className="animate-chart-enter overflow-x-auto">
      <svg width={svgWidth} height={svgHeight} role="img" aria-label="Calendar heatmap">
        {/* Month labels */}
        {months.map((m, i) => (
          <text
            key={i}
            x={m.col * step + cellGap}
            y={10}
            fontSize={10}
            fill="#94A3B8"
            fontFamily="inherit"
          >
            {m.label}
          </text>
        ))}
        {/* Day cells */}
        {grid.map((cell, i) => (
          <rect
            key={i}
            x={cell.col * step + cellGap}
            y={cell.row * step + topMargin}
            width={cellSize}
            height={cellSize}
            rx={2}
            ry={2}
            fill={getColor(cell.count, maxCount)}
          >
            <title>{`${cell.date.toISOString().slice(0, 10)}: ${cell.count}`}</title>
          </rect>
        ))}
      </svg>
    </div>
  );
}
