import React from "react";
import RecentActivityWidget from "./RecentActivityWidget";
import QuickActionsWidget from "./QuickActionsWidget";
import AttentionRequiredWidget from "./AttentionRequiredWidget";
import LowStockAlertsWidget from "./LowStockAlertsWidget";
import ExpectedArrivalsWidget from "./ExpectedArrivalsWidget";
import OrdersToShipWidget from "./OrdersToShipWidget";
import OrdersSummaryWidget from "./OrdersSummaryWidget";
import InventoryOverviewWidget from "./InventoryOverviewWidget";
import PendingReturnsWidget from "./PendingReturnsWidget";
import UnreadMessagesWidget from "./UnreadMessagesWidget";
import ExpiringLotsWidget from "./ExpiringLotsWidget";
import InventoryAgingWidget from "./InventoryAgingWidget";
import OrderVelocityWidget from "./OrderVelocityWidget";
import OutstandingInvoicesWidget from "./OutstandingInvoicesWidget";
import FulfillmentFunnelWidget from "./FulfillmentFunnelWidget";
import InboundOutboundFlowWidget from "./InboundOutboundFlowWidget";
import InventoryValueTreemapWidget from "./InventoryValueTreemapWidget";
import OnTimeShipmentWidget from "./OnTimeShipmentWidget";
import InvoiceAgingWidget from "./InvoiceAgingWidget";
import SupplierLeadTimeWidget from "./SupplierLeadTimeWidget";
import ReturnRateWidget from "./ReturnRateWidget";
import DaysOfSupplyWidget from "./DaysOfSupplyWidget";
import RevenueByClientWidget from "./RevenueByClientWidget";
import DailyThroughputWidget from "./DailyThroughputWidget";
import OrderCycleTimeWidget from "./OrderCycleTimeWidget";
import ABCAnalysisWidget from "./ABCAnalysisWidget";
import InventoryTurnoverWidget from "./InventoryTurnoverWidget";
import StockLevelHeatmapWidget from "./StockLevelHeatmapWidget";
import ReorderProximityWidget from "./ReorderProximityWidget";
import InventoryAccuracyWidget from "./InventoryAccuracyWidget";
import ProfitMarginWaterfallWidget from "./ProfitMarginWaterfallWidget";
import MonthlyRevenueTrendWidget from "./MonthlyRevenueTrendWidget";
import StorageRevenueWidget from "./StorageRevenueWidget";
import ReceivingAccuracyWidget from "./ReceivingAccuracyWidget";
import InboundForecastWidget from "./InboundForecastWidget";
import ReturnsByReasonWidget from "./ReturnsByReasonWidget";
import DamageRateTrendWidget from "./DamageRateTrendWidget";
import ExpirationTimelineWidget from "./ExpirationTimelineWidget";
import FEFOComplianceWidget from "./FEFOComplianceWidget";

export {
  RecentActivityWidget,
  QuickActionsWidget,
  AttentionRequiredWidget,
  LowStockAlertsWidget,
  ExpectedArrivalsWidget,
  OrdersToShipWidget,
  OrdersSummaryWidget,
  InventoryOverviewWidget,
  PendingReturnsWidget,
  UnreadMessagesWidget,
  ExpiringLotsWidget,
  InventoryAgingWidget,
  OrderVelocityWidget,
  OutstandingInvoicesWidget,
  FulfillmentFunnelWidget,
  InboundOutboundFlowWidget,
  InventoryValueTreemapWidget,
  OnTimeShipmentWidget,
  InvoiceAgingWidget,
  SupplierLeadTimeWidget,
  ReturnRateWidget,
  DaysOfSupplyWidget,
  RevenueByClientWidget,
  DailyThroughputWidget,
  OrderCycleTimeWidget,
  ABCAnalysisWidget,
  InventoryTurnoverWidget,
  StockLevelHeatmapWidget,
  ReorderProximityWidget,
  InventoryAccuracyWidget,
  ProfitMarginWaterfallWidget,
  MonthlyRevenueTrendWidget,
  StorageRevenueWidget,
  ReceivingAccuracyWidget,
  InboundForecastWidget,
  ReturnsByReasonWidget,
  DamageRateTrendWidget,
  ExpirationTimelineWidget,
  FEFOComplianceWidget,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ADMIN_WIDGET_COMPONENTS: Record<string, React.ComponentType<any>> = {
  "recent-activity": RecentActivityWidget,
  "quick-actions": QuickActionsWidget,
  "attention-required": AttentionRequiredWidget,
  "low-stock-alerts": LowStockAlertsWidget,
  "expected-arrivals": ExpectedArrivalsWidget,
  "orders-to-ship": OrdersToShipWidget,
  "orders-summary": OrdersSummaryWidget,
  "inventory-overview": InventoryOverviewWidget,
  "pending-returns": PendingReturnsWidget,
  "unread-messages": UnreadMessagesWidget,
  "expiring-lots": ExpiringLotsWidget,
  "inventory-aging": InventoryAgingWidget,
  "order-velocity": OrderVelocityWidget,
  "outstanding-invoices": OutstandingInvoicesWidget,
  "fulfillment-funnel": FulfillmentFunnelWidget,
  "inbound-outbound-flow": InboundOutboundFlowWidget,
  "inventory-value-treemap": InventoryValueTreemapWidget,
  "on-time-shipment": OnTimeShipmentWidget,
  "invoice-aging": InvoiceAgingWidget,
  "supplier-lead-times": SupplierLeadTimeWidget,
  "return-rates": ReturnRateWidget,
  "days-of-supply": DaysOfSupplyWidget,
  "revenue-by-client": RevenueByClientWidget,
  "daily-throughput": DailyThroughputWidget,
  "order-cycle-time": OrderCycleTimeWidget,
  "abc-analysis": ABCAnalysisWidget,
  "inventory-turnover": InventoryTurnoverWidget,
  "stock-level-heatmap": StockLevelHeatmapWidget,
  "reorder-proximity": ReorderProximityWidget,
  "inventory-accuracy": InventoryAccuracyWidget,
  "profit-margin-waterfall": ProfitMarginWaterfallWidget,
  "monthly-revenue-trend": MonthlyRevenueTrendWidget,
  "storage-revenue-sqft": StorageRevenueWidget,
  "receiving-accuracy": ReceivingAccuracyWidget,
  "inbound-forecast": InboundForecastWidget,
  "returns-by-reason": ReturnsByReasonWidget,
  "damage-rate-trend": DamageRateTrendWidget,
  "expiration-timeline": ExpirationTimelineWidget,
  "fefo-compliance": FEFOComplianceWidget,
};
