import { WidgetConfig, WidgetLayoutItem } from "./types";

interface PresetEntry {
  id: string;
  size: "half" | "full";
}

const ADMIN_PRESET: PresetEntry[] = [
  { id: "attention-required", size: "full" },
  { id: "orders-summary", size: "half" },
  { id: "inventory-overview", size: "half" },
  { id: "low-stock-alerts", size: "half" },
  { id: "orders-to-ship", size: "half" },
  { id: "expected-arrivals", size: "half" },
  { id: "order-velocity", size: "half" },
  { id: "fulfillment-funnel", size: "half" },
  { id: "on-time-shipment", size: "half" },
  { id: "inbound-outbound-flow", size: "full" },
  { id: "recent-activity", size: "full" },
  { id: "outstanding-invoices", size: "half" },
  { id: "pending-returns", size: "half" },
  { id: "unread-messages", size: "half" },
  { id: "quick-actions", size: "half" },
];

const PORTAL_PRESET: PresetEntry[] = [
  { id: "profitability", size: "half" },
  { id: "unread-messages", size: "half" },
  { id: "active-orders", size: "half" },
  { id: "open-returns", size: "half" },
  { id: "inventory-value-over-time", size: "full" },
  { id: "order-fulfillment-speed", size: "half" },
  { id: "spending-breakdown", size: "half" },
  { id: "recent-orders", size: "full" },
  { id: "quick-actions", size: "half" },
];

/**
 * Generates a recommended starting layout for new users.
 * Preset widgets are enabled at specified order/size;
 * remaining registry widgets are appended as disabled.
 */
export function generateRecommendedLayout(
  type: "admin" | "portal",
  registry: WidgetConfig[]
): WidgetLayoutItem[] {
  const preset = type === "admin" ? ADMIN_PRESET : PORTAL_PRESET;
  const presetMap = new Map(preset.map((p, i) => [p.id, { order: i, size: p.size }]));
  const registryIds = new Set(registry.map((w) => w.id));

  const items: WidgetLayoutItem[] = [];

  // Add preset widgets (enabled) — only those that exist in the registry
  for (const entry of preset) {
    if (registryIds.has(entry.id)) {
      items.push({
        id: entry.id,
        enabled: true,
        order: presetMap.get(entry.id)!.order,
        size: presetMap.get(entry.id)!.size,
      });
    }
  }

  // Append remaining registry widgets as disabled
  let nextOrder = items.length;
  for (const config of registry) {
    if (!presetMap.has(config.id)) {
      items.push({
        id: config.id,
        enabled: false,
        order: nextOrder++,
        size: config.defaultSize,
      });
    }
  }

  return items;
}
