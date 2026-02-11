"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Alert from "@/components/ui/Alert";
import {
  ArrowLeft,
  Save,
  Loader2,
  Settings,
  Shield,
  Package,
  Truck,
  RotateCcw,
  CreditCard,
  Globe,
  Boxes,
  Bell,
  FileText,
  Zap,
  Check,
} from "lucide-react";
import {
  getWorkflowProfile,
  updateWorkflowProfile,
  getAllIndustries,
  DEFAULT_PORTAL_FEATURES,
} from "@/lib/api/workflow-profiles";
import {
  WorkflowProfile,
  ClientIndustry,
  PortalFeatures,
  PickStrategy,
  BillingModel,
  ContainerType,
} from "@/types/database";

type EditorTab =
  | "general"
  | "compliance"
  | "inbound"
  | "outbound"
  | "inventory"
  | "shipping"
  | "returns"
  | "billing"
  | "portal"
  | "integrations";

const TABS: { id: EditorTab; label: string; icon: typeof Settings }[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "compliance", label: "Compliance", icon: Shield },
  { id: "inbound", label: "Inbound", icon: Package },
  { id: "outbound", label: "Outbound", icon: Truck },
  { id: "inventory", label: "Inventory", icon: Boxes },
  { id: "shipping", label: "Shipping", icon: Globe },
  { id: "returns", label: "Returns", icon: RotateCcw },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "portal", label: "Portal", icon: FileText },
  { id: "integrations", label: "Integrations", icon: Zap },
];

const PICK_STRATEGIES: { value: PickStrategy; label: string; description: string }[] = [
  { value: "FEFO", label: "FEFO", description: "First Expired, First Out - best for perishables" },
  { value: "FIFO", label: "FIFO", description: "First In, First Out - standard warehouse practice" },
  { value: "LIFO", label: "LIFO", description: "Last In, First Out - for non-perishable bulk" },
];

const BILLING_MODELS: { value: BillingModel; label: string; description: string }[] = [
  { value: "per_order", label: "Per Order", description: "Flat fee per order processed" },
  { value: "per_unit", label: "Per Unit", description: "Fee based on units shipped" },
  { value: "monthly", label: "Monthly", description: "Fixed monthly fee" },
  { value: "custom", label: "Custom", description: "Custom billing arrangement" },
];

const CONTAINER_TYPES: { value: ContainerType; label: string }[] = [
  { value: "bottle", label: "Bottle" },
  { value: "can", label: "Can / RTD" },
  { value: "keg", label: "Keg" },
  { value: "bag_in_box", label: "Bag-in-Box" },
  { value: "gift_box", label: "Gift Box" },
  { value: "other", label: "Other" },
];

const CARRIERS = [
  { value: "ups", label: "UPS" },
  { value: "fedex", label: "FedEx" },
  { value: "usps", label: "USPS" },
  { value: "dhl", label: "DHL" },
  { value: "ontrac", label: "OnTrac" },
  { value: "gso", label: "GSO" },
];

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

const COLOR_PRESETS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
];

