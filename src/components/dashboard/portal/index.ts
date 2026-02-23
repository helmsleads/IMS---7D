import React from "react";
import UnreadMessagesWidget from "./UnreadMessagesWidget";
import OpenReturnsWidget from "./OpenReturnsWidget";
import ProfitabilityWidget from "./ProfitabilityWidget";
import RecentOrdersWidget from "./RecentOrdersWidget";
import RecentArrivalsWidget from "./RecentArrivalsWidget";
import ActiveOrdersWidget from "./ActiveOrdersWidget";
import QuickActionsWidget from "./QuickActionsWidget";
import InventoryValueOverTimeWidget from "./InventoryValueOverTimeWidget";
import OrderFulfillmentSpeedWidget from "./OrderFulfillmentSpeedWidget";
import SpendingBreakdownWidget from "./SpendingBreakdownWidget";
import ProductPerformanceWidget from "./ProductPerformanceWidget";
import StockProjectionWidget from "./StockProjectionWidget";

export {
  UnreadMessagesWidget,
  OpenReturnsWidget,
  ProfitabilityWidget,
  RecentOrdersWidget,
  RecentArrivalsWidget,
  ActiveOrdersWidget,
  QuickActionsWidget,
  InventoryValueOverTimeWidget,
  OrderFulfillmentSpeedWidget,
  SpendingBreakdownWidget,
  ProductPerformanceWidget,
  StockProjectionWidget,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PORTAL_WIDGET_COMPONENTS: Record<string, React.ComponentType<any>> = {
  "unread-messages": UnreadMessagesWidget,
  "open-returns": OpenReturnsWidget,
  "profitability": ProfitabilityWidget,
  "recent-orders": RecentOrdersWidget,
  "recent-arrivals": RecentArrivalsWidget,
  "active-orders": ActiveOrdersWidget,
  "quick-actions": QuickActionsWidget,
  "inventory-value-over-time": InventoryValueOverTimeWidget,
  "order-fulfillment-speed": OrderFulfillmentSpeedWidget,
  "spending-breakdown": SpendingBreakdownWidget,
  "product-performance": ProductPerformanceWidget,
  "stock-projection": StockProjectionWidget,
};
