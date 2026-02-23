type EntityType = "outbound" | "inbound" | "return" | "inventory" | "lot";

interface StatusColors {
  bg: string;
  text: string;
  dot: string;
}

const statusColorMap: Record<string, Record<string, StatusColors>> = {
  outbound: {
    pending: { bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-500" },
    confirmed: { bg: "bg-blue-100", text: "text-blue-800", dot: "bg-blue-500" },
    processing: { bg: "bg-blue-100", text: "text-blue-800", dot: "bg-blue-500" },
    picking: { bg: "bg-purple-100", text: "text-purple-800", dot: "bg-purple-500" },
    packing: { bg: "bg-indigo-100", text: "text-indigo-800", dot: "bg-indigo-500" },
    packed: { bg: "bg-indigo-100", text: "text-indigo-800", dot: "bg-indigo-500" },
    ready_to_ship: { bg: "bg-cyan-100", text: "text-cyan-800", dot: "bg-cyan-500" },
    shipped: { bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500" },
    delivered: { bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500" },
    cancelled: { bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500" },
    on_hold: { bg: "bg-orange-100", text: "text-orange-800", dot: "bg-orange-500" },
    partially_shipped: { bg: "bg-teal-100", text: "text-teal-800", dot: "bg-teal-500" },
  },
  inbound: {
    pending: { bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-500" },
    scheduled: { bg: "bg-blue-100", text: "text-blue-800", dot: "bg-blue-500" },
    in_transit: { bg: "bg-purple-100", text: "text-purple-800", dot: "bg-purple-500" },
    arrived: { bg: "bg-indigo-100", text: "text-indigo-800", dot: "bg-indigo-500" },
    receiving: { bg: "bg-cyan-100", text: "text-cyan-800", dot: "bg-cyan-500" },
    received: { bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500" },
    completed: { bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500" },
    cancelled: { bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500" },
    partially_received: { bg: "bg-teal-100", text: "text-teal-800", dot: "bg-teal-500" },
  },
  return: {
    requested: { bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-500" },
    pending: { bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-500" },
    approved: { bg: "bg-blue-100", text: "text-blue-800", dot: "bg-blue-500" },
    denied: { bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500" },
    shipped: { bg: "bg-blue-100", text: "text-blue-800", dot: "bg-blue-500" },
    in_transit: { bg: "bg-purple-100", text: "text-purple-800", dot: "bg-purple-500" },
    received: { bg: "bg-cyan-100", text: "text-cyan-800", dot: "bg-cyan-500" },
    processing: { bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-500" },
    inspecting: { bg: "bg-indigo-100", text: "text-indigo-800", dot: "bg-indigo-500" },
    completed: { bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500" },
    rejected: { bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500" },
    cancelled: { bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500" },
  },
  inventory: {
    in_stock: { bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500" },
    low_stock: { bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-500" },
    out_of_stock: { bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500" },
    reserved: { bg: "bg-blue-100", text: "text-blue-800", dot: "bg-blue-500" },
    damaged: { bg: "bg-orange-100", text: "text-orange-800", dot: "bg-orange-500" },
  },
  lot: {
    active: { bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500" },
    quarantine: { bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-500" },
    expired: { bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500" },
    recalled: { bg: "bg-orange-100", text: "text-orange-800", dot: "bg-orange-500" },
    depleted: { bg: "bg-gray-100", text: "text-gray-800", dot: "bg-gray-500" },
    released: { bg: "bg-blue-100", text: "text-blue-800", dot: "bg-blue-500" },
  },
};

const defaultColors: StatusColors = {
  bg: "bg-gray-100",
  text: "text-gray-800",
  dot: "bg-gray-500",
};

export function getStatusColor(status: string, entityType: EntityType): StatusColors {
  const normalized = status.toLowerCase().replace(/\s+/g, "_");
  return statusColorMap[entityType]?.[normalized] ?? defaultColors;
}

export type { EntityType, StatusColors };