export default function WorkflowEditorPage() {
  const params = useParams();
  const router = useRouter();
  const profileId = params.id as string;

  const [profile, setProfile] = useState<WorkflowProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<EditorTab>("general");
  const [hasChanges, setHasChanges] = useState(false);

  const industries = getAllIndustries();

  useEffect(() => {
    fetchProfile();
  }, [profileId]);

  const fetchProfile = async () => {
    try {
      const data = await getWorkflowProfile(profileId);
      if (!data) {
        router.push("/settings/workflows");
        return;
      }
      setProfile(data);
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      setError("Failed to load workflow profile");
    } finally {
      setLoading(false);
    }
  };

  const updateField = useCallback(<K extends keyof WorkflowProfile>(
    field: K,
    value: WorkflowProfile[K]
  ) => {
    setProfile((prev) => prev ? { ...prev, [field]: value } : null);
    setHasChanges(true);
    setSaved(false);
  }, []);

  const updatePortalFeature = useCallback((feature: keyof PortalFeatures, value: boolean) => {
    setProfile((prev) => {
      if (!prev) return null;
      const currentFeatures = (prev.portal_features as PortalFeatures) || DEFAULT_PORTAL_FEATURES;
      return {
        ...prev,
        portal_features: { ...currentFeatures, [feature]: value },
      };
    });
    setHasChanges(true);
    setSaved(false);
  }, []);

  const toggleArrayItem = useCallback(<T,>(field: keyof WorkflowProfile, item: T) => {
    setProfile((prev) => {
      if (!prev) return null;
      const currentArray = (prev[field] as T[]) || [];
      const newArray = currentArray.includes(item)
        ? currentArray.filter((i) => i !== item)
        : [...currentArray, item];
      return { ...prev, [field]: newArray };
    });
    setHasChanges(true);
    setSaved(false);
  }, []);

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    setError("");

    try {
      await updateWorkflowProfile(profile.id, profile);
      setHasChanges(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell title="Loading...">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell title="Not Found">
        <Card className="text-center py-12">
          <p className="text-gray-500">Workflow profile not found</p>
          <Link href="/settings/workflows" className="text-blue-600 hover:underline mt-4 inline-block">
            Back to Workflows
          </Link>
        </Card>
      </AppShell>
    );
  }

  const portalFeatures = (profile.portal_features as PortalFeatures) || DEFAULT_PORTAL_FEATURES;

  return (
    <AppShell title={`Edit: ${profile.name}`}>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/settings/workflows"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Workflows
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: profile.color || "#E5E7EB" }}
            >
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{profile.name}</h1>
              <p className="text-gray-500">{profile.code}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="flex items-center gap-1 text-green-600 text-sm">
                <Check className="w-4 h-4" />
                Saved
              </span>
            )}
            <Button onClick={handleSave} loading={saving} disabled={!hasChanges}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Tabs */}
        <nav className="lg:w-56 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-4">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              // Check if this section is enabled
              let isEnabled = true;
              if (tab.id === "inbound") isEnabled = profile.inbound_enabled;
              if (tab.id === "outbound") isEnabled = profile.outbound_enabled;
              if (tab.id === "inventory") isEnabled = profile.inventory_enabled;
              if (tab.id === "shipping") isEnabled = profile.shipping_enabled;
              if (tab.id === "returns") isEnabled = profile.returns_enabled;
              if (tab.id === "billing") isEnabled = profile.billing_enabled;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 text-left transition-colors text-sm
                    ${isActive
                      ? "bg-blue-50 text-blue-600 border-l-4 border-blue-600"
                      : "text-gray-600 hover:bg-gray-50 border-l-4 border-transparent"
                    }
                  `}
                >
                  <Icon className={`w-4 h-4 ${!isEnabled && tab.id !== "general" && tab.id !== "compliance" && tab.id !== "portal" && tab.id !== "integrations" ? "text-gray-300" : ""}`} />
                  <span className="font-medium">{tab.label}</span>
                  {!isEnabled && tab.id !== "general" && tab.id !== "compliance" && tab.id !== "portal" && tab.id !== "integrations" && (
                    <span className="ml-auto text-xs text-gray-400">Off</span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Tab Content */}
        <div className="flex-1 min-w-0">
          {activeTab === "general" && (
            <GeneralTab
              profile={profile}
              industries={industries}
              updateField={updateField}
              toggleArrayItem={toggleArrayItem}
            />
          )}
          {activeTab === "compliance" && (
            <ComplianceTab profile={profile} updateField={updateField} toggleArrayItem={toggleArrayItem} />
          )}
          {activeTab === "inbound" && (
            <InboundTab profile={profile} updateField={updateField} />
          )}
          {activeTab === "outbound" && (
            <OutboundTab profile={profile} updateField={updateField} />
          )}
          {activeTab === "inventory" && (
            <InventoryTab profile={profile} updateField={updateField} />
          )}
          {activeTab === "shipping" && (
            <ShippingTab profile={profile} updateField={updateField} toggleArrayItem={toggleArrayItem} />
          )}
          {activeTab === "returns" && (
            <ReturnsTab profile={profile} updateField={updateField} />
          )}
          {activeTab === "billing" && (
            <BillingTab profile={profile} updateField={updateField} />
          )}
          {activeTab === "portal" && (
            <PortalTab
              profile={profile}
              portalFeatures={portalFeatures}
              updatePortalFeature={updatePortalFeature}
            />
          )}
          {activeTab === "integrations" && (
            <IntegrationsTab profile={profile} updateField={updateField} />
          )}
        </div>
      </div>
    </AppShell>
  );
}

// ============================================
// TOGGLE COMPONENT
// ============================================

interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  masterToggle?: boolean;
}

function Toggle({ enabled, onChange, label, description, disabled, masterToggle }: ToggleProps) {
  return (
    <label className={`flex items-start gap-4 cursor-pointer ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
      <button
        type="button"
        onClick={() => !disabled && onChange(!enabled)}
        disabled={disabled}
        className={`
          relative flex-shrink-0 w-11 h-6 rounded-full transition-colors mt-0.5
          ${enabled ? (masterToggle ? "bg-green-500" : "bg-blue-600") : "bg-gray-300"}
          ${disabled ? "cursor-not-allowed" : ""}
        `}
      >
        <span
          className={`
            absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow
            ${enabled ? "left-6" : "left-1"}
          `}
        />
      </button>
      <div className="flex-1 min-w-0">
        <span className={`font-medium ${masterToggle ? "text-gray-900" : "text-gray-700"}`}>
          {label}
        </span>
        {description && (
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
    </label>
  );
}

