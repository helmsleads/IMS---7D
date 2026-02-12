"use client";

interface Props {
  size: "half" | "full";
  onChange: (size: "half" | "full") => void;
}

export default function WidgetSizeSelector({ size, onChange }: Props) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => onChange("half")}
        className={`px-2.5 py-1 text-xs font-medium transition-colors ${
          size === "half"
            ? "bg-slate-900 text-white"
            : "bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        Half
      </button>
      <button
        type="button"
        onClick={() => onChange("full")}
        className={`px-2.5 py-1 text-xs font-medium transition-colors border-l border-slate-200 ${
          size === "full"
            ? "bg-slate-900 text-white"
            : "bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        Full
      </button>
    </div>
  );
}
