"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import {
  getMonthAvailability,
  getSlotAvailability,
  getDockCapacity,
  DayAvailability,
  SlotAvailability,
  DockCapacity,
} from "@/lib/api/dock-appointments";
import Spinner from "@/components/ui/Spinner";

interface DockCalendarProps {
  selectedDate: string | null;
  selectedSlot: "am" | "pm" | null;
  onSelect: (date: string, slot: "am" | "pm") => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime12(time24: string): string {
  const [h, m] = time24.split(":");
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${suffix}`;
}

export default function DockCalendar({
  selectedDate,
  selectedSlot,
  onSelect,
}: DockCalendarProps) {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1); // 1-based
  const [monthData, setMonthData] = useState<DayAvailability[]>([]);
  const [slotData, setSlotData] = useState<{
    am: SlotAvailability;
    pm: SlotAvailability;
  } | null>(null);
  const [capacity, setCapacity] = useState<DockCapacity | null>(null);
  const [loadingMonth, setLoadingMonth] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const fetchMonth = useCallback(async () => {
    setLoadingMonth(true);
    try {
      const [data, cap] = await Promise.all([
        getMonthAvailability(viewYear, viewMonth),
        getDockCapacity(),
      ]);
      setMonthData(data);
      setCapacity(cap);
    } catch (err) {
      console.error("Failed to fetch month availability:", err);
    } finally {
      setLoadingMonth(false);
    }
  }, [viewYear, viewMonth]);

  useEffect(() => {
    fetchMonth();
  }, [fetchMonth]);

  useEffect(() => {
    if (!selectedDate) {
      setSlotData(null);
      return;
    }
    setLoadingSlots(true);
    getSlotAvailability(selectedDate)
      .then(setSlotData)
      .catch((err) => console.error("Failed to fetch slot availability:", err))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate]);

  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewYear(viewYear - 1);
      setViewMonth(12);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewYear(viewYear + 1);
      setViewMonth(1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const canGoPrev =
    viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth > today.getMonth() + 1);

  // Build calendar grid
  const firstDayOfMonth = new Date(viewYear, viewMonth - 1, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();

  const calendarCells: (DayAvailability | null)[] = [];
  // Leading blanks
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarCells.push(null);
  }
  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayData = monthData.find((m) => m.date === dateStr);
    calendarCells.push(
      dayData || { date: dateStr, am: { booked: 0, max: 3 }, pm: { booked: 0, max: 3 } }
    );
  }

  const monthName = new Date(viewYear, viewMonth - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const getDayCellColor = (day: DayAvailability): string => {
    const isPast = day.date < todayStr;
    if (isPast) return "bg-slate-50 text-slate-300 cursor-not-allowed";

    const amFull = day.am.booked >= day.am.max;
    const pmFull = day.pm.booked >= day.pm.max;

    if (amFull && pmFull) return "bg-red-50 text-red-400 cursor-not-allowed";
    if (amFull || pmFull) return "bg-amber-50 text-amber-700 hover:bg-amber-100 cursor-pointer";
    return "bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer";
  };

  const isDayDisabled = (day: DayAvailability): boolean => {
    if (day.date < todayStr) return true;
    return day.am.booked >= day.am.max && day.pm.booked >= day.pm.max;
  };

  return (
    <div className="space-y-4">
      {/* Month Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          disabled={!canGoPrev}
          className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h3 className="text-lg font-semibold text-slate-900">{monthName}</h3>
        <button
          onClick={nextMonth}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {/* Calendar Grid */}
      {loadingMonth ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div>
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-slate-500 py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Day Cells */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, idx) => {
              if (!cell) {
                return <div key={`blank-${idx}`} className="aspect-square" />;
              }

              const dayNum = parseInt(cell.date.split("-")[2], 10);
              const isSelected = cell.date === selectedDate;
              const disabled = isDayDisabled(cell);
              const colorClass = getDayCellColor(cell);

              return (
                <button
                  key={cell.date}
                  disabled={disabled}
                  onClick={() => {
                    if (!disabled) {
                      // Auto-select first available slot
                      const amAvailable = cell.am.booked < cell.am.max;
                      onSelect(cell.date, amAvailable ? "am" : "pm");
                    }
                  }}
                  className={`
                    aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all
                    ${colorClass}
                    ${isSelected ? "ring-2 ring-cyan-500 ring-offset-1" : ""}
                  `}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-green-100 border border-green-300" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-100 border border-amber-300" />
              <span>Limited</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-red-100 border border-red-300" />
              <span>Full</span>
            </div>
          </div>
        </div>
      )}

      {/* Slot Picker */}
      {selectedDate && (
        <div className="border-t border-slate-200 pt-4">
          <p className="text-sm font-medium text-slate-700 mb-3">
            Select a time slot for{" "}
            <span className="text-slate-900">
              {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
          </p>

          {loadingSlots ? (
            <div className="flex justify-center py-6">
              <Spinner size="sm" />
            </div>
          ) : slotData && capacity ? (
            <div className="grid grid-cols-2 gap-3">
              {/* AM Slot */}
              <button
                type="button"
                disabled={slotData.am.available === 0}
                onClick={() => onSelect(selectedDate, "am")}
                className={`
                  flex flex-col items-center gap-1 p-4 rounded-lg border-2 transition-all
                  ${slotData.am.available === 0
                    ? "border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed"
                    : selectedSlot === "am"
                    ? "border-cyan-500 bg-cyan-50"
                    : "border-slate-200 hover:border-slate-300 cursor-pointer"
                  }
                `}
              >
                <Clock
                  className={`w-5 h-5 ${
                    selectedSlot === "am" ? "text-cyan-600" : "text-slate-400"
                  }`}
                />
                <span
                  className={`font-semibold ${
                    selectedSlot === "am" ? "text-cyan-700" : "text-slate-700"
                  }`}
                >
                  AM
                </span>
                <span className="text-xs text-slate-500">
                  {formatTime12(capacity.amStart)} – {formatTime12(capacity.amEnd)}
                </span>
                <span
                  className={`text-xs font-medium mt-1 ${
                    slotData.am.available === 0
                      ? "text-red-500"
                      : slotData.am.available <= 1
                      ? "text-amber-600"
                      : "text-green-600"
                  }`}
                >
                  {slotData.am.available === 0
                    ? "Full"
                    : `${slotData.am.booked} of ${slotData.am.max} booked`}
                </span>
              </button>

              {/* PM Slot */}
              <button
                type="button"
                disabled={slotData.pm.available === 0}
                onClick={() => onSelect(selectedDate, "pm")}
                className={`
                  flex flex-col items-center gap-1 p-4 rounded-lg border-2 transition-all
                  ${slotData.pm.available === 0
                    ? "border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed"
                    : selectedSlot === "pm"
                    ? "border-cyan-500 bg-cyan-50"
                    : "border-slate-200 hover:border-slate-300 cursor-pointer"
                  }
                `}
              >
                <Clock
                  className={`w-5 h-5 ${
                    selectedSlot === "pm" ? "text-cyan-600" : "text-slate-400"
                  }`}
                />
                <span
                  className={`font-semibold ${
                    selectedSlot === "pm" ? "text-cyan-700" : "text-slate-700"
                  }`}
                >
                  PM
                </span>
                <span className="text-xs text-slate-500">
                  {formatTime12(capacity.pmStart)} – {formatTime12(capacity.pmEnd)}
                </span>
                <span
                  className={`text-xs font-medium mt-1 ${
                    slotData.pm.available === 0
                      ? "text-red-500"
                      : slotData.pm.available <= 1
                      ? "text-amber-600"
                      : "text-green-600"
                  }`}
                >
                  {slotData.pm.available === 0
                    ? "Full"
                    : `${slotData.pm.booked} of ${slotData.pm.max} booked`}
                </span>
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
