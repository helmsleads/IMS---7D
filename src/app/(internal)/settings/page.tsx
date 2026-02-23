"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AppShell from "@/components/internal/AppShell";
import Input from "@/components/ui/Input";
import { User, Bell, Loader2, Settings2, Globe, ChevronRight, GitBranch } from "lucide-react";
import { createClient } from "@/lib/supabase";
import {
  NotificationType,
  getUserNotificationSettings,
  updateNotificationSetting,
} from "@/lib/api/notifications";

type SettingsTab = "profile" | "notifications";

const TABS: { id: SettingsTab; label: string; icon: typeof User }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
];

const ADMIN_SETTINGS = [
  {
    href: "/settings/workflows",
    label: "Workflow Profiles",
    description: "Industry rules and automation",
    icon: GitBranch,
  },
  {
    href: "/settings/system",
    label: "System Settings",
    description: "Inventory, billing, and notifications",
    icon: Settings2,
  },
  {
    href: "/settings/portal",
    label: "Portal Settings",
    description: "Branding and feature toggles",
    icon: Globe,
  },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  return (
    <AppShell title="Settings">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:w-72 flex-shrink-0 space-y-4">
          {/* User Settings */}
          <nav className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                User Settings
              </span>
            </div>
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                    ${isActive
                      ? "bg-blue-50 text-blue-600 border-l-4 border-blue-600"
                      : "text-gray-600 hover:bg-gray-50 border-l-4 border-transparent"
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Admin Settings */}
          <nav className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Admin Settings
              </span>
            </div>
            {ADMIN_SETTINGS.map((setting) => {
              const Icon = setting.icon;
              return (
                <Link
                  key={setting.href}
                  href={setting.href}
                  className="flex items-center gap-3 px-4 py-3 text-left transition-colors text-gray-600 hover:bg-gray-50 border-l-4 border-transparent group"
                >
                  <Icon className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium block">{setting.label}</span>
                    <span className="text-xs text-gray-400">{setting.description}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1">
          {activeTab === "profile" && <ProfileTab />}
          {activeTab === "notifications" && <NotificationsTab />}
        </div>
      </div>
    </AppShell>
  );
}

function ProfileTab() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Profile Settings</h2>

      <div className="space-y-6">
        <Input
          label="Full Name"
          name="fullName"
          type="text"
          placeholder="Enter your name"
        />

        <Input
          label="Email Address"
          name="email"
          type="email"
          placeholder="your@email.com"
          disabled
          hint="Contact an administrator to change your email"
        />

        <div className="pt-4 border-t border-gray-200">
          <button className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

interface NotificationConfig {
  id: NotificationType;
  label: string;
  description: string;
}

const NOTIFICATION_OPTIONS: NotificationConfig[] = [
  {
    id: "new_order",
    label: "New Order Requests",
    description: "Get notified when a client submits a new shipment request",
  },
  {
    id: "order_shipped",
    label: "Order Shipped",
    description: "Get notified when orders are marked as shipped",
  },
  {
    id: "low_stock",
    label: "Low Stock Alerts",
    description: "Get notified when inventory falls below reorder points",
  },
  {
    id: "inbound_arrived",
    label: "Inbound Arrivals",
    description: "Get notified when inbound shipments are received",
  },
];

function NotificationsTab() {
  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<NotificationType, boolean>>({
    new_order: true,
    order_shipped: true,
    low_stock: true,
    inbound_arrived: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<NotificationType | null>(null);

  useEffect(() => {
    async function loadSettings() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setUserId(user.id);
        const userSettings = await getUserNotificationSettings(user.id);
        setSettings(userSettings);
      }

      setLoading(false);
    }

    loadSettings();
  }, []);

  const handleToggle = async (type: NotificationType) => {
    if (!userId || saving) return;

    const newValue = !settings[type];
    setSaving(type);

    // Optimistic update
    setSettings((prev) => ({ ...prev, [type]: newValue }));

    const result = await updateNotificationSetting(userId, type, newValue);

    if (!result.success) {
      // Revert on failure
      setSettings((prev) => ({ ...prev, [type]: !newValue }));
      console.error("Failed to update notification setting:", result.error);
    }

    setSaving(null);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Email Notifications</h2>
      <p className="text-gray-500 mb-6">Choose which notifications you want to receive</p>

      <div className="space-y-1">
        {NOTIFICATION_OPTIONS.map((option) => (
          <div
            key={option.id}
            className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0"
          >
            <div>
              <p className="font-medium text-gray-900">{option.label}</p>
              <p className="text-sm text-gray-500">{option.description}</p>
            </div>
            <button
              onClick={() => handleToggle(option.id)}
              disabled={saving === option.id}
              className={`
                relative w-12 h-6 rounded-full transition-colors disabled:opacity-50
                ${settings[option.id] ? "bg-blue-600" : "bg-gray-300"}
              `}
            >
              {saving === option.id ? (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                </span>
              ) : (
                <span
                  className={`
                    absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow
                    ${settings[option.id] ? "left-7" : "left-1"}
                  `}
                />
              )}
            </button>
          </div>
        ))}
      </div>

      <p className="text-sm text-gray-400 mt-6">
        Changes are saved automatically
      </p>
    </div>
  );
}
