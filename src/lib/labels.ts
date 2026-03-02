// Shared container type label maps for product UOM display

export const CONTAINER_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  bottle: { label: "Bottle", color: "bg-blue-100 text-blue-700" },
  can: { label: "Can/RTD", color: "bg-orange-100 text-orange-700" },
  keg: { label: "Keg", color: "bg-amber-100 text-amber-700" },
  bag_in_box: { label: "BIB", color: "bg-teal-100 text-teal-700" },
  gift_box: { label: "Box", color: "bg-pink-100 text-pink-700" },
  raw_materials: { label: "Raw Mat", color: "bg-stone-100 text-stone-700" },
  empty_bottle: { label: "Empty", color: "bg-gray-100 text-gray-600" },
  merchandise: { label: "Merch", color: "bg-purple-100 text-purple-700" },
  sample: { label: "Sample", color: "bg-cyan-100 text-cyan-700" },
  other: { label: "Other", color: "bg-gray-100 text-gray-600" },
};

export const CONTAINER_UNIT_LABELS: Record<string, string> = {
  bottle: "Bottles",
  can: "Cans",
  keg: "Kegs",
  bag_in_box: "Units",
  gift_box: "Units",
  raw_materials: "Units",
  empty_bottle: "Bottles",
  merchandise: "Units",
  sample: "ML",
  other: "Units",
};

export function getContainerBadge(ct: string | null | undefined): { label: string; color: string } {
  const key = ct || "other";
  return CONTAINER_TYPE_LABELS[key] || CONTAINER_TYPE_LABELS.other;
}

export function getUnitLabel(ct: string | null | undefined): string {
  const key = ct || "other";
  return CONTAINER_UNIT_LABELS[key] || "Units";
}
