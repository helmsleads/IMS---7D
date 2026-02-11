"use client";

import { useState, useEffect, ChangeEvent } from "react";
import AppShell from "@/components/internal/AppShell";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import {
  Palette,
  ToggleLeft,
  Loader2,
  Save,
  Check,
  AlertCircle,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";
import { getPortalSettings, setPortalSetting } from "@/lib/api/settings";
import { PortalSetting } from "@/types/database";

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
  type: "text" | "number" | "select" | "toggle" | "textarea" | "color" | "image";
  options?: { value: string; label: string }[];
  defaultValue: unknown;
  unit?: string;
}

const SETTING_CATEGORIES: SettingCategory[] = [
  {
    id: "branding",
    label: "Branding",
    icon: Palette,
    description: "Customize the portal appearance for clients",
    settings: [
      {
        key: "portal_name",
        label: "Portal Name",
        description: "Name displayed in the portal header and browser tab",
        type: "text",
        defaultValue: "Client Portal",
      },
      {
        key: "logo_url",
        label: "Logo",
        description: "Upload your company logo (recommended size: 200x50px, PNG or SVG)",
        type: "image",
        defaultValue: "",
      },
      {
        key: "primary_color",
        label: "Primary Color",
        description: "Main brand color used for buttons, links, and accents",
        type: "color",
        defaultValue: "#3b82f6",
      },
      {
        key: "secondary_color",
        label: "Secondary Color",
        description: "Secondary color for backgrounds and highlights",
        type: "color",
        defaultValue: "#10b981",
      },
    ],
  },
  {
    id: "features",
    label: "Features",
    icon: ToggleLeft,
    description: "Global feature toggles for the client portal",
    settings: [
      {
        key: "profitability_tracking_enabled",
        label: "Profitability Tracking",
        description: "Enable profitability tracking and analytics for clients",
        type: "toggle",
        defaultValue: true,
      },
      {
        key: "messages_enabled",
        label: "Messages",
        description: "Enable messaging between clients and warehouse staff",
        type: "toggle",
        defaultValue: true,
      },
      {
        key: "returns_enabled",
        label: "Returns",
        description: "Enable return requests and tracking for clients",
        type: "toggle",
        defaultValue: true,
      },
      {
        key: "order_templates_enabled",
        label: "Order Templates",
        description: "Enable clients to create and use order templates",
        type: "toggle",
        defaultValue: true,
      },
      {
        key: "product_values_editing_enabled",
        label: "Product Values Editing",
        description: "Allow clients to edit product sale prices and costs for profitability",
        type: "toggle",
        defaultValue: false,
      },
    ],
  },
];

type CategoryValues = Record<string, unknown>;
type AllValues = Record<string, CategoryValues>;

export default function PortalSettingsPage() {
  const [values, setValues] = useState<AllValues>({});
  const [originalValues, setOriginalValues] = useState<AllValues>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const settings = await getPortalSettings();

      // Initialize values with defaults
      const initialValues: AllValues = {};
      SETTING_CATEGORIES.forEach((category) => {
        initialValues[category.id] = {};
        category.settings.forEach((setting) => {
          initialValues[category.id][setting.key] = setting.defaultValue;
        });
      });

      // Override with actual values from database
      settings.forEach((setting: PortalSetting) => {
        // Find which category this setting belongs to
        for (const category of SETTING_CATEGORIES) {
          const settingConfig = category.settings.find((s) => s.key === setting.setting_key);
          if (settingConfig) {
            initialValues[category.id][setting.setting_key] = setting.setting_value;
            break;
          }
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
        await setPortalSetting(setting.key, value);
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
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              handleValueChange(category, setting.key, e.target.value)
            }
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

      case "color":
        return (
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={(value as string) || "#3b82f6"}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                handleValueChange(category, setting.key, e.target.value)
              }
              className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
            />
            <Input
              type="text"
              value={(value as string) || ""}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                handleValueChange(category, setting.key, e.target.value)
              }
              placeholder="#000000"
            />
          </div>
        );

      case "select":
        return (
          <div className="w-64">
            <Select
              value={(value as string) || ""}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                handleValueChange(category, setting.key, e.target.value)
              }
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
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
              handleValueChange(category, setting.key, e.target.value)
            }
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        );

      case "image":
        return (
          <div className="space-y-3">
            {value ? (
              <div className="flex items-center gap-4">
                <div className="relative w-48 h-12 bg-gray-100 rounded-lg border border-gray-200 overflow-hidden">
                  <img
                    src={value as string}
                    alt="Logo preview"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleValueChange(category, setting.key, "")}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  title="Remove logo"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : null}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                <span className="text-sm font-medium">Upload Logo</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  className="hidden"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        handleValueChange(category, setting.key, reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
              <span className="text-sm text-gray-500">or</span>
              <Input
                type="text"
                value={(value as string) || ""}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  handleValueChange(category, setting.key, e.target.value)
                }
                placeholder="Enter image URL"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <AppShell title="Portal Settings">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Portal Settings">
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
