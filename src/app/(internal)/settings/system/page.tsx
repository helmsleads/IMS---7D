"use client";

import { useState, useEffect, ChangeEvent } from "react";
import AppShell from "@/components/internal/AppShell";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import {
  Building2,
  Package,
  Truck,
  PackageCheck,
  CreditCard,
  Bell,
  Shield,
  Loader2,
  Save,
  Check,
  AlertCircle,
  RefreshCw,
  Play,
  Database,
  Clock,
  Users,
  UserPlus,
  X,
  Pencil,
  UserX,
  UserCheck,
  Mail,
  Tag,
  Trash2,
  ExternalLink,
  Unplug,
  BookOpen,
  CalendarCheck,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { getSystemSettings, setSystemSetting } from "@/lib/api/settings";
import { takeStorageSnapshot } from "@/lib/api/billing-automation";
import {
  getInternalUsers,
  createInternalUser,
  inviteInternalUser,
  updateInternalUser,
  deactivateInternalUser,
  reactivateInternalUser,
  InternalUser,
} from "@/lib/api/internal-users";
import { SystemSetting, UserRole } from "@/types/database";
import {
  getBrandAliases,
  deleteBrandAlias,
  deleteAllBrandAliases,
  BrandAliasRow,
} from "@/lib/api/brand-aliases";

interface SettingCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  settings: SettingConfig[];
}

interface SettingConfig {
  key: string;
  label: string;
  description: string;
  type: "text" | "number" | "select" | "toggle" | "textarea";
  options?: { value: string; label: string }[];
  defaultValue: unknown;
  unit?: string;
}

