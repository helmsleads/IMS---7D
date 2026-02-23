interface GaugeChartProps {
  value: number; // 0-100
  label?: string;
  color?: string;
}

export default function GaugeChart({
  value,
  label,
  color = "#4F46E5",
}: GaugeChartProps) {
  const clampedValue = Math.max(0, Math.min(100, value));

  // SVG arc parameters
  const cx = 100;
  const cy = 90;
  const r = 70;
  const strokeWidth = 14;

  // Arc from 180 deg to 0 deg (left to right semicircle)
  const startAngle = Math.PI;
  const endAngle = 0;
  const totalAngle = startAngle - endAngle;
  const valueAngle = startAngle - (clampedValue / 100) * totalAngle;

  // Convert polar to cartesian
  const polarToCartesian = (angle: number) => ({
    x: cx + r * Math.cos(angle),
    y: cy - r * Math.sin(angle),
  });

  // Background arc path (full semicircle)
  const bgStart = polarToCartesian(startAngle);
  const bgEnd = polarToCartesian(endAngle);
  const bgPath = `M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 0 1 ${bgEnd.x} ${bgEnd.y}`;

  // Value arc path
  const valStart = polarToCartesian(startAngle);
  const valEnd = polarToCartesian(valueAngle);
  const largeArc = clampedValue > 50 ? 1 : 0;
  const valPath =
    clampedValue > 0
      ? `M ${valStart.x} ${valStart.y} A ${r} ${r} 0 ${largeArc} 1 ${valEnd.x} ${valEnd.y}`
      : "";

  return (
    <div className="animate-chart-enter flex justify-center">
      <svg viewBox="0 0 200 120" width="200" height="120" role="img" aria-label={`Gauge: ${clampedValue}%`}>
        {/* Background arc */}
        <path
          d={bgPath}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Value arc */}
        {valPath && (
          <path
            d={valPath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}
        {/* Value text */}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={28}
          fontWeight={700}
          fill="#0F172A"
          fontFamily="inherit"
        >
          {clampedValue}%
        </text>
        {/* Label */}
        {label && (
          <text
            x={cx}
            y={cy + 18}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            fill="#64748B"
            fontFamily="inherit"
          >
            {label}
          </text>
        )}
      </svg>
    </div>
  );
}
