"use client";

import React, { useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronUp, ChevronDown, X, RotateCcw } from "lucide-react";
import Card from "@/components/ui/Card";
import Toggle from "@/components/ui/Toggle";
import WidgetSizeSelector from "./WidgetSizeSelector";
import { WidgetConfig, WidgetLayoutItem } from "@/lib/dashboard/types";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

const CATEGORY_COLORS: Record<string, string> = {
  core: "bg-indigo-500",
  operational: "bg-blue-500",
  analytics: "bg-amber-500",
  communication: "bg-green-500",
};

const CATEGORY_LABELS: Record<string, string> = {
  core: "Core",
  operational: "Operational",
  analytics: "Analytics",
  communication: "Communication",
};

interface SortableRowProps {
  widget: WidgetLayoutItem;
  config: WidgetConfig;
  isDesktop: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggle: (id: string) => void;
  onResize: (id: string, size: "half" | "full") => void;
  onMove: (id: string, direction: "up" | "down") => void;
}

function SortableRow({
  widget,
  config,
  isDesktop,
  isFirst,
  isLast,
  onToggle,
  onResize,
  onMove,
}: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.9 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
        isDragging
          ? "bg-white shadow-lg border-indigo-200"
          : widget.enabled
          ? "bg-white border-slate-200"
          : "bg-slate-50 border-slate-100"
      }`}
    >
      {/* Drag handle or arrows */}
      {isDesktop ? (
        <button
          className="touch-none cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>
      ) : (
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => onMove(widget.id, "up")}
            disabled={isFirst}
            className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onMove(widget.id, "down")}
            disabled={isLast}
            className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Category dot */}
      <div
        className={`w-2 h-2 rounded-full flex-shrink-0 ${CATEGORY_COLORS[config.category]}`}
        title={CATEGORY_LABELS[config.category]}
      />

      {/* Widget title */}
      <span className={`flex-1 text-sm font-medium truncate ${
        widget.enabled ? "text-slate-900" : "text-slate-400"
      }`}>
        {config.title}
      </span>

      {/* Size selector */}
      <WidgetSizeSelector
        size={widget.size}
        onChange={(size) => onResize(widget.id, size)}
      />

      {/* Toggle */}
      <Toggle
        checked={widget.enabled}
        onChange={() => onToggle(widget.id)}
        size="sm"
      />
    </div>
  );
}

interface DashboardCustomizerProps {
  widgets: WidgetLayoutItem[];
  registry: WidgetConfig[];
  isCustomized: boolean;
  onToggle: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onReorder: (orderedIds: string[]) => void;
  onResize: (id: string, size: "half" | "full") => void;
  onReset: () => void;
  onClose: () => void;
  accent?: "indigo" | "cyan";
}

export default function DashboardCustomizer({
  widgets,
  registry,
  isCustomized,
  onToggle,
  onMove,
  onReorder,
  onResize,
  onReset,
  onClose,
  accent = "indigo",
}: DashboardCustomizerProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const configMap = useMemo(
    () => new Map(registry.map((c) => [c.id, c])),
    [registry]
  );

  const sortedWidgets = useMemo(
    () => [...widgets].sort((a, b) => a.order - b.order),
    [widgets]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedWidgets.findIndex((w) => w.id === active.id);
    const newIndex = sortedWidgets.findIndex((w) => w.id === over.id);
    const reordered = arrayMove(sortedWidgets, oldIndex, newIndex);
    onReorder(reordered.map((w) => w.id));
  }

  const accentBorder = accent === "cyan" ? "border-l-cyan-400" : "border-l-indigo-400";

  return (
    <div className="animate-widget-enter">
      <Card accent={accent}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Customize Your Dashboard
          </h3>
          <div className="flex items-center gap-2">
            {isCustomized && (
              <button
                onClick={onReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <p className="text-sm text-slate-500 mb-4">
          {isDesktop ? "Drag to reorder" : "Use arrows to reorder"}, toggle visibility, and choose widget sizes.
        </p>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedWidgets.map((w) => w.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {sortedWidgets.map((widget, idx) => {
                const config = configMap.get(widget.id);
                if (!config) return null;

                return (
                  <SortableRow
                    key={widget.id}
                    widget={widget}
                    config={config}
                    isDesktop={isDesktop}
                    isFirst={idx === 0}
                    isLast={idx === sortedWidgets.length - 1}
                    onToggle={onToggle}
                    onResize={onResize}
                    onMove={onMove}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        {/* Category legend */}
        <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-slate-100">
          {Object.entries(CATEGORY_COLORS).map(([key, color]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${color}`} />
              <span className="text-xs text-slate-500">{CATEGORY_LABELS[key]}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
