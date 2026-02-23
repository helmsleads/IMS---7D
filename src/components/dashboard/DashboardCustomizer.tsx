"use client";

import React, { useMemo, useState } from "react";
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
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  X,
  RotateCcw,
  Plus,
  Check,
  Layers,
  BarChart3,
  Activity,
  MessageSquare,
  LayoutGrid,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Toggle from "@/components/ui/Toggle";
import WidgetSizeSelector from "./WidgetSizeSelector";
import WidgetPreview from "./WidgetPreview";
import { WidgetConfig, WidgetLayoutItem } from "@/lib/dashboard/types";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

/* ─── Constants ─── */

const CATEGORIES = [
  { key: "all", label: "All Widgets", icon: LayoutGrid },
  { key: "core", label: "Core", icon: Layers },
  { key: "operational", label: "Operational", icon: Activity },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "communication", label: "Communication", icon: MessageSquare },
] as const;

const CATEGORY_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  core: { dot: "bg-indigo-500", bg: "bg-indigo-50", text: "text-indigo-700" },
  operational: { dot: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-700" },
  analytics: { dot: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700" },
  communication: { dot: "bg-green-500", bg: "bg-green-50", text: "text-green-700" },
};

/* ─── Sortable Row (for reorder section) ─── */

interface SortableRowProps {
  widget: WidgetLayoutItem;
  config: WidgetConfig;
  isDesktop: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMove: (id: string, direction: "up" | "down") => void;
}

function SortableRow({
  widget,
  config,
  isDesktop,
  isFirst,
  isLast,
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

  const catColor = CATEGORY_COLORS[config.category];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
        isDragging
          ? "bg-white shadow-lg border-indigo-200"
          : "bg-white border-slate-200/80"
      }`}
    >
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

      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${catColor.dot}`} />
      <span className="flex-1 text-sm font-medium text-slate-700 truncate">
        {config.title}
      </span>
      <span className="text-xs text-slate-400">#{widget.order + 1}</span>
    </div>
  );
}

/* ─── Widget Card (marketplace style) ─── */

interface WidgetCardProps {
  config: WidgetConfig;
  widget: WidgetLayoutItem;
  onToggle: (id: string) => void;
  onResize: (id: string, size: "half" | "full") => void;
  accent: "indigo" | "cyan";
}

