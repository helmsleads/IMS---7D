import { PreviewType } from "@/lib/dashboard/types";

interface WidgetPreviewProps {
  previewType: PreviewType;
  accent?: "indigo" | "cyan";
}

export default function WidgetPreview({ previewType, accent = "indigo" }: WidgetPreviewProps) {
  const pri = accent === "cyan" ? "#0891B2" : "#4F46E5";
  const priLight = accent === "cyan" ? "#A5F3FC" : "#C7D2FE";
  const s3 = "#CBD5E1"; // slate-300
  const s2 = "#E2E8F0"; // slate-200

  return (
    <svg viewBox="0 0 120 70" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {renderPreview(previewType, pri, priLight, s3, s2)}
    </svg>
  );
}

function renderPreview(type: PreviewType, pri: string, priLight: string, s3: string, s2: string) {
  switch (type) {
    case "bar-chart":
      return (
        <>
          <rect x="10" y="40" width="12" height="25" rx="2" fill={s3} />
          <rect x="28" y="25" width="12" height="40" rx="2" fill={pri} />
          <rect x="46" y="35" width="12" height="30" rx="2" fill={priLight} />
          <rect x="64" y="15" width="12" height="50" rx="2" fill={pri} />
          <rect x="82" y="30" width="12" height="35" rx="2" fill={priLight} />
          <rect x="100" y="20" width="12" height="45" rx="2" fill={s3} />
        </>
      );
    case "line-chart":
      return (
        <>
          <line x1="10" y1="60" x2="110" y2="60" stroke={s2} strokeWidth="1" />
          <polyline points="10,50 30,35 50,42 70,20 90,28 110,15" stroke={pri} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="70" cy="20" r="3" fill={pri} />
          <circle cx="110" cy="15" r="3" fill={pri} />
        </>
      );
    case "area-chart":
      return (
        <>
          <path d="M10,55 L30,40 L50,45 L70,25 L90,30 L110,18 L110,60 L10,60 Z" fill={priLight} opacity="0.4" />
          <polyline points="10,55 30,40 50,45 70,25 90,30 110,18" stroke={pri} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "horizontal-bar":
      return (
        <>
          <rect x="10" y="8" width="80" height="8" rx="2" fill={pri} />
          <rect x="10" y="22" width="60" height="8" rx="2" fill={priLight} />
          <rect x="10" y="36" width="95" height="8" rx="2" fill={pri} />
          <rect x="10" y="50" width="45" height="8" rx="2" fill={s3} />
        </>
      );
    case "stacked-bar":
      return (
        <>
          <rect x="12" y="35" width="12" height="15" rx="1" fill={pri} />
          <rect x="12" y="50" width="12" height="15" rx="1" fill={priLight} />
          <rect x="32" y="25" width="12" height="25" rx="1" fill={pri} />
          <rect x="32" y="50" width="12" height="15" rx="1" fill={priLight} />
          <rect x="52" y="20" width="12" height="30" rx="1" fill={pri} />
          <rect x="52" y="50" width="12" height="15" rx="1" fill={priLight} />
          <rect x="72" y="30" width="12" height="20" rx="1" fill={pri} />
          <rect x="72" y="50" width="12" height="15" rx="1" fill={priLight} />
          <rect x="92" y="15" width="12" height="35" rx="1" fill={pri} />
          <rect x="92" y="50" width="12" height="15" rx="1" fill={priLight} />
        </>
      );
    case "donut":
      return (
        <>
          <circle cx="60" cy="35" r="25" stroke={s2} strokeWidth="10" fill="none" />
          <circle cx="60" cy="35" r="25" stroke={pri} strokeWidth="10" fill="none" strokeDasharray="95 62" strokeLinecap="round" />
          <circle cx="60" cy="35" r="25" stroke={priLight} strokeWidth="10" fill="none" strokeDasharray="35 122" strokeDashoffset="-95" />
        </>
      );
    case "treemap":
      return (
        <>
          <rect x="8" y="8" width="50" height="35" rx="3" fill={pri} />
          <rect x="62" y="8" width="50" height="16" rx="3" fill={priLight} />
          <rect x="62" y="28" width="25" height="15" rx="3" fill={s3} />
          <rect x="90" y="28" width="22" height="15" rx="3" fill={s2} />
          <rect x="8" y="47" width="30" height="18" rx="3" fill={priLight} />
          <rect x="42" y="47" width="35" height="18" rx="3" fill={s3} />
          <rect x="81" y="47" width="31" height="18" rx="3" fill={pri} opacity="0.5" />
        </>
      );
    case "funnel":
      return (
        <>
          <rect x="10" y="8" width="100" height="10" rx="2" fill={pri} />
          <rect x="20" y="22" width="80" height="10" rx="2" fill={pri} opacity="0.8" />
          <rect x="30" y="36" width="60" height="10" rx="2" fill={priLight} />
          <rect x="40" y="50" width="40" height="10" rx="2" fill={s3} />
        </>
      );
    case "heatmap":
      return (
        <>
          {[0, 1, 2, 3, 4, 5].map((row) =>
            [0, 1, 2, 3, 4, 5, 6, 7].map((col) => {
              const colors = [s2, priLight, pri, s3, priLight, pri, s2, s3];
              const opacity = [0.4, 0.6, 1, 0.3, 0.8, 0.5, 0.4, 0.7];
              return (
                <rect
                  key={`${row}-${col}`}
                  x={8 + col * 14}
                  y={5 + row * 11}
                  width="11"
                  height="8"
                  rx="1.5"
                  fill={colors[(row + col) % 8]}
                  opacity={opacity[(row + col) % 8]}
                />
              );
            })
          )}
        </>
      );
    case "gauge":
      return (
        <>
          <path d="M25,55 A35,35 0 0,1 95,55" stroke={s2} strokeWidth="8" fill="none" strokeLinecap="round" />
          <path d="M25,55 A35,35 0 0,1 82,25" stroke={pri} strokeWidth="8" fill="none" strokeLinecap="round" />
          <circle cx="60" cy="55" r="4" fill={pri} />
        </>
      );
    case "scatter":
      return (
        <>
          <line x1="10" y1="60" x2="110" y2="60" stroke={s2} strokeWidth="1" />
          <line x1="10" y1="60" x2="10" y2="5" stroke={s2} strokeWidth="1" />
          <circle cx="25" cy="45" r="4" fill={pri} opacity="0.7" />
          <circle cx="40" cy="30" r="5" fill={pri} opacity="0.8" />
          <circle cx="55" cy="50" r="3" fill={priLight} />
          <circle cx="65" cy="20" r="6" fill={pri} />
          <circle cx="80" cy="35" r="4" fill={priLight} />
          <circle cx="95" cy="15" r="5" fill={pri} opacity="0.6" />
          <circle cx="50" cy="38" r="3.5" fill={s3} />
        </>
      );
    case "waterfall":
      return (
        <>
          <rect x="10" y="10" width="14" height="45" rx="2" fill={pri} />
          <rect x="30" y="25" width="14" height="12" rx="2" fill="#EF4444" opacity="0.7" />
          <rect x="50" y="30" width="14" height="8" rx="2" fill="#EF4444" opacity="0.7" />
          <rect x="70" y="20" width="14" height="10" rx="2" fill="#10B981" />
          <rect x="90" y="22" width="14" height="33" rx="2" fill={pri} />
          <line x1="10" y1="60" x2="110" y2="60" stroke={s2} strokeWidth="1" />
        </>
      );
    case "gantt":
      return (
        <>
          <rect x="30" y="10" width="50" height="8" rx="3" fill={pri} />
          <rect x="20" y="24" width="70" height="8" rx="3" fill={priLight} />
          <rect x="45" y="38" width="40" height="8" rx="3" fill={pri} opacity="0.7" />
          <rect x="55" y="52" width="50" height="8" rx="3" fill={s3} />
          <line x1="8" y1="5" x2="8" y2="65" stroke={s2} strokeWidth="1" />
        </>
      );
    case "calendar":
      return (
        <>
          {[0, 1, 2, 3, 4].map((row) =>
            [0, 1, 2, 3, 4, 5, 6].map((col) => {
              const fills = [s2, s2, priLight, pri, s2, priLight, s2];
              return (
                <rect
                  key={`${row}-${col}`}
                  x={12 + col * 14}
                  y={8 + row * 12}
                  width="10"
                  height="9"
                  rx="2"
                  fill={fills[(row + col) % 7]}
                  opacity={col === 3 && row === 2 ? 1 : 0.6}
                />
              );
            })
          )}
        </>
      );
    case "bullet":
      return (
        <>
          <rect x="10" y="8" width="100" height="12" rx="2" fill={s2} />
          <rect x="10" y="8" width="70" height="12" rx="2" fill={priLight} />
          <rect x="10" y="10" width="50" height="8" rx="1" fill={pri} />
          <line x1="80" y1="6" x2="80" y2="22" stroke={pri} strokeWidth="2" />
          <rect x="10" y="30" width="100" height="12" rx="2" fill={s2} />
          <rect x="10" y="30" width="85" height="12" rx="2" fill={priLight} />
          <rect x="10" y="32" width="60" height="8" rx="1" fill={pri} />
          <line x1="90" y1="28" x2="90" y2="44" stroke={pri} strokeWidth="2" />
          <rect x="10" y="52" width="100" height="12" rx="2" fill={s2} />
          <rect x="10" y="52" width="55" height="12" rx="2" fill={priLight} />
          <rect x="10" y="54" width="40" height="8" rx="1" fill={pri} />
          <line x1="65" y1="50" x2="65" y2="66" stroke={pri} strokeWidth="2" />
        </>
      );
    case "pareto":
      return (
        <>
          <rect x="10" y="20" width="16" height="40" rx="2" fill={pri} />
          <rect x="30" y="30" width="16" height="30" rx="2" fill={priLight} />
          <rect x="50" y="38" width="16" height="22" rx="2" fill={priLight} />
          <rect x="70" y="44" width="16" height="16" rx="2" fill={s3} />
          <rect x="90" y="50" width="16" height="10" rx="2" fill={s2} />
          <polyline points="18,18 38,14 58,11 78,9 98,8" stroke="#EF4444" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="10" y1="60" x2="110" y2="60" stroke={s2} strokeWidth="1" />
        </>
      );
    case "list":
      return (
        <>
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <circle cx="16" cy={14 + i * 15} r="4" fill={i === 0 ? pri : s3} opacity={i === 0 ? 1 : 0.5} />
              <rect x="26" y={11 + i * 15} width={55 - i * 5} height="5" rx="2" fill={i === 0 ? pri : s3} opacity={i === 0 ? 0.8 : 0.3} />
              <rect x="26" y={18 + i * 15} width="35" height="3" rx="1" fill={s2} />
            </g>
          ))}
        </>
      );
    case "timeline":
      return (
        <>
          <line x1="20" y1="8" x2="20" y2="62" stroke={s2} strokeWidth="2" />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <circle cx="20" cy={14 + i * 15} r="4" fill={i < 2 ? pri : s3} />
              <rect x="30" y={10 + i * 15} width={60 - i * 8} height="4" rx="1.5" fill={i < 2 ? pri : s3} opacity={0.7} />
              <rect x="30" y={16 + i * 15} width="30" height="3" rx="1" fill={s2} />
            </g>
          ))}
        </>
      );
    case "action-grid":
      return (
        <>
          <rect x="10" y="8" width="45" height="25" rx="4" fill={pri} opacity="0.15" />
          <rect x="65" y="8" width="45" height="25" rx="4" fill={priLight} opacity="0.3" />
          <rect x="10" y="40" width="45" height="25" rx="4" fill={priLight} opacity="0.3" />
          <rect x="65" y="40" width="45" height="25" rx="4" fill={pri} opacity="0.15" />
          <rect x="24" y="15" width="16" height="3" rx="1" fill={pri} opacity="0.6" />
          <rect x="79" y="15" width="16" height="3" rx="1" fill={pri} opacity="0.4" />
          <rect x="24" y="47" width="16" height="3" rx="1" fill={pri} opacity="0.4" />
          <rect x="79" y="47" width="16" height="3" rx="1" fill={pri} opacity="0.6" />
        </>
      );
    case "progress-bars":
      return (
        <>
          {[0, 1, 2, 3].map((i) => {
            const widths = [85, 60, 40, 95];
            return (
              <g key={i}>
                <rect x="10" y={10 + i * 15} width="100" height="8" rx="3" fill={s2} />
                <rect x="10" y={10 + i * 15} width={widths[i]} height="8" rx="3" fill={i % 2 === 0 ? pri : priLight} />
              </g>
            );
          })}
        </>
      );
    case "count-badge":
      return (
        <>
          <rect x="25" y="10" width="70" height="50" rx="10" fill={pri} opacity="0.1" />
          <rect x="38" y="22" width="44" height="20" rx="6" fill={pri} opacity="0.25" />
          <rect x="48" y="28" width="24" height="8" rx="3" fill={pri} />
        </>
      );
    default:
      return <rect x="10" y="10" width="100" height="50" rx="4" fill={s2} />;
  }
}
