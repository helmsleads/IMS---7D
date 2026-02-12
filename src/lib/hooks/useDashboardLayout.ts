"use client";

import { useState, useCallback, useMemo } from "react";
import { WidgetConfig, WidgetLayoutItem, DashboardLayout } from "@/lib/dashboard/types";

const STORAGE_KEY_PREFIX = "dashboard-layout-";

function getStorageKey(type: "admin" | "portal") {
  return `${STORAGE_KEY_PREFIX}${type}`;
}

function generateDefaults(registry: WidgetConfig[]): WidgetLayoutItem[] {
  return registry.map((w) => ({
    id: w.id,
    enabled: w.defaultEnabled,
    order: w.defaultOrder,
    size: w.defaultSize,
  }));
}

function loadLayout(type: "admin" | "portal", registry: WidgetConfig[]): WidgetLayoutItem[] {
  try {
    const raw = localStorage.getItem(getStorageKey(type));
    if (!raw) return generateDefaults(registry);

    const parsed: DashboardLayout = JSON.parse(raw);
    if (parsed.version !== 1) return generateDefaults(registry);

    const savedMap = new Map(parsed.widgets.map((w) => [w.id, w]));
    const registryIds = new Set(registry.map((w) => w.id));

    // Keep saved widgets that still exist in registry
    const merged: WidgetLayoutItem[] = parsed.widgets
      .filter((w) => registryIds.has(w.id))
      .map((w) => ({
        id: w.id,
        enabled: w.enabled,
        order: w.order,
        size: w.size === "half" || w.size === "full" ? w.size : "half",
      }));

    // Append new widgets from registry that aren't in saved layout
    const maxOrder = merged.length > 0 ? Math.max(...merged.map((w) => w.order)) : -1;
    let nextOrder = maxOrder + 1;
    for (const config of registry) {
      if (!savedMap.has(config.id)) {
        merged.push({
          id: config.id,
          enabled: false,
          order: nextOrder++,
          size: config.defaultSize,
        });
      }
    }

    return merged.sort((a, b) => a.order - b.order);
  } catch {
    return generateDefaults(registry);
  }
}

function saveLayout(type: "admin" | "portal", widgets: WidgetLayoutItem[]) {
  const layout: DashboardLayout = { version: 1, widgets };
  try {
    localStorage.setItem(getStorageKey(type), JSON.stringify(layout));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

export function useDashboardLayout(
  dashboardType: "admin" | "portal",
  registry: WidgetConfig[]
) {
  const [widgets, setWidgets] = useState<WidgetLayoutItem[]>(() =>
    loadLayout(dashboardType, registry)
  );

  const enabledWidgets = useMemo(
    () => widgets.filter((w) => w.enabled).sort((a, b) => a.order - b.order),
    [widgets]
  );

  const defaults = useMemo(() => generateDefaults(registry), [registry]);
  const isCustomized = useMemo(() => {
    if (widgets.length !== defaults.length) return true;
    return widgets.some((w, i) => {
      const d = defaults.find((def) => def.id === w.id);
      return !d || w.enabled !== d.enabled || w.order !== d.order || w.size !== d.size;
    });
  }, [widgets, defaults]);

  const update = useCallback(
    (next: WidgetLayoutItem[]) => {
      setWidgets(next);
      saveLayout(dashboardType, next);
    },
    [dashboardType]
  );

  const toggleWidget = useCallback(
    (id: string) => {
      const next = widgets.map((w) =>
        w.id === id ? { ...w, enabled: !w.enabled } : w
      );
      update(next);
    },
    [widgets, update]
  );

  const moveWidget = useCallback(
    (id: string, direction: "up" | "down") => {
      const sorted = [...widgets].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((w) => w.id === id);
      if (idx < 0) return;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return;

      // Swap orders
      const temp = sorted[idx].order;
      sorted[idx] = { ...sorted[idx], order: sorted[swapIdx].order };
      sorted[swapIdx] = { ...sorted[swapIdx], order: temp };

      update(sorted);
    },
    [widgets, update]
  );

  const reorderByIds = useCallback(
    (orderedIds: string[]) => {
      const widgetMap = new Map(widgets.map((w) => [w.id, w]));
      const next = orderedIds.map((id, idx) => ({
        ...widgetMap.get(id)!,
        order: idx,
      }));
      // Include any widgets not in orderedIds (shouldn't happen but be safe)
      const remaining = widgets.filter((w) => !orderedIds.includes(w.id));
      let nextOrder = next.length;
      for (const w of remaining) {
        next.push({ ...w, order: nextOrder++ });
      }
      update(next);
    },
    [widgets, update]
  );

  const resizeWidget = useCallback(
    (id: string, size: "half" | "full") => {
      const next = widgets.map((w) =>
        w.id === id ? { ...w, size } : w
      );
      update(next);
    },
    [widgets, update]
  );

  const resetToDefaults = useCallback(() => {
    const next = generateDefaults(registry);
    update(next);
  }, [registry, update]);

  return {
    widgets,
    enabledWidgets,
    isCustomized,
    toggleWidget,
    moveWidget,
    reorderByIds,
    resizeWidget,
    resetToDefaults,
  };
}