const SETTING_CATEGORIES: SettingCategory[] = [
  {
    id: "general",
    label: "General",
    icon: Building2,
    description: "Company information and basic settings",
    settings: [
      {
        key: "company_name",
        label: "Company Name",
        description: "Your company name displayed throughout the system",
        type: "text",
        defaultValue: "7 Degrees Co",
      },
      {
        key: "company_address",
        label: "Company Address",
        description: "Primary warehouse address",
        type: "textarea",
        defaultValue: "",
      },
      {
        key: "timezone",
        label: "Timezone",
        description: "Default timezone for date/time display",
        type: "select",
        options: [
          { value: "America/New_York", label: "Eastern Time (ET)" },
          { value: "America/Chicago", label: "Central Time (CT)" },
          { value: "America/Denver", label: "Mountain Time (MT)" },
          { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
          { value: "America/Phoenix", label: "Arizona Time" },
          { value: "America/Anchorage", label: "Alaska Time" },
          { value: "Pacific/Honolulu", label: "Hawaii Time" },
        ],
        defaultValue: "America/New_York",
      },
      {
        key: "date_format",
        label: "Date Format",
        description: "How dates are displayed in the system",
        type: "select",
        options: [
          { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
          { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
          { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
        ],
        defaultValue: "MM/DD/YYYY",
      },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: Package,
    description: "Inventory management and tracking settings",
    settings: [
      {
        key: "low_stock_threshold",
        label: "Default Low Stock Threshold",
        description: "Default reorder point for new products",
        type: "number",
        defaultValue: 10,
        unit: "units",
      },
      {
        key: "enable_lot_tracking",
        label: "Enable Lot Tracking by Default",
        description: "Automatically enable lot tracking for new products",
        type: "toggle",
        defaultValue: false,
      },
      {
        key: "default_expiration_days",
        label: "Default Expiration Days",
        description: "Default expiration period for lot-tracked products",
        type: "number",
        defaultValue: 365,
        unit: "days",
      },
      {
        key: "cycle_count_frequency",
        label: "Cycle Count Frequency",
        description: "How often cycle counts should be scheduled",
        type: "select",
        options: [
          { value: "daily", label: "Daily" },
          { value: "weekly", label: "Weekly" },
          { value: "monthly", label: "Monthly" },
          { value: "quarterly", label: "Quarterly" },
        ],
        defaultValue: "monthly",
      },
      {
        key: "variance_threshold",
        label: "Variance Threshold",
        description: "Percentage variance that requires approval",
        type: "number",
        defaultValue: 5,
        unit: "%",
      },
      {
        key: "velocity_window_days",
        label: "Velocity Calculation Window",
        description: "Number of days to look back when calculating shipping velocity",
        type: "number",
        defaultValue: 30,
        unit: "days",
      },
      {
        key: "default_lead_time_days",
        label: "Default Lead Time",
        description: "Default supplier lead time for velocity-based reorder calculation",
        type: "number",
        defaultValue: 7,
        unit: "days",
      },
      {
        key: "safety_stock_multiplier",
        label: "Safety Stock Multiplier",
        description: "Multiplier applied to velocity-based reorder point for safety buffer",
        type: "number",
        defaultValue: 1.5,
        unit: "x",
      },
      {
        key: "days_of_stock_alert_threshold",
        label: "Days of Stock Alert Threshold",
        description: "Days of stock remaining that triggers a low-stock alert",
        type: "number",
        defaultValue: 14,
        unit: "days",
      },
    ],
  },
  {
    id: "orders",
    label: "Orders & Shipping",
    icon: Truck,
    description: "Order processing and shipping preferences",
    settings: [
      {
        key: "default_carrier",
        label: "Default Carrier",
        description: "Default shipping carrier for new orders",
        type: "select",
        options: [
          { value: "ups_ground", label: "UPS Ground" },
          { value: "ups_2day", label: "UPS 2-Day" },
          { value: "ups_overnight", label: "UPS Overnight" },
          { value: "fedex_ground", label: "FedEx Ground" },
          { value: "fedex_express", label: "FedEx Express" },
          { value: "usps_priority", label: "USPS Priority" },
          { value: "usps_ground", label: "USPS Ground Advantage" },
        ],
        defaultValue: "ups_ground",
      },
      {
        key: "require_order_confirmation",
        label: "Require Order Confirmation",
        description: "Orders must be confirmed before processing",
        type: "toggle",
        defaultValue: true,
      },
      {
        key: "auto_allocate_inventory",
        label: "Auto-Allocate Inventory",
        description: "Automatically reserve inventory when orders are confirmed",
        type: "toggle",
        defaultValue: true,
      },
      {
        key: "packing_slip_copies",
        label: "Packing Slip Copies",
        description: "Number of packing slips to print per order",
        type: "number",
        defaultValue: 2,
        unit: "copies",
      },
      {
        key: "rush_processing_hours",
        label: "Rush Processing SLA",
        description: "Target hours to ship rush orders",
        type: "number",
        defaultValue: 4,
        unit: "hours",
      },
    ],
  },
  {
    id: "fulfillment",
    label: "Fulfillment",
    icon: PackageCheck,
    description: "Fulfillment pricing and defaults",
    settings: [
      {
        key: "default_carrier",
        label: "Default Carrier",
        description: "Default shipping carrier for fulfillment orders",
        type: "select",
        options: [
          { value: "ups_ground", label: "UPS Ground" },
          { value: "ups_2day", label: "UPS 2-Day" },
          { value: "ups_overnight", label: "UPS Overnight" },
          { value: "fedex_ground", label: "FedEx Ground" },
          { value: "fedex_express", label: "FedEx Express" },
          { value: "usps_priority", label: "USPS Priority" },
          { value: "usps_ground", label: "USPS Ground Advantage" },
        ],
        defaultValue: "ups_ground",
      },
      {
        key: "shipping_markup_percent",
        label: "Shipping Markup Percentage",
        description: "Markup applied to shipping costs charged to clients",
        type: "number",
        defaultValue: 0,
        unit: "%",
      },
      {
        key: "rush_fee_default",
        label: "Rush Fee Default",
        description: "Default rush processing fee charged to clients",
        type: "number",
        defaultValue: 25,
        unit: "$",
      },
      {
        key: "standard_supplies_included",
        label: "Standard Supplies Included",
        description: "Include standard packing supplies at no extra charge",
        type: "toggle",
        defaultValue: true,
      },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    icon: CreditCard,
    description: "Invoice and billing configuration",
    settings: [
      {
        key: "payment_terms",
        label: "Default Payment Terms",
        description: "Standard payment terms for invoices",
        type: "select",
        options: [
          { value: "due_on_receipt", label: "Due on Receipt" },
          { value: "net_15", label: "Net 15" },
          { value: "net_30", label: "Net 30" },
          { value: "net_45", label: "Net 45" },
        ],
        defaultValue: "net_30",
      },
      {
        key: "default_tax_rate",
        label: "Default Tax Rate",
        description: "Default tax rate applied to invoices",
        type: "number",
        defaultValue: 0,
        unit: "%",
      },
      {
        key: "invoice_prefix",
        label: "Invoice Number Prefix",
        description: "Prefix for invoice numbers (e.g., INV-)",
        type: "text",
        defaultValue: "INV-",
      },
      {
        key: "auto_generate_invoices",
        label: "Auto-Generate Invoices",
        description: "Automatically generate invoices at the end of each billing period",
        type: "toggle",
        defaultValue: false,
      },
    ],
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    description: "Email and alert settings",
    settings: [
      {
        key: "admin_email",
        label: "Admin Email",
        description: "Email address for system notifications",
        type: "text",
        defaultValue: "",
      },
      {
        key: "low_stock_alert_threshold",
        label: "Low Stock Alert Threshold",
        description: "Alert when inventory falls below this percentage of reorder point",
        type: "number",
        defaultValue: 100,
        unit: "%",
      },
      {
        key: "expiring_lots_alert_days",
        label: "Expiring Lots Alert Days",
        description: "Days before expiration to send lot expiration alerts",
        type: "number",
        defaultValue: 30,
        unit: "days",
      },
      {
        key: "send_low_stock_alerts",
        label: "Low Stock Alerts",
        description: "Send email when inventory falls below threshold",
        type: "toggle",
        defaultValue: true,
      },
      {
        key: "send_order_notifications",
        label: "Order Notifications",
        description: "Send email for new order requests",
        type: "toggle",
        defaultValue: true,
      },
      {
        key: "send_inbound_notifications",
        label: "Inbound Notifications",
        description: "Send email when inbound shipments arrive",
        type: "toggle",
        defaultValue: true,
      },
      {
        key: "send_expiring_lot_alerts",
        label: "Expiring Lot Alerts",
        description: "Send email when lots are approaching expiration",
        type: "toggle",
        defaultValue: true,
      },
      {
        key: "daily_summary_email",
        label: "Daily Summary Email",
        description: "Send daily activity summary to admin",
        type: "toggle",
        defaultValue: false,
      },
      {
        key: "email_template_order_confirmation",
        label: "Order Confirmation Template",
        description: "Email template for order confirmations",
        type: "select",
        options: [
          { value: "default", label: "Default Template" },
          { value: "detailed", label: "Detailed Template" },
          { value: "minimal", label: "Minimal Template" },
        ],
        defaultValue: "default",
      },
      {
        key: "email_template_shipment",
        label: "Shipment Notification Template",
        description: "Email template for shipment notifications",
        type: "select",
        options: [
          { value: "default", label: "Default Template" },
          { value: "detailed", label: "Detailed with Tracking" },
          { value: "minimal", label: "Minimal Template" },
        ],
        defaultValue: "default",
      },
      {
        key: "email_template_invoice",
        label: "Invoice Template",
        description: "Email template for invoice notifications",
        type: "select",
        options: [
          { value: "default", label: "Default Template" },
          { value: "detailed", label: "Detailed with Line Items" },
          { value: "summary", label: "Summary Only" },
        ],
        defaultValue: "default",
      },
    ],
  },
  {
    id: "security",
    label: "Security",
    icon: Shield,
    description: "Access control and security settings",
    settings: [
      {
        key: "session_timeout",
        label: "Session Timeout",
        description: "Auto logout after inactivity",
        type: "number",
        defaultValue: 60,
        unit: "minutes",
      },
      {
        key: "require_2fa",
        label: "Require Two-Factor Authentication",
        description: "Require 2FA for all admin users",
        type: "toggle",
        defaultValue: false,
      },
      {
        key: "password_expiry",
        label: "Password Expiry",
        description: "Days before password must be changed (0 = never)",
        type: "number",
        defaultValue: 0,
        unit: "days",
      },
      {
        key: "max_login_attempts",
        label: "Max Login Attempts",
        description: "Lock account after failed login attempts",
        type: "number",
        defaultValue: 5,
        unit: "attempts",
      },
    ],
  },
  {
    id: "dock",
    label: "Dock Scheduling",
    icon: CalendarCheck,
    description: "Dock appointment capacity and scheduling windows",
    settings: [
      {
        key: "max_appointments_per_slot",
        label: "Max Appointments Per Slot",
        description: "Maximum concurrent dock appointments per time slot (AM/PM)",
        type: "number",
        defaultValue: 3,
      },
      {
        key: "dock_hours_am_start",
        label: "AM Window Start",
        description: "Start time for the AM dock window (24h format, e.g. 08:00)",
        type: "text",
        defaultValue: "08:00",
      },
      {
        key: "dock_hours_am_end",
        label: "AM Window End",
        description: "End time for the AM dock window (24h format, e.g. 12:00)",
        type: "text",
        defaultValue: "12:00",
      },
      {
        key: "dock_hours_pm_start",
        label: "PM Window Start",
        description: "Start time for the PM dock window (24h format, e.g. 12:00)",
        type: "text",
        defaultValue: "12:00",
      },
      {
        key: "dock_hours_pm_end",
        label: "PM Window End",
        description: "End time for the PM dock window (24h format, e.g. 17:00)",
        type: "text",
        defaultValue: "17:00",
      },
    ],
  },
];

type CategoryValues = Record<string, unknown>;
type AllValues = Record<string, CategoryValues>;

export default function SystemSettingsPage() {
  const [values, setValues] = useState<AllValues>({});
  const [originalValues, setOriginalValues] = useState<AllValues>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load all settings
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const settings = await getSystemSettings();

      // Initialize values with defaults
      const initialValues: AllValues = {};
      SETTING_CATEGORIES.forEach((category) => {
        initialValues[category.id] = {};
        category.settings.forEach((setting) => {
          initialValues[category.id][setting.key] = setting.defaultValue;
        });
      });

      // Override with actual values from database
      settings.forEach((setting: SystemSetting) => {
        if (initialValues[setting.category]) {
          initialValues[setting.category][setting.setting_key] = setting.setting_value;
        }
      });

      setValues(initialValues);
      setOriginalValues(JSON.parse(JSON.stringify(initialValues)));
    } catch (err) {
      console.error("Failed to load settings:", err);
      setError("Failed to load settings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (category: string, key: string, value: unknown) => {
    setValues((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }));
  };

  const handleSaveCategory = async (categoryId: string) => {
    const category = SETTING_CATEGORIES.find((c) => c.id === categoryId);
    if (!category) return;

    try {
      setSaving(categoryId);
      setError(null);

      // Save each setting in the category
      for (const setting of category.settings) {
        const value = values[categoryId]?.[setting.key];
        const settingConfig = category.settings.find((s) => s.key === setting.key);
        await setSystemSetting(
          categoryId,
          setting.key,
          value,
          settingConfig?.description
        );
      }

      // Update original values
      setOriginalValues((prev) => ({
        ...prev,
        [categoryId]: { ...values[categoryId] },
      }));

      setSaveSuccess(categoryId);
      setTimeout(() => setSaveSuccess(null), 2000);
    } catch (err) {
      console.error("Failed to save settings:", err);
      setError(`Failed to save ${category.label} settings. Please try again.`);
    } finally {
      setSaving(null);
    }
  };

  const hasChanges = (categoryId: string) => {
    const current = values[categoryId];
    const original = originalValues[categoryId];
    if (!current || !original) return false;
    return JSON.stringify(current) !== JSON.stringify(original);
  };

  const renderSettingInput = (
    category: string,
    setting: SettingConfig,
    value: unknown
  ) => {
    switch (setting.type) {
      case "text":
        return (
          <Input
            type="text"
            value={(value as string) || ""}
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleValueChange(category, setting.key, e.target.value)}
          />
        );

      case "number":
        return (
          <div className="flex items-center gap-2">
            <div className="w-32">
              <Input
                type="number"
                value={(value as number) || 0}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  handleValueChange(category, setting.key, parseFloat(e.target.value) || 0)
                }
              />
            </div>
            {setting.unit && (
              <span className="text-sm text-gray-500">{setting.unit}</span>
            )}
          </div>
        );

      case "select":
        return (
          <div className="w-64">
            <Select
              value={(value as string) || ""}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => handleValueChange(category, setting.key, e.target.value)}
              options={
                setting.options?.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                })) || []
              }
            />
          </div>
        );

      case "toggle":
        return (
          <button
            type="button"
            onClick={() => handleValueChange(category, setting.key, !value)}
            className={`
              relative w-12 h-6 rounded-full transition-colors
              ${value ? "bg-blue-600" : "bg-gray-300"}
            `}
          >
            <span
              className={`
                absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow
                ${value ? "left-7" : "left-1"}
              `}
            />
          </button>
        );

      case "textarea":
        return (
          <textarea
            value={(value as string) || ""}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleValueChange(category, setting.key, e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <AppShell title="System Settings">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="System Settings">
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
          <button
            onClick={loadSettings}
            className="ml-auto flex items-center gap-2 text-red-600 hover:text-red-700"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Daily Tasks Section */}
      <DailyTasksSection />

      {/* FedEx Shipping Section */}
      <FedExShippingSection />

      {/* QuickBooks Online Section */}
      <QuickBooksSection />

      {/* Brand Aliases Section */}
      <BrandAliasesSection />

      {/* Internal Users Section */}
      <InternalUsersSection />

      <div className="space-y-6">
        {SETTING_CATEGORIES.map((category) => {
          const Icon = category.icon;
          const isSaving = saving === category.id;
          const isSuccess = saveSuccess === category.id;
          const changed = hasChanges(category.id);

          return (
            <Card key={category.id} padding="none">
              {/* Category Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Icon className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {category.label}
                    </h2>
                    <p className="text-sm text-gray-500">{category.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleSaveCategory(category.id)}
                  disabled={isSaving || !changed}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                    ${
                      isSuccess
                        ? "bg-green-600 text-white"
                        : changed
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }
                  `}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : isSuccess ? (
                    <>
                      <Check className="w-4 h-4" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save
                    </>
                  )}
                </button>
              </div>

              {/* Settings List */}
              <div className="divide-y divide-gray-100">
                {category.settings.map((setting) => (
                  <div
                    key={setting.key}
                    className="px-6 py-4 flex items-start justify-between gap-6"
                  >
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-900">
                        {setting.label}
                      </label>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {setting.description}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {renderSettingInput(
                        category.id,
                        setting,
                        values[category.id]?.[setting.key]
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}

function BrandAliasesSection() {
  const [aliases, setAliases] = useState<BrandAliasRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  useEffect(() => {
    loadAliases();
  }, []);

  const loadAliases = async () => {
    try {
      setLoading(true);
      const data = await getBrandAliases();
      setAliases(data);
    } catch (err) {
      console.error("Failed to load brand aliases:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteBrandAlias(id);
      setAliases((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error("Failed to delete alias:", err);
    } finally {
      setDeleting(null);
    }
  };

  const handleClearAll = async () => {
    setDeleting("all");
    try {
      await deleteAllBrandAliases();
      setAliases([]);
      setConfirmClearAll(false);
    } catch (err) {
      console.error("Failed to clear aliases:", err);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Card padding="none" className="mb-6">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Tag className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Brand Aliases</h2>
            <p className="text-sm text-gray-500">
              Saved brand-to-client mappings from spreadsheet imports
            </p>
          </div>
        </div>
        {aliases.length > 0 && !confirmClearAll && (
          <button
            onClick={() => setConfirmClearAll(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
        )}
        {confirmClearAll && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-red-600">Delete all aliases?</span>
            <button
              onClick={handleClearAll}
              disabled={deleting === "all"}
              className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
            >
              {deleting === "all" ? "Deleting..." : "Yes, delete all"}
            </button>
            <button
              onClick={() => setConfirmClearAll(false)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : aliases.length === 0 ? (
          <div className="text-center py-8">
            <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No brand aliases saved yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Aliases are created automatically when you confirm brand mappings during spreadsheet imports
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_1fr_auto] gap-4 px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <span>Brand Alias</span>
              <span>Mapped Client</span>
              <span className="w-8" />
            </div>
            {aliases.map((alias) => (
              <div
                key={alias.id}
                className="grid grid-cols-[1fr_1fr_auto] gap-4 items-center px-4 py-3 bg-gray-50 rounded-lg"
              >
                <span className="font-mono text-sm text-gray-900">{alias.alias}</span>
                <span className="text-sm text-gray-700">{alias.client_name}</span>
                <button
                  onClick={() => handleDelete(alias.id)}
                  disabled={deleting === alias.id}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                  title="Remove alias"
                >
                  {deleting === alias.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
            <p className="text-xs text-gray-400 pt-2">
              {aliases.length} alias{aliases.length !== 1 ? "es" : ""} saved
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

function InternalUsersSection() {
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createMode, setCreateMode] = useState<"invite" | "password">("invite");
  const [editingUser, setEditingUser] = useState<InternalUser | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "warehouse" as UserRole,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await getInternalUsers();
      setUsers(data);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "warehouse",
    });
    setError(null);
    setSuccess(null);
    setEditingUser(null);
    setCreateMode("invite");
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      setError("Name and email are required");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await inviteInternalUser({
        name: formData.name.trim(),
        email: formData.email.trim(),
        role: formData.role,
      });

      if (result.success) {
        setSuccess("Invitation sent! They will receive an email to set up their account.");
        await loadUsers();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim()) {
      setError("Name, email, and password are required");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await createInternalUser({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
      });

      if (result.success) {
        await loadUsers();
        setShowCreateModal(false);
        resetForm();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    try {
      await updateInternalUser(userId, { role: newRole });
      setUsers(users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    } catch (err) {
      console.error("Failed to update role:", err);
    }
  };

  const handleToggleActive = async (user: InternalUser) => {
    try {
      if (user.active) {
        await deactivateInternalUser(user.id);
      } else {
        await reactivateInternalUser(user.id);
      }
      setUsers(users.map((u) => (u.id === user.id ? { ...u, active: !u.active } : u)));
    } catch (err) {
      console.error("Failed to toggle user status:", err);
    }
  };

  const roleLabels: Record<UserRole, string> = {
    admin: "Administrator",
    warehouse: "Warehouse Staff",
    viewer: "Viewer",
  };

  return (
    <Card padding="none" className="mb-6">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Users className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Internal Users</h2>
            <p className="text-sm text-gray-500">
              Manage staff accounts with access to the internal system
            </p>
          </div>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <UserPlus className="w-4 h-4 mr-1" />
          Create User
        </Button>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No internal users found</p>
            <Button className="mt-3" onClick={() => setShowCreateModal(true)}>
              <UserPlus className="w-4 h-4 mr-1" />
              Create First User
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  user.active
                    ? "bg-white border-gray-200"
                    : "bg-gray-50 border-gray-200 opacity-60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      user.active
                        ? "bg-gradient-to-br from-purple-500 to-purple-600"
                        : "bg-gray-400"
                    }`}
                  >
                    <span className="text-white font-semibold">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{user.name}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                  {!user.active && (
                    <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                      Inactive
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={user.role}
                    onChange={(e) => handleUpdateRole(user.id, e.target.value as UserRole)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="admin">Administrator</option>
                    <option value="warehouse">Warehouse Staff</option>
                    <option value="viewer">Viewer</option>
                  </select>

                  <button
                    onClick={() => handleToggleActive(user)}
                    className={`p-2 rounded-lg transition-colors ${
                      user.active
                        ? "text-gray-400 hover:text-red-600 hover:bg-red-50"
                        : "text-gray-400 hover:text-green-600 hover:bg-green-50"
                    }`}
                    title={user.active ? "Deactivate user" : "Reactivate user"}
                  >
                    {user.active ? (
                      <UserX className="w-4 h-4" />
                    ) : (
                      <UserCheck className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Add Internal User</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>


            <form onSubmit={handleInvite} className="p-4 space-y-4">
              {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">{success}</p>
                </div>
              )}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <p className="text-sm text-gray-500">
                Send an email invitation. The user will set their own password when they accept.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="John Smith"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder="john@7degreesco.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>


              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="admin">Administrator - Full system access</option>
                  <option value="warehouse">Warehouse Staff - Orders & inventory</option>
                  <option value="viewer">Viewer - Read-only access</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  disabled={submitting}
                >
                  {success ? "Close" : "Cancel"}
                </Button>
                {!success && (
                  <Button type="submit" disabled={submitting} loading={submitting}>
                    {createMode === "invite" ? "Send Invitation" : "Create User"}
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}

function DailyTasksSection() {
  const [runningTask, setRunningTask] = useState<string | null>(null);
  const [taskResult, setTaskResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleStorageSnapshot = async () => {
    setRunningTask("storage");
    setTaskResult(null);
    try {
      const count = await takeStorageSnapshot();
      setTaskResult({
        type: "success",
        message: `Storage snapshot completed. ${count} inventory records captured.`,
      });
    } catch (err) {
      setTaskResult({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to take storage snapshot",
      });
    } finally {
      setRunningTask(null);
    }
  };

  const handleMarkOverdueInvoices = async () => {
    setRunningTask("overdue");
    setTaskResult(null);
    try {
      const { createClient } = await import("@/lib/supabase");
      const supabase = createClient();

      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("invoices")
        .update({ status: "overdue" })
        .eq("status", "sent")
        .lt("due_date", today)
        .select("id");

      if (error) throw new Error(error.message);

      const count = data?.length || 0;
      setTaskResult({
        type: "success",
        message: count > 0
          ? `Marked ${count} invoice${count !== 1 ? "s" : ""} as overdue.`
          : "No overdue invoices found.",
      });
    } catch (err) {
      setTaskResult({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to check overdue invoices",
      });
    } finally {
      setRunningTask(null);
    }
  };

  return (
    <Card padding="none" className="mb-6">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Play className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Daily Tasks</h2>
            <p className="text-sm text-gray-500">
              Run these tasks manually or they will run automatically when scheduled
            </p>
          </div>
        </div>
      </div>

      {taskResult && (
        <div
          className={`mx-6 mt-4 p-3 rounded-lg flex items-center gap-2 ${
            taskResult.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {taskResult.type === "success" ? (
            <Check className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="text-sm">{taskResult.message}</span>
        </div>
      )}

      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-gray-400" />
            <div>
              <p className="font-medium text-gray-900">Storage Snapshot</p>
              <p className="text-sm text-gray-500">
                Capture current inventory levels for storage billing calculations
              </p>
            </div>
          </div>
          <button
            onClick={handleStorageSnapshot}
            disabled={runningTask !== null}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
              ${runningTask === "storage"
                ? "bg-blue-100 text-blue-600"
                : "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500"
              }
            `}
          >
            {runningTask === "storage" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Now
              </>
            )}
          </button>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-gray-400" />
            <div>
              <p className="font-medium text-gray-900">Check Overdue Invoices</p>
              <p className="text-sm text-gray-500">
                Mark sent invoices past their due date as overdue
              </p>
            </div>
          </div>
          <button
            onClick={handleMarkOverdueInvoices}
            disabled={runningTask !== null}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
              ${runningTask === "overdue"
                ? "bg-blue-100 text-blue-600"
                : "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500"
              }
            `}
          >
            {runningTask === "overdue" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Now
              </>
            )}
          </button>
        </div>
      </div>
    </Card>
  );
}

interface FedExFormState {
  client_id: string;
  client_secret: string;
  account_number: string;
  environment: "sandbox" | "production";
  shipper_company: string;
  shipper_street: string;
  shipper_city: string;
  shipper_state: string;
  shipper_zip: string;
  shipper_country: string;
  shipper_phone: string;
}

const FEDEX_INITIAL: FedExFormState = {
  client_id: "",
  client_secret: "",
  account_number: "",
  environment: "sandbox",
  shipper_company: "",
  shipper_street: "",
  shipper_city: "",
  shipper_state: "",
  shipper_zip: "",
  shipper_country: "US",
  shipper_phone: "",
};

function FedExShippingSection() {
  const [form, setForm] = useState<FedExFormState>(FEDEX_INITIAL);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      const res = await fetch("/api/shipping/fedex/settings");
      const data = await res.json();
      if (data.configured && data.credentials) {
        setConfigured(true);
        setForm({
          client_id: data.credentials.client_id || "",
          client_secret: data.credentials.client_secret || "",
          account_number: data.credentials.account_number || "",
          environment: data.credentials.environment || "sandbox",
          shipper_company: data.credentials.shipper_company || "",
          shipper_street: data.credentials.shipper_street || "",
          shipper_city: data.credentials.shipper_city || "",
          shipper_state: data.credentials.shipper_state || "",
          shipper_zip: data.credentials.shipper_zip || "",
          shipper_country: data.credentials.shipper_country || "US",
          shipper_phone: data.credentials.shipper_phone || "",
        });
      }
    } catch (err) {
      console.error("Failed to load FedEx settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!form.client_id || !form.client_secret || form.client_secret === "****" || !form.account_number) {
      setResult({ type: "error", message: "Fill in API Key, API Secret, and Account Number to test." });
      return;
    }
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch("/api/shipping/fedex/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ type: "success", message: data.message || "Connected successfully!" });
      } else {
        setResult({ type: "error", message: data.error || "Connection failed" });
      }
    } catch {
      setResult({ type: "error", message: "Network error — could not reach test endpoint" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!form.client_id || !form.account_number) {
      setResult({ type: "error", message: "API Key and Account Number are required." });
      return;
    }
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch("/api/shipping/fedex/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ type: "success", message: "FedEx credentials saved." });
        setConfigured(true);
      } else {
        setResult({ type: "error", message: data.error || "Failed to save" });
      }
    } catch {
      setResult({ type: "error", message: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof FedExFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <Card padding="none" className="mb-6">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Truck className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">FedEx Alcohol Shipping</h2>
            <p className="text-sm text-gray-500">Loading...</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="none" className="mb-6">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Truck className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">FedEx Alcohol Shipping</h2>
            <p className="text-sm text-gray-500">
              API credentials for the FedEx alcohol-licensed shipping account
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {configured ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
              Not Configured
            </span>
          )}
        </div>
      </div>

      {result && (
        <div
          className={`mx-6 mt-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
            result.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {result.type === "success" ? (
            <Check className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          {result.message}
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* Environment Toggle */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 w-32">Environment</label>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              type="button"
              onClick={() => update("environment", "sandbox")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                form.environment === "sandbox"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Sandbox
            </button>
            <button
              type="button"
              onClick={() => update("environment", "production")}
              className={`px-4 py-2 text-sm font-medium border-l border-gray-300 transition-colors ${
                form.environment === "production"
                  ? "bg-green-100 text-green-800"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Production
            </button>
          </div>
        </div>

        {/* API Credentials */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Input
              label="API Key (Client ID)"
              value={form.client_id}
              onChange={(e: ChangeEvent<HTMLInputElement>) => update("client_id", e.target.value)}
              placeholder="l7xxxxxxxxxxxx..."
            />
          </div>
          <div>
            <Input
              label="API Secret"
              type="password"
              value={form.client_secret}
              onChange={(e: ChangeEvent<HTMLInputElement>) => update("client_secret", e.target.value)}
              placeholder={configured ? "****" : "Enter secret"}
            />
          </div>
          <div>
            <Input
              label="Account Number"
              value={form.account_number}
              onChange={(e: ChangeEvent<HTMLInputElement>) => update("account_number", e.target.value)}
              placeholder="123456789"
            />
          </div>
        </div>

        {/* Shipper Address */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Shipper Address (Warehouse Origin)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Company Name"
              value={form.shipper_company}
              onChange={(e: ChangeEvent<HTMLInputElement>) => update("shipper_company", e.target.value)}
              placeholder="7 Degrees Co"
            />
            <Input
              label="Phone"
              value={form.shipper_phone}
              onChange={(e: ChangeEvent<HTMLInputElement>) => update("shipper_phone", e.target.value)}
              placeholder="555-123-4567"
            />
            <div className="md:col-span-2">
              <Input
                label="Street Address"
                value={form.shipper_street}
                onChange={(e: ChangeEvent<HTMLInputElement>) => update("shipper_street", e.target.value)}
                placeholder="123 Warehouse Dr"
              />
            </div>
            <Input
              label="City"
              value={form.shipper_city}
              onChange={(e: ChangeEvent<HTMLInputElement>) => update("shipper_city", e.target.value)}
              placeholder="City"
            />
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="State"
                value={form.shipper_state}
                onChange={(e: ChangeEvent<HTMLInputElement>) => update("shipper_state", e.target.value)}
                placeholder="NY"
              />
              <Input
                label="ZIP"
                value={form.shipper_zip}
                onChange={(e: ChangeEvent<HTMLInputElement>) => update("shipper_zip", e.target.value)}
                placeholder="10001"
              />
              <Input
                label="Country"
                value={form.shipper_country}
                onChange={(e: ChangeEvent<HTMLInputElement>) => update("shipper_country", e.target.value)}
                placeholder="US"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
          <button
            onClick={handleTest}
            disabled={testing || saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Test Connection
              </>
            )}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || testing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Credentials
              </>
            )}
          </button>
        </div>
      </div>
    </Card>
  );
}

// ── QuickBooks Online Integration ────────────────────────

interface QBAccount {
  id: string;
  name: string;
}

interface QBAccountMappings {
  income_account_id: string | null;
  income_account_name: string | null;
  expense_account_id: string | null;
  expense_account_name: string | null;
  shipping_expense_account_id: string | null;
  shipping_expense_account_name: string | null;
  bank_account_id: string | null;
  bank_account_name: string | null;
}

function QuickBooksSection() {
  const [configured, setConfigured] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [savingMappings, setSavingMappings] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // App credentials (Client ID / Secret / Webhook Verifier)
  const [appForm, setAppForm] = useState({
    client_id: "",
    client_secret: "",
    webhook_verifier: "",
    environment: "sandbox" as "sandbox" | "production",
  });

  const [connectionInfo, setConnectionInfo] = useState<{
    realm_id: string;
    environment: string;
    connected_at: string;
    token_status: string;
    refresh_token_status: string;
    company_name?: string;
  } | null>(null);

  const [accountMappings, setAccountMappings] = useState<QBAccountMappings>({
    income_account_id: null,
    income_account_name: null,
    expense_account_id: null,
    expense_account_name: null,
    shipping_expense_account_id: null,
    shipping_expense_account_name: null,
    bank_account_id: null,
    bank_account_name: null,
  });

  const [qbAccounts, setQbAccounts] = useState<{
    income: QBAccount[];
    expense: QBAccount[];
    bank: QBAccount[];
  }>({ income: [], expense: [], bank: [] });

  const [accountsLoaded, setAccountsLoaded] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch("/api/integrations/quickbooks/settings");
      const data = await res.json();
      if (data.configured && data.app_credentials) {
        setConfigured(true);
        setAppForm({
          client_id: data.app_credentials.client_id || "",
          client_secret: data.app_credentials.client_secret || "",
          webhook_verifier: data.app_credentials.webhook_verifier || "",
          environment: data.app_credentials.environment || "sandbox",
        });
      }
      if (data.connected) {
        setConnected(true);
        setConnectionInfo({
          realm_id: data.realm_id,
          environment: data.environment,
          connected_at: data.connected_at,
          token_status: data.token_status,
          refresh_token_status: data.refresh_token_status,
        });
        if (data.account_mappings) {
          setAccountMappings(data.account_mappings);
        }
      }
    } catch (err) {
      console.error("Failed to load QB settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    if (accountsLoaded) return;
    try {
      const res = await fetch("/api/integrations/quickbooks/accounts");
      const data = await res.json();
      if (!data.error) {
        setQbAccounts({
          income: data.income || [],
          expense: data.expense || [],
          bank: data.bank || [],
        });
        setAccountsLoaded(true);
      }
    } catch (err) {
      console.error("Failed to load QB accounts:", err);
    }
  };

  const handleSaveCredentials = async () => {
    if (!appForm.client_id) {
      setResult({ type: "error", message: "Client ID is required." });
      return;
    }
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch("/api/integrations/quickbooks/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_credentials: appForm }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ type: "success", message: "QuickBooks credentials saved." });
        setConfigured(true);
      } else {
        setResult({ type: "error", message: data.error || "Failed to save" });
      }
    } catch {
      setResult({ type: "error", message: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = () => {
    window.location.href = "/api/integrations/quickbooks/auth";
  };

  const updateApp = (key: keyof typeof appForm, value: string) => {
    setAppForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch("/api/integrations/quickbooks/test", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setResult({ type: "success", message: data.message || "Connected!" });
        if (data.company_name) {
          setConnectionInfo((prev) =>
            prev ? { ...prev, company_name: data.company_name } : prev
          );
        }
      } else {
        setResult({ type: "error", message: data.error || "Connection failed" });
      }
    } catch {
      setResult({ type: "error", message: "Network error" });
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect QuickBooks? Entity mappings will be preserved.")) return;
    setDisconnecting(true);
    setResult(null);
    try {
      const res = await fetch("/api/integrations/quickbooks/disconnect", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setConnected(false);
        setConnectionInfo(null);
        setResult({ type: "success", message: "QuickBooks disconnected" });
      } else {
        setResult({ type: "error", message: data.error || "Disconnect failed" });
      }
    } catch {
      setResult({ type: "error", message: "Network error" });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSaveMappings = async () => {
    setSavingMappings(true);
    setResult(null);
    try {
      const res = await fetch("/api/integrations/quickbooks/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_mappings: accountMappings }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ type: "success", message: "Account mappings saved" });
      } else {
        setResult({ type: "error", message: data.error || "Failed to save" });
      }
    } catch {
      setResult({ type: "error", message: "Network error" });
    } finally {
      setSavingMappings(false);
    }
  };

  const updateMapping = (
    key: keyof QBAccountMappings,
    nameKey: keyof QBAccountMappings,
    value: string,
    accounts: QBAccount[]
  ) => {
    const account = accounts.find((a) => a.id === value);
    setAccountMappings((prev) => ({
      ...prev,
      [key]: value || null,
      [nameKey]: account?.name || null,
    }));
  };

  if (loading) {
    return (
      <Card padding="none" className="mb-6">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <BookOpen className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              QuickBooks Online
            </h2>
            <p className="text-sm text-gray-500">Loading...</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="none" className="mb-6">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <BookOpen className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              QuickBooks Online
            </h2>
            <p className="text-sm text-gray-500">
              Sync invoices, payments, and costs to QuickBooks
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              Connected
            </span>
          ) : configured ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
              Configured
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
              Not Configured
            </span>
          )}
        </div>
      </div>

      {result && (
        <div
          className={`mx-6 mt-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
            result.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {result.type === "success" ? (
            <Check className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          {result.message}
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* App Credentials (always shown — like FedEx) */}
        <div>
          {/* Environment Toggle */}
          <div className="flex items-center gap-4 mb-4">
            <label className="text-sm font-medium text-gray-700 w-32">Environment</label>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                type="button"
                onClick={() => updateApp("environment", "sandbox")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  appForm.environment === "sandbox"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Sandbox
              </button>
              <button
                type="button"
                onClick={() => updateApp("environment", "production")}
                className={`px-4 py-2 text-sm font-medium border-l border-gray-300 transition-colors ${
                  appForm.environment === "production"
                    ? "bg-green-100 text-green-800"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Production
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Input
                label="Client ID"
                value={appForm.client_id}
                onChange={(e: ChangeEvent<HTMLInputElement>) => updateApp("client_id", e.target.value)}
                placeholder="ABxxxxxxxxxxxxxxx"
              />
            </div>
            <div>
              <Input
                label="Client Secret"
                type="password"
                value={appForm.client_secret}
                onChange={(e: ChangeEvent<HTMLInputElement>) => updateApp("client_secret", e.target.value)}
                placeholder={configured ? "****" : "Enter secret"}
              />
            </div>
            <div>
              <Input
                label="Webhook Verifier"
                type="password"
                value={appForm.webhook_verifier}
                onChange={(e: ChangeEvent<HTMLInputElement>) => updateApp("webhook_verifier", e.target.value)}
                placeholder={configured ? "****" : "From Intuit webhooks"}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleSaveCredentials}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Credentials
                </>
              )}
            </button>
            {configured && !connected && (
              <button
                onClick={handleConnect}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Connect to QuickBooks
              </button>
            )}
          </div>
        </div>

        {!connected ? (
          /* ── Not Connected hint ── */
          !configured ? (
            <p className="text-sm text-gray-500 text-center py-2">
              Enter your Intuit Developer app credentials above, then click
              &quot;Connect to QuickBooks&quot; to start the OAuth flow.
            </p>
          ) : null
        ) : (
          /* ── Connected State ── */
          <>
            {/* Connection Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Company</span>
                <p className="font-medium text-gray-900">
                  {connectionInfo?.company_name || "—"}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Realm ID</span>
                <p className="font-medium text-gray-900 font-mono text-xs">
                  {connectionInfo?.realm_id || "—"}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Environment</span>
                <p className="font-medium text-gray-900 capitalize">
                  {connectionInfo?.environment || "—"}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Token Status</span>
                <p className="font-medium">
                  <span
                    className={
                      connectionInfo?.token_status === "valid"
                        ? "text-green-600"
                        : "text-amber-600"
                    }
                  >
                    {connectionInfo?.token_status === "valid"
                      ? "Valid"
                      : "Needs Refresh"}
                  </span>
                </p>
              </div>
            </div>

            {/* Account Mappings */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  Account Mappings
                </h3>
                {!accountsLoaded && (
                  <button
                    onClick={loadAccounts}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Load QB Accounts
                  </button>
                )}
              </div>

              {accountsLoaded ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Income Account (for invoices)
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      value={accountMappings.income_account_id || ""}
                      onChange={(e) =>
                        updateMapping(
                          "income_account_id",
                          "income_account_name",
                          e.target.value,
                          qbAccounts.income
                        )
                      }
                    >
                      <option value="">Select account...</option>
                      {qbAccounts.income.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Expense Account (for supply costs)
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      value={accountMappings.expense_account_id || ""}
                      onChange={(e) =>
                        updateMapping(
                          "expense_account_id",
                          "expense_account_name",
                          e.target.value,
                          qbAccounts.expense
                        )
                      }
                    >
                      <option value="">Select account...</option>
                      {qbAccounts.expense.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Shipping Expense Account
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      value={
                        accountMappings.shipping_expense_account_id || ""
                      }
                      onChange={(e) =>
                        updateMapping(
                          "shipping_expense_account_id",
                          "shipping_expense_account_name",
                          e.target.value,
                          qbAccounts.expense
                        )
                      }
                    >
                      <option value="">Select account...</option>
                      {qbAccounts.expense.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Bank Account (for expenses)
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      value={accountMappings.bank_account_id || ""}
                      onChange={(e) =>
                        updateMapping(
                          "bank_account_id",
                          "bank_account_name",
                          e.target.value,
                          qbAccounts.bank
                        )
                      }
                    >
                      <option value="">Select account...</option>
                      {qbAccounts.bank.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Click &quot;Load QB Accounts&quot; to configure which QB
                  accounts invoices and expenses map to.
                </p>
              )}

              {accountsLoaded && (
                <div className="mt-3">
                  <button
                    onClick={handleSaveMappings}
                    disabled={savingMappings}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {savingMappings ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Mappings
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Webhook Setup Instructions */}
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Webhook Setup (Payment Sync)
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-2">
                <p>
                  To receive payment updates from QuickBooks, configure a
                  webhook in the{" "}
                  <span className="font-medium">Intuit Developer Dashboard</span>:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>
                    Go to your app settings in the Intuit Developer portal
                  </li>
                  <li>Under Webhooks, add a new subscription</li>
                  <li>
                    Set the endpoint URL to:{" "}
                    <code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono">
                      {typeof window !== "undefined"
                        ? window.location.origin
                        : "https://your-domain.com"}
                      /api/webhooks/quickbooks
                    </code>
                  </li>
                  <li>
                    Subscribe to <strong>Payment</strong> events (Create,
                    Update)
                  </li>
                  <li>
                    Copy the Webhook Verifier Token and paste it into the{" "}
                    <strong>Webhook Verifier</strong> field above, then
                    click Save Credentials
                  </li>
                </ol>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
              <button
                onClick={handleTest}
                disabled={testing || disconnecting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {testing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Test Connection
                  </>
                )}
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting || testing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium border border-red-300 text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {disconnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Disconnecting...
                  </>
                ) : (
                  <>
                    <Unplug className="w-4 h-4" />
                    Disconnect
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
