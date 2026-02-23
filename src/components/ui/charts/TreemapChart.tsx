"use client";

import { Treemap, ResponsiveContainer, Tooltip } from "recharts";

interface TreemapItem {
  name: string;
  value: number;
  color: string;
}

interface TreemapChartProps {
  data: TreemapItem[];
  height?: number;
  valueFormatter?: (value: number) => string;
}

// Custom content renderer for treemap cells
function CustomContent(props: {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  color: string;
  value: number;
}) {
  const { x, y, width, height, name, color } = props;
  if (width < 30 || height < 20) return null;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        rx={4}
        ry={4}
        stroke="#fff"
        strokeWidth={2}
      />
      {width > 60 && height > 30 && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontSize={width > 100 ? 12 : 10}
          fontWeight={600}
        >
          {name.length > Math.floor(width / 8) ? name.slice(0, Math.floor(width / 8)) + "..." : name}
        </text>
      )}
    </g>
  );
}

function CustomTooltip({
  active,
  payload,
  valueFormatter,
}: {
  active?: boolean;
  payload?: Array<{ payload: TreemapItem }>;
  valueFormatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-slate-700">{d.name}</p>
      <p className="text-slate-900 font-semibold">
        {valueFormatter ? valueFormatter(d.value) : d.value.toLocaleString()}
      </p>
    </div>
  );
}

export default function TreemapChart({
  data,
  height = 200,
  valueFormatter,
}: TreemapChartProps) {
  if (!data || data.length === 0) return null;

  // Recharts Treemap expects data in a specific nested format
  const treemapData = [{ name: "root", children: data }];

  return (
    <div className="animate-chart-enter" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={treemapData}
          dataKey="value"
          aspectRatio={4 / 3}
          stroke="none"
          content={<CustomContent x={0} y={0} width={0} height={0} name="" color="" value={0} />}
          isAnimationActive={true}
          animationDuration={800}
        >
          <Tooltip content={<CustomTooltip valueFormatter={valueFormatter} />} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
