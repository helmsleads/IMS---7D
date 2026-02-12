"use client";

import React from "react";
import { WidgetLayoutItem } from "@/lib/dashboard/types";
import { LayoutGrid } from "lucide-react";

interface DynamicWidgetGridProps {
  layout: WidgetLayoutItem[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  componentMap: Record<string, React.ComponentType<any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  widgetProps: Record<string, Record<string, any>>;
  loading: boolean;
  onCustomize?: () => void;
  quickAddIds?: string[];
  onQuickAdd?: (id: string) => void;
  quickAddLabels?: Record<string, string>;
}

export default function DynamicWidgetGrid({
  layout,
  componentMap,
  widgetProps,
  loading,
  onCustomize,
  quickAddIds,
  onQuickAdd,
  quickAddLabels,
}: DynamicWidgetGridProps) {
  const enabledWidgets = layout
    .filter((w) => w.enabled)
    .sort((a, b) => a.order - b.order);

  if (enabledWidgets.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <LayoutGrid className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">
          Your dashboard is empty
        </h3>
        <p className="text-slate-500 mb-6">
          Click &quot;Customize&quot; to add widgets.
        </p>
        {quickAddIds && onQuickAdd && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {quickAddIds.map((id) => (
              <button
                key={id}
                onClick={() => onQuickAdd(id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                + {quickAddLabels?.[id] || id}
              </button>
            ))}
          </div>
        )}
        {onCustomize && (
          <button
            onClick={onCustomize}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            Open Customizer
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {enabledWidgets.map((widget, idx) => {
        const Component = componentMap[widget.id];
        if (!Component) return null;

        const props = widgetProps[widget.id] || {};

        return (
          <div
            key={widget.id}
            className={`animate-widget-enter ${
              widget.size === "full" ? "lg:col-span-2" : ""
            }`}
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <Component {...props} loading={loading} />
          </div>
        );
      })}
    </div>
  );
}