function WidgetCard({ config, widget, onToggle, onResize, accent }: WidgetCardProps) {
  const catColor = CATEGORY_COLORS[config.category];
  const accentRing = accent === "cyan" ? "ring-cyan-500" : "ring-indigo-500";
  const isComingSoon = config.comingSoon === true;

  return (
    <div
      className={`relative rounded-xl border p-4 transition-all duration-200 ${
        isComingSoon
          ? "bg-slate-50/60 border-slate-200/50"
          : widget.enabled
            ? `bg-white border-slate-200 shadow-sm ring-1 ${accentRing} ring-opacity-20`
            : "bg-slate-50/80 border-slate-200/60 hover:border-slate-300"
      }`}
    >
      {/* Coming Soon overlay */}
      {isComingSoon && (
        <div className="absolute inset-0 z-10 rounded-xl bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
            Coming Soon
          </span>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${catColor.bg} ${catColor.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${catColor.dot}`} />
            {config.category}
          </span>
        </div>
        {!isComingSoon && (
          <button
            onClick={() => onToggle(config.id)}
            className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
              widget.enabled
                ? accent === "cyan"
                  ? "bg-cyan-500 text-white shadow-sm hover:bg-cyan-600"
                  : "bg-indigo-500 text-white shadow-sm hover:bg-indigo-600"
                : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
            }`}
          >
            {widget.enabled ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* SVG Preview */}
      {config.previewType && (
        <div className="h-[70px] bg-slate-50/50 rounded-lg mb-2 flex items-center justify-center overflow-hidden px-3">
          <WidgetPreview previewType={config.previewType} accent={accent} />
        </div>
      )}

      {/* Title + description */}
      <h4 className={`text-sm font-semibold mb-1 ${
        widget.enabled ? "text-slate-900" : "text-slate-500"
      }`}>
        {config.title}
      </h4>
      <p className="text-xs text-slate-400 leading-relaxed mb-3">
        {config.description}
      </p>

      {/* Size selector (only when enabled) */}
      {widget.enabled && !isComingSoon && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-medium">Width</span>
          <WidgetSizeSelector
            size={widget.size}
            onChange={(size) => onResize(config.id, size)}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Main Customizer ─── */

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
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [reorderOpen, setReorderOpen] = useState(false);

  const configMap = useMemo(
    () => new Map(registry.map((c) => [c.id, c])),
    [registry]
  );

  const widgetMap = useMemo(
    () => new Map(widgets.map((w) => [w.id, w])),
    [widgets]
  );

  // Filtered widgets for the marketplace grid
  const filteredConfigs = useMemo(() => {
    if (activeCategory === "all") return registry;
    return registry.filter((c) => c.category === activeCategory);
  }, [registry, activeCategory]);

  // Enabled widgets sorted by order (for reorder section)
  const enabledSorted = useMemo(
    () =>
      [...widgets]
        .filter((w) => w.enabled)
        .sort((a, b) => a.order - b.order),
    [widgets]
  );

  const enabledCount = enabledSorted.length;
  const totalCount = registry.length;

  // DnD sensors
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
    const oldIndex = enabledSorted.findIndex((w) => w.id === active.id);
    const newIndex = enabledSorted.findIndex((w) => w.id === over.id);
    const reordered = arrayMove(enabledSorted, oldIndex, newIndex);
    onReorder(reordered.map((w) => w.id));
  }

  const accentTab = accent === "cyan"
    ? "bg-cyan-50 text-cyan-700 border-cyan-200"
    : "bg-indigo-50 text-indigo-700 border-indigo-200";

  return (
    <div className="animate-widget-enter">
      <Card accent={accent}>
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Widget Marketplace
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {enabledCount} of {totalCount} widgets active
            </p>
          </div>
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

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 mt-4 mb-5">
          {CATEGORIES.map(({ key, label, icon: Icon }) => {
            const isActive = activeCategory === key;
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                  isActive
                    ? accentTab
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {key !== "all" && (
                  <span className={`ml-0.5 text-[10px] ${isActive ? "opacity-70" : "text-slate-400"}`}>
                    {registry.filter((c) => c.category === key).length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Widget Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
          {filteredConfigs.map((config) => {
            const widget = widgetMap.get(config.id);
            if (!widget) return null;
            return (
              <WidgetCard
                key={config.id}
                config={config}
                widget={widget}
                onToggle={onToggle}
                onResize={onResize}
                accent={accent}
              />
            );
          })}
        </div>

        {/* Collapsible Reorder Section */}
        {enabledCount > 0 && (
          <div className="border-t border-slate-100 pt-4">
            <button
              onClick={() => setReorderOpen(!reorderOpen)}
              className="flex items-center gap-2 w-full text-left group"
            >
              <ChevronRight
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  reorderOpen ? "rotate-90" : ""
                }`}
              />
              <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
                Arrange Widget Order
              </span>
              <span className="text-xs text-slate-400 ml-1">
                {isDesktop ? "Drag to reorder" : "Use arrows to reorder"}
              </span>
            </button>

            {reorderOpen && (
              <div className="mt-3 animate-widget-enter">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={enabledSorted.map((w) => w.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1.5">
                      {enabledSorted.map((widget, idx) => {
                        const config = configMap.get(widget.id);
                        if (!config) return null;
                        return (
                          <SortableRow
                            key={widget.id}
                            widget={widget}
                            config={config}
                            isDesktop={isDesktop}
                            isFirst={idx === 0}
                            isLast={idx === enabledSorted.length - 1}
                            onMove={onMove}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
