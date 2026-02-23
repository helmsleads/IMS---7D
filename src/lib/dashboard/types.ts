export type PreviewType =
  | "bar-chart"
  | "line-chart"
  | "area-chart"
  | "horizontal-bar"
  | "stacked-bar"
  | "donut"
  | "treemap"
  | "funnel"
  | "heatmap"
  | "gauge"
  | "scatter"
  | "waterfall"
  | "gantt"
  | "calendar"
  | "bullet"
  | "pareto"
  | "list"
  | "timeline"
  | "action-grid"
  | "progress-bars"
  | "count-badge";

export interface WidgetConfig {
  id: string;
  title: string;
  description: string;
  category: "core" | "operational" | "analytics" | "communication";
  defaultEnabled: boolean;
  defaultOrder: number;
  defaultSize: "half" | "full";
  previewType?: PreviewType;
  comingSoon?: boolean;
}

export interface WidgetLayoutItem {
  id: string;
  enabled: boolean;
  order: number;
  size: "half" | "full";
}

export interface DashboardLayout {
  version: 1;
  widgets: WidgetLayoutItem[];
}
