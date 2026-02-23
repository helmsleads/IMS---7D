import Card from "@/components/ui/Card";
import { StockHeatmapCell } from "@/lib/api/dashboard";
import { Grid3x3 } from "lucide-react";
import { Fragment } from "react";

interface Props {
  heatmapData: StockHeatmapCell[];
}

function getCellColor(fillPercent: number): string {
  if (fillPercent <= 0) return "#F1F5F9"; // slate-100
  if (fillPercent <= 30) return "#DBEAFE"; // blue-100
  if (fillPercent <= 60) return "#93C5FD"; // blue-300
  if (fillPercent <= 90) return "#818CF8"; // indigo-400
  return "#4F46E5"; // indigo-600
}

function getCellTextColor(fillPercent: number): string {
  if (fillPercent <= 60) return "#334155"; // slate-700
  return "#FFFFFF";
}

export default function StockLevelHeatmapWidget({ heatmapData }: Props) {
  // Build unique products (rows) and locations (columns)
  const productNames = [...new Set(heatmapData.map((c) => c.productName))];
  const locationNames = [...new Set(heatmapData.map((c) => c.locationName))];

  // Build a lookup map
  const cellMap = new Map<string, number>();
  for (const cell of heatmapData) {
    cellMap.set(`${cell.productName}|${cell.locationName}`, cell.fillPercent);
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Stock Level Heatmap
        </h3>
      </div>
      {heatmapData.length > 0 ? (
        <div className="overflow-x-auto">
          <div
            className="inline-grid gap-px"
            style={{
              gridTemplateColumns: `120px repeat(${locationNames.length}, minmax(60px, 1fr))`,
            }}
          >
            {/* Header row: empty corner + location names */}
            <div className="text-xs font-medium text-slate-400 p-1" />
            {locationNames.map((loc) => (
              <div
                key={loc}
                className="text-xs font-medium text-slate-500 p-1 text-center truncate"
                title={loc}
              >
                {loc.length > 8 ? loc.slice(0, 8) + "..." : loc}
              </div>
            ))}

            {/* Data rows */}
            {productNames.map((product) => (
              <Fragment key={product}>
                <div
                  className="text-xs text-slate-600 p-1 truncate flex items-center"
                  title={product}
                >
                  {product.length > 14
                    ? product.slice(0, 14) + "..."
                    : product}
                </div>
                {locationNames.map((loc) => {
                  const fill = cellMap.get(`${product}|${loc}`) ?? -1;
                  return (
                    <div
                      key={`${product}|${loc}`}
                      className="rounded-sm text-[10px] font-medium flex items-center justify-center p-1 min-h-[28px]"
                      style={{
                        backgroundColor:
                          fill >= 0 ? getCellColor(fill) : "#F8FAFC",
                        color:
                          fill >= 0 ? getCellTextColor(fill) : "#CBD5E1",
                      }}
                      title={
                        fill >= 0
                          ? `${product} @ ${loc}: ${fill}%`
                          : `${product} @ ${loc}: N/A`
                      }
                    >
                      {fill >= 0 ? `${fill}%` : "—"}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 mt-3 text-[10px] text-slate-500">
            <span>Fill %:</span>
            {[
              { label: "0", color: "#F1F5F9" },
              { label: "1-30", color: "#DBEAFE" },
              { label: "31-60", color: "#93C5FD" },
              { label: "61-90", color: "#818CF8" },
              { label: "91-100", color: "#4F46E5" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <Grid3x3 className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 text-sm">No stock level data yet</p>
        </div>
      )}
    </Card>
  );
}