// ============================================
// SECTION HEADER COMPONENT
// ============================================

interface SectionHeaderProps {
  title: string;
  description?: string;
  enabled?: boolean;
  onToggle?: (enabled: boolean) => void;
}

function SectionHeader({ title, description, enabled, onToggle }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6 pb-4 border-b border-gray-200">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      </div>
      {onToggle !== undefined && (
        <Toggle
          enabled={enabled || false}
          onChange={onToggle}
          label={enabled ? "Enabled" : "Disabled"}
          masterToggle
        />
      )}
    </div>
  );
}

// ============================================
// GENERAL TAB
// ============================================

interface TabProps {
  profile: WorkflowProfile;
  updateField: <K extends keyof WorkflowProfile>(field: K, value: WorkflowProfile[K]) => void;
}

interface GeneralTabProps extends TabProps {
  industries: { value: ClientIndustry; label: string; category: string }[];
  toggleArrayItem: <T>(field: keyof WorkflowProfile, item: T) => void;
}

function GeneralTab({ profile, industries, updateField, toggleArrayItem }: GeneralTabProps) {
  return (
    <Card>
      <SectionHeader title="General Settings" description="Basic workflow identification and display settings" />

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Name"
            value={profile.name}
            onChange={(e) => updateField("name", e.target.value)}
            required
          />
          <Input
            label="Code"
            value={profile.code}
            onChange={(e) => updateField("code", e.target.value.toUpperCase())}
            required
            hint="Unique identifier"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={profile.description || ""}
            onChange={(e) => updateField("description", e.target.value || null)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Describe this workflow's purpose..."
          />
        </div>

        <Select
          label="Industry"
          name="industry"
          value={profile.industry}
          onChange={(e) => updateField("industry", e.target.value as ClientIndustry)}
          options={industries.map((i) => ({ value: i.value, label: i.label }))}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => updateField("color", color)}
                className={`w-8 h-8 rounded-lg transition-transform ${
                  profile.color === color ? "ring-2 ring-offset-2 ring-blue-500 scale-110" : ""
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Allowed Container Types</label>
          <div className="flex flex-wrap gap-2">
            {CONTAINER_TYPES.map((ct) => {
              const isSelected = profile.allowed_container_types?.includes(ct.value);
              return (
                <button
                  key={ct.value}
                  type="button"
                  onClick={() => toggleArrayItem("allowed_container_types", ct.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isSelected
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {ct.label}
                </button>
              );
            })}
          </div>
        </div>

        <Toggle
          enabled={profile.is_active}
          onChange={(v) => updateField("is_active", v)}
          label="Active"
          description="Inactive workflows won't appear for client assignment"
        />
      </div>
    </Card>
  );
}

// ============================================
// COMPLIANCE TAB
// ============================================

interface ComplianceTabProps extends TabProps {
  toggleArrayItem: <T>(field: keyof WorkflowProfile, item: T) => void;
}

function ComplianceTab({ profile, updateField, toggleArrayItem }: ComplianceTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <SectionHeader title="Tracking Requirements" description="Configure lot and serial tracking requirements" />

        <div className="space-y-4">
          <Toggle
            enabled={profile.requires_lot_tracking}
            onChange={(v) => updateField("requires_lot_tracking", v)}
            label="Require Lot Tracking"
            description="All inbound inventory must have a lot number assigned"
          />
          <Toggle
            enabled={profile.requires_expiration_dates}
            onChange={(v) => updateField("requires_expiration_dates", v)}
            label="Require Expiration Dates"
            description="Products must have expiration dates recorded"
          />
          <Toggle
            enabled={profile.track_serial_numbers}
            onChange={(v) => updateField("track_serial_numbers", v)}
            label="Track Serial Numbers"
            description="Enable individual unit tracking by serial number"
          />
        </div>
      </Card>

      <Card>
        <SectionHeader title="Regulatory Compliance" description="Alcohol and age-restricted product requirements" />

        <div className="space-y-4">
          <Toggle
            enabled={profile.requires_age_verification}
            onChange={(v) => updateField("requires_age_verification", v)}
            label="Age Verification Required"
            description="Require age verification for outbound shipments"
          />
          <Toggle
            enabled={profile.requires_ttb_compliance}
            onChange={(v) => updateField("requires_ttb_compliance", v)}
            label="TTB Compliance"
            description="Alcohol Tax and Trade Bureau compliance tracking"
          />
          <Toggle
            enabled={profile.has_state_restrictions}
            onChange={(v) => updateField("has_state_restrictions", v)}
            label="State Shipping Restrictions"
            description="Block shipments to restricted states"
          />

          {profile.has_state_restrictions && (
            <div className="ml-14 mt-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Restricted States</label>
              <div className="flex flex-wrap gap-1">
                {US_STATES.map((state) => {
                  const isRestricted = profile.restricted_states?.includes(state);
                  return (
                    <button
                      key={state}
                      type="button"
                      onClick={() => toggleArrayItem("restricted_states", state)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        isRestricted
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {state}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <SectionHeader title="Quality Control" description="Inspection and quarantine settings" />

        <div className="space-y-4">
          <Toggle
            enabled={profile.quality_inspection_required}
            onChange={(v) => updateField("quality_inspection_required", v)}
            label="Inspection Required"
            description="Require quality inspection for inbound shipments"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quarantine Period (Days)</label>
            <input
              type="number"
              value={profile.quarantine_days || 0}
              onChange={(e) => updateField("quarantine_days", parseInt(e.target.value) || 0)}
              min={0}
              className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">Days to hold inventory before available for picking</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============================================
// INBOUND TAB
// ============================================

function InboundTab({ profile, updateField }: TabProps) {
  return (
    <Card>
      <SectionHeader
        title="Inbound Rules"
        description="Configure requirements for receiving inventory"
        enabled={profile.inbound_enabled}
        onToggle={(v) => updateField("inbound_enabled", v)}
      />

      <div className={`space-y-4 ${!profile.inbound_enabled ? "opacity-50 pointer-events-none" : ""}`}>
        <Toggle
          enabled={profile.inbound_requires_po}
          onChange={(v) => updateField("inbound_requires_po", v)}
          label="Require PO Number"
          description="Inbound orders must have a PO number"
          disabled={!profile.inbound_enabled}
        />
        <Toggle
          enabled={profile.inbound_requires_appointment}
          onChange={(v) => updateField("inbound_requires_appointment", v)}
          label="Require Appointment"
          description="Deliveries must be scheduled in advance"
          disabled={!profile.inbound_enabled}
        />
        <Toggle
          enabled={profile.inbound_auto_create_lots}
          onChange={(v) => updateField("inbound_auto_create_lots", v)}
          label="Auto-Create Lots"
          description="Automatically generate lot numbers on receiving"
          disabled={!profile.inbound_enabled}
        />

        {profile.inbound_auto_create_lots && (
          <div className="ml-14">
            <Input
              label="Lot Number Format"
              value={profile.inbound_lot_format || ""}
              onChange={(e) => updateField("inbound_lot_format", e.target.value || null)}
              placeholder="LOT-{YYYY}{MM}{DD}-{SEQ}"
              hint="Variables: {YYYY}, {MM}, {DD}, {SEQ}, {CLIENT}, {PO}"
            />
          </div>
        )}

        <Toggle
          enabled={profile.inbound_require_inspection}
          onChange={(v) => updateField("inbound_require_inspection", v)}
          label="Require Inspection"
          description="All inbound shipments must be inspected"
          disabled={!profile.inbound_enabled}
        />
      </div>
    </Card>
  );
}

// ============================================
// OUTBOUND TAB
// ============================================

function OutboundTab({ profile, updateField }: TabProps) {
  return (
    <Card>
      <SectionHeader
        title="Outbound Rules"
        description="Configure order processing and fulfillment"
        enabled={profile.outbound_enabled}
        onToggle={(v) => updateField("outbound_enabled", v)}
      />

      <div className={`space-y-4 ${!profile.outbound_enabled ? "opacity-50 pointer-events-none" : ""}`}>
        <Toggle
          enabled={profile.outbound_requires_approval}
          onChange={(v) => updateField("outbound_requires_approval", v)}
          label="Require Approval"
          description="Orders must be approved before processing"
          disabled={!profile.outbound_enabled}
        />
        <Toggle
          enabled={profile.outbound_auto_allocate}
          onChange={(v) => updateField("outbound_auto_allocate", v)}
          label="Auto-Allocate Inventory"
          description="Automatically reserve inventory when order is confirmed"
          disabled={!profile.outbound_enabled}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Pick Strategy</label>
          <div className="space-y-2">
            {PICK_STRATEGIES.map((strategy) => (
              <label key={strategy.value} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="pick_strategy"
                  value={strategy.value}
                  checked={profile.outbound_pick_strategy === strategy.value}
                  onChange={() => updateField("outbound_pick_strategy", strategy.value)}
                  disabled={!profile.outbound_enabled}
                  className="mt-1"
                />
                <div>
                  <span className="font-medium text-gray-900">{strategy.label}</span>
                  <p className="text-sm text-gray-500">{strategy.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <Toggle
          enabled={profile.outbound_allow_partial_shipment}
          onChange={(v) => updateField("outbound_allow_partial_shipment", v)}
          label="Allow Partial Shipments"
          description="Ship available items even if order is incomplete"
          disabled={!profile.outbound_enabled}
        />
        <Toggle
          enabled={profile.outbound_allow_backorder}
          onChange={(v) => updateField("outbound_allow_backorder", v)}
          label="Allow Backorders"
          description="Accept orders for items not currently in stock"
          disabled={!profile.outbound_enabled}
        />
        <Toggle
          enabled={profile.default_requires_repack}
          onChange={(v) => updateField("default_requires_repack", v)}
          label="Default Requires Repack"
          description="Orders default to requiring repacking"
          disabled={!profile.outbound_enabled}
        />
      </div>
    </Card>
  );
}

// ============================================
// INVENTORY TAB
// ============================================

function InventoryTab({ profile, updateField }: TabProps) {
  return (
    <Card>
      <SectionHeader
        title="Inventory Rules"
        description="Configure inventory management settings"
        enabled={profile.inventory_enabled}
        onToggle={(v) => updateField("inventory_enabled", v)}
      />

      <div className={`space-y-4 ${!profile.inventory_enabled ? "opacity-50 pointer-events-none" : ""}`}>
        <Toggle
          enabled={profile.inventory_allow_negative}
          onChange={(v) => updateField("inventory_allow_negative", v)}
          label="Allow Negative Inventory"
          description="Permit shipping even when stock shows zero"
          disabled={!profile.inventory_enabled}
        />
        <Toggle
          enabled={profile.inventory_reorder_alerts}
          onChange={(v) => updateField("inventory_reorder_alerts", v)}
          label="Reorder Alerts"
          description="Send alerts when inventory falls below reorder points"
          disabled={!profile.inventory_enabled}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cycle Count Frequency (Days)</label>
          <input
            type="number"
            value={profile.inventory_cycle_count_frequency || ""}
            onChange={(e) => updateField("inventory_cycle_count_frequency", e.target.value ? parseInt(e.target.value) : null)}
            min={0}
            placeholder="No scheduled counts"
            disabled={!profile.inventory_enabled}
            className="w-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <p className="text-sm text-gray-500 mt-1">How often to perform cycle counts (leave empty to disable)</p>
        </div>
      </div>
    </Card>
  );
}

// ============================================
// SHIPPING TAB
// ============================================

interface ShippingTabProps extends TabProps {
  toggleArrayItem: <T>(field: keyof WorkflowProfile, item: T) => void;
}

function ShippingTab({ profile, updateField, toggleArrayItem }: ShippingTabProps) {
  return (
    <Card>
      <SectionHeader
        title="Shipping Rules"
        description="Configure carrier and delivery options"
        enabled={profile.shipping_enabled}
        onToggle={(v) => updateField("shipping_enabled", v)}
      />

      <div className={`space-y-4 ${!profile.shipping_enabled ? "opacity-50 pointer-events-none" : ""}`}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Allowed Carriers</label>
          <div className="flex flex-wrap gap-2">
            {CARRIERS.map((carrier) => {
              const isSelected = profile.shipping_allowed_carriers?.includes(carrier.value);
              return (
                <button
                  key={carrier.value}
                  type="button"
                  onClick={() => toggleArrayItem("shipping_allowed_carriers", carrier.value)}
                  disabled={!profile.shipping_enabled}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isSelected
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  } disabled:opacity-50`}
                >
                  {carrier.label}
                </button>
              );
            })}
          </div>
        </div>

        <Input
          label="Default Shipping Service"
          value={profile.shipping_default_service || ""}
          onChange={(e) => updateField("shipping_default_service", e.target.value || null)}
          placeholder="e.g., UPS Ground"
          disabled={!profile.shipping_enabled}
        />

        <Toggle
          enabled={profile.shipping_requires_signature}
          onChange={(v) => updateField("shipping_requires_signature", v)}
          label="Require Signature"
          description="All shipments require signature on delivery"
          disabled={!profile.shipping_enabled}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Threshold ($)</label>
          <input
            type="number"
            value={profile.shipping_insurance_threshold || ""}
            onChange={(e) => updateField("shipping_insurance_threshold", e.target.value ? parseFloat(e.target.value) : null)}
            min={0}
            step={0.01}
            placeholder="No auto-insurance"
            disabled={!profile.shipping_enabled}
            className="w-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <p className="text-sm text-gray-500 mt-1">Auto-insure orders above this value</p>
        </div>

        <Toggle
          enabled={profile.shipping_hazmat_enabled}
          onChange={(v) => updateField("shipping_hazmat_enabled", v)}
          label="Hazmat Shipping"
          description="Enable hazardous materials shipping options"
          disabled={!profile.shipping_enabled}
        />
      </div>
    </Card>
  );
}

