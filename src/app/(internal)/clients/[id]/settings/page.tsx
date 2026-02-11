"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CreditCard,
  Shield,
  Truck,
  Package,
  Save,
  RotateCcw,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { getClient, ClientWithSummary } from "@/lib/api/clients";
import {
  getEffectiveSetting,
  setClientSetting,
  deleteClientSetting,
  EffectiveSetting,
} from "@/lib/api/settings";

interface SettingConfig {
  category: string;
  key: string;
  label: string;
  description: string;
  type: "boolean" | "string" | "number" | "select" | "textarea" | "checkboxes";
  options?: { value: string; label: string }[];
  defaultValue: unknown;
}

const SETTING_CONFIGS: SettingConfig[] = [
  // Billing Settings
  {
    category: "billing",
    key: "payment_terms",
    label: "Payment Terms",
    description: "Default payment terms for invoices",
    type: "select",
    options: [
      { value: "net_15", label: "Net 15" },
      { value: "net_30", label: "Net 30" },
      { value: "net_45", label: "Net 45" },
      { value: "net_60", label: "Net 60" },
      { value: "due_on_receipt", label: "Due on Receipt" },
    ],
    defaultValue: "net_30",
  },
  {
    category: "billing",
    key: "tax_rate",
    label: "Tax Rate",
    description: "Tax rate percentage applied to invoices",
    type: "number",
    defaultValue: 0,
  },
  {
    category: "billing",
    key: "auto_generate_invoices",
    label: "Auto-Generate Invoices",
    description: "Automatically generate invoices at end of billing period",
    type: "boolean",
    defaultValue: false,
  },
  // Portal Settings
  {
    category: "portal",
    key: "portal_access_enabled",
    label: "Portal Access Enabled",
    description: "Allow this client to access the customer portal",
    type: "boolean",
    defaultValue: true,
  },
  {
    category: "portal",
    key: "portal_features",
    label: "Portal Features",
    description: "Features available to this client in the portal",
    type: "checkboxes",
    options: [
      { value: "view_inventory", label: "View Inventory" },
      { value: "create_orders", label: "Create Orders" },
      { value: "view_invoices", label: "View Invoices" },
      { value: "download_reports", label: "Download Reports" },
      { value: "manage_products", label: "Manage Products" },
    ],
    defaultValue: ["view_inventory", "create_orders", "view_invoices"],
  },
  // Fulfillment Settings
  {
    category: "fulfillment",
    key: "default_carrier",
    label: "Default Carrier Preference",
    description: "Preferred shipping carrier for orders",
    type: "select",
    options: [
      { value: "", label: "No preference" },
      { value: "ups", label: "UPS" },
      { value: "fedex", label: "FedEx" },
      { value: "usps", label: "USPS" },
      { value: "dhl", label: "DHL" },
      { value: "freight", label: "Freight" },
    ],
    defaultValue: "",
  },
  {
    category: "fulfillment",
    key: "rush_processing_enabled",
    label: "Rush Processing Enabled",
    description: "Allow rush processing for orders (additional fees may apply)",
    type: "boolean",
    defaultValue: false,
  },
  {
    category: "fulfillment",
    key: "special_instructions",
    label: "Special Instructions",
    description: "Standing instructions for fulfillment team",
    type: "textarea",
    defaultValue: "",
  },
  // Supply Settings
  {
    category: "supplies",
    key: "billing_method",
    label: "Supply Billing Method",
    description: "How supplies are billed to this client",
    type: "select",
    options: [
      { value: "combined", label: "Combined with service fees" },
      { value: "separate", label: "Billed separately" },
      { value: "included", label: "Included in storage rate" },
    ],
    defaultValue: "combined",
  },
  {
    category: "supplies",
    key: "standard_supplies_included",
    label: "Standard Supplies Included",
    description: "Include standard packing supplies at no additional charge",
    type: "boolean",
    defaultValue: true,
  },
];

const SECTIONS = [
  { key: "billing", label: "Billing Settings", icon: CreditCard },
  { key: "portal", label: "Portal Settings", icon: Shield },
  { key: "fulfillment", label: "Fulfillment Settings", icon: Truck },
  { key: "supplies", label: "Supply Settings", icon: Package },
];

