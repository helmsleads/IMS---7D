export interface WidgetConfig {
  id: string;
  title: string;
  description: string;
  category: "core" | "operational" | "analytics" | "communication";
  defaultEnabled: boolean;
  defaultOrder: number;
  defaultSize: "half" | "full";
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
