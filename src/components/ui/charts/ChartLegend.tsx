interface LegendItem {
  label: string;
  color: string;
  value?: string | number;
}

interface ChartLegendProps {
  items: LegendItem[];
  layout?: "horizontal" | "vertical";
}

export default function ChartLegend({
  items,
  layout = "horizontal",
}: ChartLegendProps) {
  return (
    <div
      className={`flex ${
        layout === "horizontal"
          ? "flex-wrap items-center gap-x-4 gap-y-1"
          : "flex-col gap-2"
      }`}
    >
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-sm">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-slate-600">{item.label}</span>
          {item.value !== undefined && (
            <span className="font-medium text-slate-900">{item.value}</span>
          )}
        </div>
      ))}
    </div>
  );
}