interface SettingState {
  value: unknown;
  source: "client" | "system" | "default";
  overriding: boolean;
  overrideValue: unknown;
}

export default function ClientSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const [client, setClient] = useState<ClientWithSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Record<string, SettingState>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const clientData = await getClient(params.id as string);
        setClient(clientData);

        // Fetch effective settings for each config
        const settingsObj: Record<string, SettingState> = {};

        for (const config of SETTING_CONFIGS) {
          const key = `${config.category}.${config.key}`;
          const effective = await getEffectiveSetting(
            params.id as string,
            config.category,
            config.key,
            config.defaultValue
          );

          settingsObj[key] = {
            value: effective.value,
            source: effective.source,
            overriding: effective.source === "client",
            overrideValue: effective.value,
          };
        }

        setSettings(settingsObj);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchData();
    }
  }, [params.id]);

  const handleOverrideToggle = (category: string, key: string) => {
    const settingKey = `${category}.${key}`;
    const current = settings[settingKey];

    setSettings((prev) => ({
      ...prev,
      [settingKey]: {
        ...current,
        overriding: !current.overriding,
        overrideValue: current.overriding ? current.value : current.value,
      },
    }));
    setHasChanges(true);
  };

  const handleValueChange = (category: string, key: string, value: unknown) => {
    const settingKey = `${category}.${key}`;
    const current = settings[settingKey];

    setSettings((prev) => ({
      ...prev,
      [settingKey]: {
        ...current,
        overrideValue: value,
      },
    }));
    setHasChanges(true);
  };

  const handleCheckboxChange = (category: string, key: string, optionValue: string, checked: boolean) => {
    const settingKey = `${category}.${key}`;
    const current = settings[settingKey];
    const currentValues = (current.overrideValue as string[]) || [];

    const newValues = checked
      ? [...currentValues, optionValue]
      : currentValues.filter((v) => v !== optionValue);

    setSettings((prev) => ({
      ...prev,
      [settingKey]: {
        ...current,
        overrideValue: newValues,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!params.id) return;

    setSaving(true);
    try {
      for (const config of SETTING_CONFIGS) {
        const key = `${config.category}.${config.key}`;
        const setting = settings[key];

        if (setting.overriding) {
          // Save client-specific setting
          await setClientSetting(
            params.id as string,
            config.category,
            config.key,
            setting.overrideValue
          );
        } else if (setting.source === "client") {
          // Remove client override to fall back to system/default
          await deleteClientSetting(
            params.id as string,
            config.category,
            config.key
          );
        }
      }

      // Refresh settings after save
      const settingsObj: Record<string, SettingState> = {};
      for (const config of SETTING_CONFIGS) {
        const key = `${config.category}.${config.key}`;
        const effective = await getEffectiveSetting(
          params.id as string,
          config.category,
          config.key,
          config.defaultValue
        );

        settingsObj[key] = {
          value: effective.value,
          source: effective.source,
          overriding: effective.source === "client",
          overrideValue: effective.value,
        };
      }
      setSettings(settingsObj);
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const getSourceBadge = (source: "client" | "system" | "default") => {
    switch (source) {
      case "client":
        return (
          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
            Client
          </span>
        );
      case "system":
        return (
          <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
            System
          </span>
        );
      case "default":
        return (
          <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
            Default
          </span>
        );
    }
  };

  const formatDisplayValue = (config: SettingConfig, value: unknown): string => {
    if (value === null || value === undefined || value === "") {
      return "Not set";
    }

    switch (config.type) {
      case "boolean":
        return value ? "Enabled" : "Disabled";
      case "select":
        const option = config.options?.find((o) => o.value === value);
        return option?.label || String(value);
      case "checkboxes":
        const values = value as string[];
        if (values.length === 0) return "None";
        return values
          .map((v) => config.options?.find((o) => o.value === v)?.label || v)
          .join(", ");
      case "number":
        if (config.key === "tax_rate") {
          return `${value}%`;
        }
        return String(value);
      default:
        return String(value);
    }
  };

  if (loading) {
    return (
      <AppShell title="Loading..." subtitle="">
        <Card>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </Card>
      </AppShell>
    );
  }

  if (!client) {
    return (
      <AppShell title="Client Not Found" subtitle="">
        <Card>
          <p className="text-gray-600">The requested client could not be found.</p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => router.push("/clients")}
          >
            Back to Clients
          </Button>
        </Card>
      </AppShell>
    );
  }

  const backLink = (
    <Link
      href={`/clients/${client.id}`}
      className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to Client
    </Link>
  );

  const renderSettingRow = (config: SettingConfig) => {
    const key = `${config.category}.${config.key}`;
    const setting = settings[key];

    if (!setting) return null;

    return (
      <div
        key={key}
        className="py-4 border-b border-gray-100 last:border-0"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-gray-900">{config.label}</span>
              {getSourceBadge(setting.source)}
            </div>
            <p className="text-sm text-gray-500 mb-2">{config.description}</p>

            {!setting.overriding && (
              <p className="text-sm text-gray-700">
                <span className="font-medium">Current value:</span>{" "}
                {formatDisplayValue(config, setting.value)}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={setting.overriding}
                onChange={() => handleOverrideToggle(config.category, config.key)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">Override</span>
            </label>
          </div>
        </div>

        {setting.overriding && (
          <div className="mt-3 pl-0">
            {renderSettingInput(config, setting)}
          </div>
        )}
      </div>
    );
  };

  const renderSettingInput = (config: SettingConfig, setting: SettingState) => {
    switch (config.type) {
      case "boolean":
        return (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!setting.overrideValue}
              onChange={(e) =>
                handleValueChange(config.category, config.key, e.target.checked)
              }
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              {setting.overrideValue ? "Enabled" : "Disabled"}
            </span>
          </label>
        );

      case "number":
        return (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={setting.overrideValue as number}
              onChange={(e) =>
                handleValueChange(
                  config.category,
                  config.key,
                  parseFloat(e.target.value) || 0
                )
              }
              className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {config.key === "tax_rate" && (
              <span className="text-gray-500">%</span>
            )}
          </div>
        );

      case "select":
        return (
          <select
            value={setting.overrideValue as string}
            onChange={(e) =>
              handleValueChange(config.category, config.key, e.target.value)
            }
            className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {config.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case "textarea":
        return (
          <textarea
            value={setting.overrideValue as string}
            onChange={(e) =>
              handleValueChange(config.category, config.key, e.target.value)
            }
            rows={3}
            placeholder="Enter special instructions..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );

      case "checkboxes":
        const selectedValues = (setting.overrideValue as string[]) || [];
        return (
          <div className="space-y-2">
            {config.options?.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-3 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option.value)}
                  onChange={(e) =>
                    handleCheckboxChange(
                      config.category,
                      config.key,
                      option.value,
                      e.target.checked
                    )
                  }
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={setting.overrideValue as string}
            onChange={(e) =>
              handleValueChange(config.category, config.key, e.target.value)
            }
            className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );
    }
  };

  return (
    <AppShell
      title={`${client.company_name} Settings`}
      subtitle="Configure client-specific settings and overrides"
      actions={backLink}
    >
      <div className="space-y-6">
        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            Settings inherit from system defaults unless overridden. Enable the
            &quot;Override&quot; checkbox to set a client-specific value.
          </p>
        </div>

        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const sectionSettings = SETTING_CONFIGS.filter(
            (config) => config.category === section.key
          );

          return (
            <Card key={section.key}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {section.label}
                </h2>
              </div>

              <div>
                {sectionSettings.map((config) => renderSettingRow(config))}
              </div>
            </Card>
          );
        })}

        {/* Save Button */}
        <div className="flex justify-end gap-3 sticky bottom-4">
          <Button
            variant="secondary"
            onClick={() => router.push(`/clients/${client.id}`)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            loading={saving}
          >
            <Save className="w-4 h-4 mr-1" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
