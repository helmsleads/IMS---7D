"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  DollarSign,
  Settings,
  Edit,
  Plus,
  Trash2,
  Copy,
  Save,
  X,
  Calculator,
} from "lucide-react";
import Link from "next/link";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";
import Alert from "@/components/ui/Alert";
import Modal from "@/components/ui/Modal";
import FetchError from "@/components/ui/FetchError";
import { getClient, Client } from "@/lib/api/clients";
import {
  getClientBillingConfig,
  upsertClientBillingConfig,
  getClientRateCards,
  createClientRateCard,
  updateClientRateCard,
  deleteClientRateCard,
  getDefaultRateTemplates,
  getTemplateNames,
  copyDefaultRatesToClient,
  ClientBillingConfig,
  ClientRateCard,
  RateCategory,
} from "@/lib/api/billing-automation";
import { handleApiError } from "@/lib/utils/error-handler";

const RATE_CATEGORIES: { value: RateCategory; label: string }[] = [
  { value: "storage", label: "Storage" },
  { value: "inbound", label: "Inbound/Receiving" },
  { value: "outbound", label: "Outbound/Shipping" },
  { value: "pick", label: "Picking" },
  { value: "pack", label: "Packing" },
  { value: "special", label: "Special Services" },
  { value: "return", label: "Returns" },
  { value: "supply", label: "Supplies" },
];

const BILLING_FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
];

const PRICE_UNITS = [
  { value: "each", label: "Each/Unit" },
  { value: "pallet", label: "Pallet" },
  { value: "case", label: "Case" },
  { value: "cubic_ft", label: "Cubic Foot" },
  { value: "sq_ft", label: "Square Foot" },
  { value: "lb", label: "Pound" },
  { value: "order", label: "Order" },
  { value: "month", label: "Month" },
  { value: "percent", label: "Percent" },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
};

type TabType = "config" | "rates";