// ============================================
// RETURNS TAB
// ============================================

function ReturnsTab({ profile, updateField }: TabProps) {
  return (
    <Card>
      <SectionHeader
        title="Returns Rules"
        description="Configure return policies and processing"
        enabled={profile.returns_enabled}
        onToggle={(v) => updateField("returns_enabled", v)}
      />

      <div className={`space-y-4 ${!profile.returns_enabled ? "opacity-50 pointer-events-none" : ""}`}>
        <Toggle
          enabled={profile.returns_allowed}
          onChange={(v) => updateField("returns_allowed", v)}
          label="Returns Allowed"
          description="Clients can request returns"
          disabled={!profile.returns_enabled}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Return Window (Days)</label>
          <input
            type="number"
            value={profile.returns_window_days}
            onChange={(e) => updateField("returns_window_days", parseInt(e.target.value) || 30)}
            min={0}
            disabled={!profile.returns_enabled}
            className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <p className="text-sm text-gray-500 mt-1">Days after delivery to accept returns</p>
        </div>

        <Toggle
          enabled={profile.returns_requires_rma}
          onChange={(v) => updateField("returns_requires_rma", v)}
          label="Require RMA Number"
          description="Returns must have an approved RMA before shipping"
          disabled={!profile.returns_enabled}
        />
        <Toggle
          enabled={profile.returns_auto_restock}
          onChange={(v) => updateField("returns_auto_restock", v)}
          label="Auto-Restock"
          description="Automatically add returned items back to inventory"
          disabled={!profile.returns_enabled}
        />
      </div>
    </Card>
  );
}

