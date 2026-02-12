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
};