export default function ClientBillingPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [billingConfig, setBillingConfig] = useState<ClientBillingConfig | null>(null);
  const [rateCards, setRateCards] = useState<ClientRateCard[]>([]);
  const [templateNames, setTemplateNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("config");

  // Config form state
  const [configForm, setConfigForm] = useState({
    billing_frequency: "monthly" as "weekly" | "biweekly" | "monthly",
    billing_day_of_month: 1,
    payment_terms_days: 30,
    late_fee_percent: 0,
    monthly_minimum: 0,
    tax_rate: 0,
    tax_exempt: false,
    auto_generate_invoices: true,
    auto_send_invoices: false,
    billing_email: "",
    billing_contact_name: "",
    notes: "",
  });

  // Rate editing state
  const [editingRate, setEditingRate] = useState<ClientRateCard | null>(null);
  const [showAddRate, setShowAddRate] = useState(false);
  const [showCopyTemplates, setShowCopyTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("Standard");
  const [selectedCategory, setSelectedCategory] = useState<RateCategory | "all">("all");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [clientData, configData, ratesData, templatesData] = await Promise.all([
        getClient(clientId),
        getClientBillingConfig(clientId),
        getClientRateCards(clientId),
        getTemplateNames(),
      ]);

      setClient(clientData);
      setBillingConfig(configData);
      setRateCards(ratesData);
      setTemplateNames(templatesData);

      // Initialize form with existing config
      if (configData) {
        setConfigForm({
          billing_frequency: configData.billing_frequency,
          billing_day_of_month: configData.billing_day_of_month,
          payment_terms_days: configData.payment_terms_days,
          late_fee_percent: configData.late_fee_percent,
          monthly_minimum: configData.monthly_minimum,
          tax_rate: configData.tax_rate,
          tax_exempt: configData.tax_exempt,
          auto_generate_invoices: configData.auto_generate_invoices,
          auto_send_invoices: configData.auto_send_invoices,
          billing_email: configData.billing_email || "",
          billing_contact_name: configData.billing_contact_name || "",
          notes: configData.notes || "",
        });
      }
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [clientId]);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await upsertClientBillingConfig(clientId, {
        ...configForm,
        billing_email: configForm.billing_email || null,
        billing_contact_name: configForm.billing_contact_name || null,
        notes: configForm.notes || null,
      });
      setSuccessMessage("Billing configuration saved successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
      await fetchData();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleCopyTemplates = async () => {
    setSaving(true);
    try {
      const count = await copyDefaultRatesToClient(clientId, selectedTemplate);
      setShowCopyTemplates(false);
      setSuccessMessage(`${count} rates copied from ${selectedTemplate} template`);
      setTimeout(() => setSuccessMessage(""), 3000);
      await fetchData();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRate = async (rate: Partial<ClientRateCard>) => {
    setSaving(true);
    try {
      if (editingRate?.id) {
        await updateClientRateCard(editingRate.id, rate);
        setSuccessMessage("Rate updated successfully");
      } else {
        await createClientRateCard({
          ...rate,
          client_id: clientId,
        } as ClientRateCard);
        setSuccessMessage("Rate created successfully");
      }
      setEditingRate(null);
      setShowAddRate(false);
      setTimeout(() => setSuccessMessage(""), 3000);
      await fetchData();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRate = async (rateId: string) => {
    if (!confirm("Are you sure you want to delete this rate?")) return;

    try {
      await deleteClientRateCard(rateId);
      setSuccessMessage("Rate deleted successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
      await fetchData();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const filteredRates = useMemo(() => {
    if (selectedCategory === "all") return rateCards;
    return rateCards.filter((rate) => rate.rate_category === selectedCategory);
  }, [rateCards, selectedCategory]);

  const ratesByCategory = useMemo(() => {
    const grouped: Record<RateCategory, ClientRateCard[]> = {
      storage: [],
      inbound: [],
      outbound: [],
      pick: [],
      pack: [],
      special: [],
      return: [],
      supply: [],
    };

    for (const rate of filteredRates) {
      if (grouped[rate.rate_category]) {
        grouped[rate.rate_category].push(rate);
      }
    }

    return grouped;
  }, [filteredRates]);

  if (loading) {
    return (
      <AppShell title="Client Billing" subtitle="Loading...">
        <Card>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </Card>
      </AppShell>
    );
  }

  if (error && !client) {
    return (
      <AppShell title="Client Billing" subtitle="Error loading client">
        <FetchError message={error} onRetry={fetchData} />
      </AppShell>
    );
  }

  const backLink = (
    <Link
      href={`/clients/${clientId}`}
      className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to Client
    </Link>
  );

  return (
    <AppShell
      title={`Billing Settings - ${client?.company_name || "Client"}`}
      subtitle="Configure billing rates and automation"
      actions={backLink}
    >
      {successMessage && (
        <div className="mb-4">
          <Alert
            type="success"
            message={successMessage}
            onClose={() => setSuccessMessage("")}
          />
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Alert type="error" message={error} onClose={() => setError(null)} />
        </div>
      )}

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("config")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2
              ${
                activeTab === "config"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            <Settings className="w-4 h-4" />
            Billing Configuration
          </button>
          <button
            onClick={() => setActiveTab("rates")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2
              ${
                activeTab === "rates"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            <DollarSign className="w-4 h-4" />
            Rate Cards ({rateCards.length})
          </button>
        </nav>
      </div>

      {/* Billing Configuration Tab */}
      {activeTab === "config" && (
        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Billing Cycle Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Select
                label="Billing Frequency"
                name="billing_frequency"
                options={BILLING_FREQUENCIES}
                value={configForm.billing_frequency}
                onChange={(e) =>
                  setConfigForm({
                    ...configForm,
                    billing_frequency: e.target.value as "weekly" | "biweekly" | "monthly",
                  })
                }
              />
              <Input
                label="Billing Day of Month"
                name="billing_day_of_month"
                type="number"
                min={1}
                max={28}
                value={configForm.billing_day_of_month}
                onChange={(e) =>
                  setConfigForm({
                    ...configForm,
                    billing_day_of_month: parseInt(e.target.value) || 1,
                  })
                }
                hint="Day of the month to generate invoices (1-28)"
              />
              <Input
                label="Payment Terms (Days)"
                name="payment_terms_days"
                type="number"
                min={0}
                value={configForm.payment_terms_days}
                onChange={(e) =>
                  setConfigForm({
                    ...configForm,
                    payment_terms_days: parseInt(e.target.value) || 30,
                  })
                }
                hint="Net days for payment due"
              />
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Fees & Minimums
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Input
                label="Monthly Minimum"
                name="monthly_minimum"
                type="number"
                min={0}
                step={0.01}
                value={configForm.monthly_minimum}
                onChange={(e) =>
                  setConfigForm({
                    ...configForm,
                    monthly_minimum: parseFloat(e.target.value) || 0,
                  })
                }
                hint="Minimum monthly billing amount"
              />
              <Input
                label="Late Fee (%)"
                name="late_fee_percent"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={configForm.late_fee_percent}
                onChange={(e) =>
                  setConfigForm({
                    ...configForm,
                    late_fee_percent: parseFloat(e.target.value) || 0,
                  })
                }
                hint="Percentage late fee for overdue invoices"
              />
              <div className="space-y-2">
                <Input
                  label="Tax Rate (%)"
                  name="tax_rate"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={configForm.tax_rate}
                  onChange={(e) =>
                    setConfigForm({
                      ...configForm,
                      tax_rate: parseFloat(e.target.value) || 0,
                    })
                  }
                  disabled={configForm.tax_exempt}
                />
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="tax_exempt"
                    checked={configForm.tax_exempt}
                    onChange={(e) =>
                      setConfigForm({
                        ...configForm,
                        tax_exempt: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="tax_exempt" className="text-sm text-gray-700">
                    Tax Exempt
                  </label>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Automation Settings
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto_generate"
                  checked={configForm.auto_generate_invoices}
                  onChange={(e) =>
                    setConfigForm({
                      ...configForm,
                      auto_generate_invoices: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="auto_generate" className="text-sm text-gray-700">
                  Automatically generate invoices on billing day
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto_send"
                  checked={configForm.auto_send_invoices}
                  onChange={(e) =>
                    setConfigForm({
                      ...configForm,
                      auto_send_invoices: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="auto_send" className="text-sm text-gray-700">
                  Automatically send invoices after generation
                </label>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Billing Contact
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Billing Contact Name"
                name="billing_contact_name"
                value={configForm.billing_contact_name}
                onChange={(e) =>
                  setConfigForm({
                    ...configForm,
                    billing_contact_name: e.target.value,
                  })
                }
                placeholder="Name for billing inquiries"
              />
              <Input
                label="Billing Email"
                name="billing_email"
                type="email"
                value={configForm.billing_email}
                onChange={(e) =>
                  setConfigForm({
                    ...configForm,
                    billing_email: e.target.value,
                  })
                }
                placeholder="Email for invoice delivery"
              />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={configForm.notes}
                onChange={(e) =>
                  setConfigForm({
                    ...configForm,
                    notes: e.target.value,
                  })
                }
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Internal notes about this client's billing..."
              />
            </div>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveConfig} loading={saving} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              Save Configuration
            </Button>
          </div>
        </div>
      )}

      {/* Rate Cards Tab */}
      {activeTab === "rates" && (
        <div className="space-y-6">
          {/* Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Select
                name="category_filter"
                value={selectedCategory}
                onChange={(e) =>
                  setSelectedCategory(e.target.value as RateCategory | "all")
                }
                options={[
                  { value: "all", label: "All Categories" },
                  ...RATE_CATEGORIES,
                ]}
              />
              <span className="text-sm text-gray-500">
                {filteredRates.length} rate{filteredRates.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {rateCards.length === 0 && (
                <Button
                  variant="secondary"
                  onClick={() => setShowCopyTemplates(true)}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy from Template
                </Button>
              )}
              <Button onClick={() => setShowAddRate(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Rate
              </Button>
            </div>
          </div>

          {/* Rate Cards by Category */}
          {filteredRates.length === 0 ? (
            <Card>
              <div className="text-center py-8">
                <Calculator className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No rates configured
                </h3>
                <p className="text-gray-500 mb-4">
                  {rateCards.length === 0
                    ? "Copy rates from a template to get started quickly, or add custom rates."
                    : "No rates match the selected category."}
                </p>
                {rateCards.length === 0 && (
                  <div className="flex justify-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setShowCopyTemplates(true)}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy from Template
                    </Button>
                    <Button onClick={() => setShowAddRate(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Custom Rate
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            Object.entries(ratesByCategory).map(([category, rates]) => {
              if (rates.length === 0) return null;
              const categoryInfo = RATE_CATEGORIES.find(
                (c) => c.value === category
              );
              return (
                <Card key={category}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {categoryInfo?.label || category}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Rate Name
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Code
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Unit Price
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Unit
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                            Status
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {rates.map((rate) => (
                          <tr key={rate.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">
                                {rate.rate_name}
                              </div>
                              {rate.description && (
                                <div className="text-sm text-gray-500">
                                  {rate.description}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm font-mono text-gray-600">
                              {rate.rate_code}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-medium text-gray-900">
                                {formatCurrency(rate.unit_price)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {PRICE_UNITS.find((u) => u.value === rate.price_unit)
                                ?.label || rate.price_unit}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Badge
                                variant={rate.is_active ? "success" : "default"}
                              >
                                {rate.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-1">
                                <button
                                  onClick={() => setEditingRate(rate)}
                                  className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteRate(rate.id)}
                                  className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Copy Templates Modal */}
      <Modal
        isOpen={showCopyTemplates}
        onClose={() => setShowCopyTemplates(false)}
        title="Copy Rates from Template"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Select a rate template to copy default rates to this client. You can
            customize the rates after copying.
          </p>
          <Select
            label="Template"
            name="template"
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            options={templateNames.map((name) => ({
              value: name,
              label: name,
            }))}
          />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => setShowCopyTemplates(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCopyTemplates} loading={saving}>
              <Copy className="w-4 h-4 mr-2" />
              Copy Rates
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add/Edit Rate Modal */}
      <Modal
        isOpen={showAddRate || !!editingRate}
        onClose={() => {
          setShowAddRate(false);
          setEditingRate(null);
        }}
        title={editingRate ? "Edit Rate" : "Add New Rate"}
        size="md"
      >
        <RateForm
          rate={editingRate}
          onSave={handleSaveRate}
          onCancel={() => {
            setShowAddRate(false);
            setEditingRate(null);
          }}
          saving={saving}
        />
      </Modal>
    </AppShell>
  );
}

interface RateFormProps {
  rate: ClientRateCard | null;
  onSave: (rate: Partial<ClientRateCard>) => void;
  onCancel: () => void;
  saving: boolean;
}

function RateForm({ rate, onSave, onCancel, saving }: RateFormProps) {
  const [form, setForm] = useState({
    rate_category: (rate?.rate_category || "storage") as RateCategory,
    rate_code: rate?.rate_code || "",
    rate_name: rate?.rate_name || "",
    description: rate?.description || "",
    unit_price: rate?.unit_price || 0,
    price_unit: rate?.price_unit || "each",
    minimum_charge: rate?.minimum_charge || 0,
    is_active: rate?.is_active ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      description: form.description || null,
      volume_tiers: [],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Category"
          name="rate_category"
          value={form.rate_category}
          onChange={(e) =>
            setForm({ ...form, rate_category: e.target.value as RateCategory })
          }
          options={RATE_CATEGORIES}
          required
          disabled={!!rate}
        />
        <Input
          label="Rate Code"
          name="rate_code"
          value={form.rate_code}
          onChange={(e) =>
            setForm({
              ...form,
              rate_code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
            })
          }
          required
          disabled={!!rate}
          placeholder="e.g., STORAGE_PALLET"
          hint="Unique identifier for this rate"
        />
      </div>

      <Input
        label="Rate Name"
        name="rate_name"
        value={form.rate_name}
        onChange={(e) => setForm({ ...form, rate_name: e.target.value })}
        required
        placeholder="e.g., Pallet Storage (Monthly)"
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Brief description of this rate..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Unit Price"
          name="unit_price"
          type="number"
          min={0}
          step={0.0001}
          value={form.unit_price}
          onChange={(e) =>
            setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })
          }
          required
        />
        <Select
          label="Price Unit"
          name="price_unit"
          value={form.price_unit}
          onChange={(e) => setForm({ ...form, price_unit: e.target.value })}
          options={PRICE_UNITS}
          required
        />
      </div>

      <Input
        label="Minimum Charge"
        name="minimum_charge"
        type="number"
        min={0}
        step={0.01}
        value={form.minimum_charge}
        onChange={(e) =>
          setForm({ ...form, minimum_charge: parseFloat(e.target.value) || 0 })
        }
        hint="Minimum charge for this rate (0 = no minimum)"
      />

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_active"
          checked={form.is_active}
          onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="is_active" className="text-sm text-gray-700">
          Rate is active
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {rate ? "Update Rate" : "Create Rate"}
        </Button>
      </div>
    </form>
  );
}