// ============================================
// BILLING TAB
// ============================================

function BillingTab({ profile, updateField }: TabProps) {
  return (
    <Card>
      <SectionHeader
        title="Billing Rules"
        description="Configure pricing and billing settings"
        enabled={profile.billing_enabled}
        onToggle={(v) => updateField("billing_enabled", v)}
      />

      <div className={`space-y-4 ${!profile.billing_enabled ? "opacity-50 pointer-events-none" : ""}`}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Billing Model</label>
          <div className="space-y-2">
            {BILLING_MODELS.map((model) => (
              <label key={model.value} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="billing_model"
                  value={model.value}
                  checked={profile.billing_model === model.value}
                  onChange={() => updateField("billing_model", model.value)}
                  disabled={!profile.billing_enabled}
                  className="mt-1"
                />
                <div>
                  <span className="font-medium text-gray-900">{model.label}</span>
                  <p className="text-sm text-gray-500">{model.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Storage Rate ($/pallet/day)</label>
            <input
              type="number"
              value={profile.billing_storage_rate || ""}
              onChange={(e) => updateField("billing_storage_rate", e.target.value ? parseFloat(e.target.value) : null)}
              min={0}
              step={0.01}
              disabled={!profile.billing_enabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pick Rate ($/pick)</label>
            <input
              type="number"
              value={profile.billing_pick_rate || ""}
              onChange={(e) => updateField("billing_pick_rate", e.target.value ? parseFloat(e.target.value) : null)}
              min={0}
              step={0.01}
              disabled={!profile.billing_enabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pack Rate ($/pack)</label>
            <input
              type="number"
              value={profile.billing_pack_rate || ""}
              onChange={(e) => updateField("billing_pack_rate", e.target.value ? parseFloat(e.target.value) : null)}
              min={0}
              step={0.01}
              disabled={!profile.billing_enabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Monthly ($)</label>
            <input
              type="number"
              value={profile.billing_minimum_monthly || ""}
              onChange={(e) => updateField("billing_minimum_monthly", e.target.value ? parseFloat(e.target.value) : null)}
              min={0}
              step={0.01}
              disabled={!profile.billing_enabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

// ============================================
// PORTAL TAB
// ============================================

interface PortalTabProps {
  profile: WorkflowProfile;
  portalFeatures: PortalFeatures;
  updatePortalFeature: (feature: keyof PortalFeatures, value: boolean) => void;
}

function PortalTab({ portalFeatures, updatePortalFeature }: PortalTabProps) {
  const features: { key: keyof PortalFeatures; label: string; description: string }[] = [
    { key: "can_view_inventory", label: "View Inventory", description: "Access inventory levels and details" },
    { key: "can_request_shipments", label: "Request Shipments", description: "Create outbound shipment requests" },
    { key: "can_view_lot_details", label: "View Lot Details", description: "See lot numbers and expiration dates" },
    { key: "can_request_returns", label: "Request Returns", description: "Submit return requests" },
    { key: "can_view_invoices", label: "View Invoices", description: "Access billing and invoices" },
    { key: "can_manage_addresses", label: "Manage Addresses", description: "Add and edit shipping addresses" },
    { key: "can_use_order_templates", label: "Use Order Templates", description: "Create and use saved order templates" },
    { key: "can_view_profitability", label: "View Profitability", description: "Access profitability reports" },
    { key: "can_send_messages", label: "Send Messages", description: "Use the messaging system" },
    { key: "can_view_tracking", label: "View Tracking", description: "Track shipment status" },
  ];

  return (
    <Card>
      <SectionHeader title="Portal Features" description="Control what clients can access in their portal" />

      <div className="space-y-4">
        {features.map((feature) => (
          <Toggle
            key={feature.key}
            enabled={portalFeatures[feature.key]}
            onChange={(v) => updatePortalFeature(feature.key, v)}
            label={feature.label}
            description={feature.description}
          />
        ))}
      </div>
    </Card>
  );
}

// ============================================
// INTEGRATIONS TAB
// ============================================

function IntegrationsTab({ profile, updateField }: TabProps) {
  return (
    <Card>
      <SectionHeader title="Integration Settings" description="Configure e-commerce platform integrations" />

      <div className="space-y-4">
        <Toggle
          enabled={profile.integration_auto_import_orders}
          onChange={(v) => updateField("integration_auto_import_orders", v)}
          label="Auto-Import Orders"
          description="Automatically import orders from connected platforms"
        />
        <Toggle
          enabled={profile.integration_auto_sync_inventory}
          onChange={(v) => updateField("integration_auto_sync_inventory", v)}
          label="Auto-Sync Inventory"
          description="Push inventory levels to connected platforms"
        />
        <Toggle
          enabled={profile.integration_auto_fulfill}
          onChange={(v) => updateField("integration_auto_fulfill", v)}
          label="Auto-Fulfill Orders"
          description="Mark orders as fulfilled in platforms when shipped"
        />
        <Toggle
          enabled={profile.integration_hold_for_review}
          onChange={(v) => updateField("integration_hold_for_review", v)}
          label="Hold Orders for Review"
          description="Imported orders require manual review before processing"
        />
      </div>
    </Card>
  );
}
