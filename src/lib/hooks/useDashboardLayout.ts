"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { WidgetConfig, WidgetLayoutItem, DashboardLayout } from "@/lib/dashboard/types";
import { generateRecommendedLayout } from "@/lib/dashboard/recommended-presets";
import {
  loadDashboardLayout,
  saveDashboardLayout,
  deleteDashboardLayout,
} from "@/lib/api/dashboard-layouts";

const STORAGE_KEY_PREFIX = "dashboard-layout-";
const DEBOUNCE_MS = 1000;

function getStorageKey(type: "admin" | "portal", ownerId?: string) {
  return ownerId
    ? `${STORAGE_KEY_PREFIX}${type}-${ownerId}`
    : `${STORAGE_KEY_PREFIX}${type}`;
}

function mergeWithRegistry(
  saved: WidgetLayoutItem[],
  registry: WidgetConfig[]
): WidgetLayoutItem[] {
  const savedMap = new Map(saved.map((w) => [w.id, w]));
  const registryIds = new Set(registry.map((w) => w.id));

  // Keep saved widgets that still exist in registry
  const merged: WidgetLayoutItem[] = saved
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
}

function loadFromLocalStorage(
  type: "admin" | "portal",
  registry: WidgetConfig[],
  ownerId?: string
): WidgetLayoutItem[] | null {
  try {
    const raw = localStorage.getItem(getStorageKey(type, ownerId));
    if (!raw) return null;

    const parsed: DashboardLayout = JSON.parse(raw);
    if (parsed.version !== 1) return null;

    return mergeWithRegistry(parsed.widgets, registry);
  } catch {
    return null;
  }
}

function saveToLocalStorage(
  type: "admin" | "portal",
  widgets: WidgetLayoutItem[],
  ownerId?: string
) {
  const layout: DashboardLayout = { version: 1, widgets };
  try {
    localStorage.setItem(getStorageKey(type, ownerId), JSON.stringify(layout));
  } catch {
    // localStorage full or unavailable
  }
}

export function useDashboardLayout(
  dashboardType: "admin" | "portal",
  registry: WidgetConfig[],
  ownerId?: string,
  ownerType?: "user" | "client"
) {
  const [widgets, setWidgets] = useState<WidgetLayoutItem[]>(() => {
    // Try localStorage first (fast cache), then fall back to recommended preset
    const cached = loadFromLocalStorage(dashboardType, registry, ownerId);
    if (cached) return cached;
    return generateRecommendedLayout(dashboardType, registry);
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ownerIdRef = useRef(ownerId);
  const ownerTypeRef = useRef(ownerType);
  ownerIdRef.current = ownerId;
  ownerTypeRef.current = ownerType;

  // Sync from Supabase on mount (or when ownerId changes)
  useEffect(() => {
    if (!ownerId || !ownerType) return;

    let cancelled = false;

    (async () => {
      const remote = await loadDashboardLayout(ownerType, ownerId, dashboardType);
      if (cancelled) return;

      if (remote && remote.version === 1) {
        const merged = mergeWithRegistry(remote.widgets, registry);
        setWidgets(merged);
        saveToLocalStorage(dashboardType, merged, ownerId);
      }
      // If no remote layout found, user keeps seeing the recommended preset
      // (or their local cache). No action needed.
    })();

    return () => {
      cancelled = true;
    };
  }, [ownerId, ownerType, dashboardType, registry]);

  const recommendedDefaults = useMemo(
    () => generateRecommendedLayout(dashboardType, registry),
    [dashboardType, registry]
  );

  const enabledWidgets = useMemo(
    () => widgets.filter((w) => w.enabled).sort((a, b) => a.order - b.order),
    [widgets]
  );

  const isCustomized = useMemo(() => {
    if (widgets.length !== recommendedDefaults.length) return true;
    return widgets.some((w) => {
      const d = recommendedDefaults.find((def) => def.id === w.id);
      return !d || w.enabled !== d.enabled || w.order !== d.order || w.size !== d.size;
    });
  }, [widgets, recommendedDefaults]);

  const debouncedSupabaseSave = useCallback(
    (next: WidgetLayoutItem[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const id = ownerIdRef.current;
        const type = ownerTypeRef.current;
        if (id && type) {
          saveDashboardLayout(type, id, dashboardType, {
            version: 1,
            widgets: next,
          });
        }
      }, DEBOUNCE_MS);
    },
    [dashboardType]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const update = useCallback(
    (next: WidgetLayoutItem[]) => {
      setWidgets(next);
      saveToLocalStorage(dashboardType, next, ownerIdRef.current);
      debouncedSupabaseSave(next);
    },
    [dashboardType, debouncedSupabaseSave]
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
    const next = generateRecommendedLayout(dashboardType, registry);
    setWidgets(next);
    // Clear localStorage
    try {
      localStorage.removeItem(getStorageKey(dashboardType, ownerIdRef.current));
    } catch {
      // ignore
    }
    // Delete from Supabase
    const id = ownerIdRef.current;
    const type = ownerTypeRef.current;
    if (id && type) {
      deleteDashboardLayout(type, id, dashboardType);
    }
  }, [dashboardType, registry]);

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
