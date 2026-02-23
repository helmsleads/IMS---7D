interface BulletItem {
  label: string;
  current: number;
  target: number;
  max: number;
  color?: string;
}

interface BulletChartProps {
  data: BulletItem[];
}

export default function BulletChart({ data }: BulletChartProps) {
  if (!data || data.length === 0) return null;

  const rowHeight = 40;
  const labelWidth = 100;
  const barAreaWidth = 300;
  const totalWidth = labelWidth + barAreaWidth + 8;
  const totalHeight = data.length * rowHeight + 8;

  return (
    <div className="animate-chart-enter overflow-x-auto">
      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        width="100%"
        preserveAspectRatio="xMinYMid meet"
        role="img"
        aria-label="Bullet chart"
      >
        {data.map((item, i) => {
          const y = i * rowHeight + 4;
          const barY = y + 8;
          const barHeight = 24;
          const color = item.color || "#4F46E5";

          const scale = (v: number) =>
            Math.max(0, Math.min((v / item.max) * barAreaWidth, barAreaWidth));

          const currentWidth = scale(item.current);
          const targetX = scale(item.target);

          return (
            <g key={i}>
              {/* Label */}
              <text
                x={labelWidth - 8}
                y={barY + barHeight / 2}
                textAnchor="end"
                dominantBaseline="central"
                fontSize={12}
                fill="#64748B"
                fontFamily="inherit"
              >
                {item.label}
              </text>

              {/* Max range background */}
              <rect
                x={labelWidth}
                y={barY}
                width={barAreaWidth}
                height={barHeight}
                rx={4}
                ry={4}
                fill="#F1F5F9"
              />

              {/* Target range (lighter shade) */}
              <rect
                x={labelWidth}
                y={barY + 4}
                width={targetX}
                height={barHeight - 8}
                rx={2}
                ry={2}
                fill="#CBD5E1"
              />

              {/* Current value (dark fill) */}
              <rect
                x={labelWidth}
                y={barY + 6}
                width={currentWidth}
                height={barHeight - 12}
                rx={2}
                ry={2}
                fill={color}
              />

              {/* Target marker line */}
              <line
                x1={labelWidth + targetX}
                y1={barY + 2}
                x2={labelWidth + targetX}
                y2={barY + barHeight - 2}
                stroke="#0F172A"
                strokeWidth={2}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
