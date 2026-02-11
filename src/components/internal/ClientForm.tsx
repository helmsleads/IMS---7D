"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { Client } from "@/lib/api/clients";
import { getServiceTiers } from "@/lib/api/services";
import { getWorkflowProfiles, getAllIndustries } from "@/lib/api/workflow-profiles";
import { ServiceTier, WorkflowProfile, ClientIndustry } from "@/types/database";

export interface ClientFormData {
  company_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip: string;
  active: boolean;
  service_tier_id: string;
  industries: ClientIndustry[];
  workflow_profile_id: string;
}

interface ClientFormProps {
  initialData?: Partial<Client>;
  onSubmit: (data: ClientFormData) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  isEdit?: boolean;
}

export default function ClientForm({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = "Save Client",
}: ClientFormProps) {
  const [formData, setFormData] = useState<ClientFormData>({
    company_name: initialData?.company_name || "",
    address_line1: initialData?.address_line1 || "",
    address_line2: initialData?.address_line2 || "",
    city: initialData?.city || "",
    state: initialData?.state || "",
    zip: initialData?.zip || "",
    active: initialData?.active ?? true,
    service_tier_id: initialData?.service_tier_id || "",
    industries: initialData?.industries || [],
    workflow_profile_id: initialData?.workflow_profile_id || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serviceTiers, setServiceTiers] = useState<ServiceTier[]>([]);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [workflowProfiles, setWorkflowProfiles] = useState<WorkflowProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);

  const industries = getAllIndustries();

  // Group industries by category for display
  const industriesByCategory = industries.reduce((acc, ind) => {
    if (!acc[ind.category]) {
      acc[ind.category] = [];
    }
    acc[ind.category].push(ind);
    return acc;
  }, {} as Record<string, typeof industries>);

  // Filter profiles by selected industries (show profiles that match ANY selected industry)
  const filteredProfiles = workflowProfiles.filter(
    (p) => formData.industries.length === 0 || formData.industries.includes(p.industry as ClientIndustry)
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tiers, profiles] = await Promise.all([
          getServiceTiers(),
          getWorkflowProfiles(),
        ]);
        setServiceTiers(tiers.filter((t) => t.status === "active"));
        setWorkflowProfiles(profiles);
      } catch (error) {
        console.error("Failed to fetch form data:", error);
      } finally {
        setTiersLoading(false);
        setProfilesLoading(false);
      }
    };
    fetchData();
  }, []);

  // When industries change, reset workflow profile if it's not valid for the selected industries
  useEffect(() => {
    if (formData.workflow_profile_id && formData.industries.length > 0) {
      const currentProfile = workflowProfiles.find(
        (p) => p.id === formData.workflow_profile_id
      );
      if (currentProfile && !formData.industries.includes(currentProfile.industry as ClientIndustry)) {
        // Find a default profile for the selected industries
        const defaultProfile = workflowProfiles.find(
          (p) => formData.industries.includes(p.industry as ClientIndustry)
        );
        setFormData((prev) => ({
          ...prev,
          workflow_profile_id: defaultProfile?.id || "",
        }));
      }
    }
  }, [formData.industries, formData.workflow_profile_id, workflowProfiles]);

  const handleChange = (field: keyof ClientFormData, value: string | boolean | ClientIndustry[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const toggleIndustry = (industry: ClientIndustry) => {
    const current = formData.industries;
    const updated = current.includes(industry)
      ? current.filter((i) => i !== industry)
      : [...current, industry];
    handleChange("industries", updated);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.company_name.trim()) {
      newErrors.company_name = "Company name is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error("Form submission failed:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Company Info */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Company Info
        </h2>
        <div className="space-y-4">
          <Input
            label="Company Name"
            name="company_name"
            value={formData.company_name}
            onChange={(e) => handleChange("company_name", e.target.value)}
            error={errors.company_name}
            required
            placeholder="e.g., Acme Corporation"
          />
          <p className="text-sm text-gray-500">
            Contacts for this company are managed in the &quot;Users&quot; tab after creation.
          </p>
        </div>
      </Card>

      {/* Shipping Address */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Shipping Address
        </h2>
        <div className="space-y-4">
          <Input
            label="Address Line 1"
            name="address_line1"
            value={formData.address_line1}
            onChange={(e) => handleChange("address_line1", e.target.value)}
            placeholder="Street address"
          />
          <Input
            label="Address Line 2"
            name="address_line2"
            value={formData.address_line2}
            onChange={(e) => handleChange("address_line2", e.target.value)}
            placeholder="Apt, suite, unit, etc. (optional)"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="City"
              name="city"
              value={formData.city}
              onChange={(e) => handleChange("city", e.target.value)}
              placeholder="City"
            />
            <Input
              label="State"
              name="state"
              value={formData.state}
              onChange={(e) => handleChange("state", e.target.value)}
              placeholder="State"
            />
            <Input
              label="ZIP Code"
              name="zip"
              value={formData.zip}
              onChange={(e) => handleChange("zip", e.target.value)}
              placeholder="ZIP"
            />
          </div>
        </div>
      </Card>

      {/* Industry & Workflow */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Industries & Workflow
        </h2>

        {/* Industries Multi-Select */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Product Types <span className="text-gray-400 font-normal">(select all that apply)</span>
          </label>
          <div className="space-y-4">
            {Object.entries(industriesByCategory).map(([category, categoryIndustries]) => (
              <div key={category}>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  {category}
                </p>
                <div className="flex flex-wrap gap-2">
                  {categoryIndustries.map((ind) => {
                    const isSelected = formData.industries.includes(ind.value);
                    return (
                      <button
                        key={ind.value}
                        type="button"
                        onClick={() => toggleIndustry(ind.value)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {ind.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Select all product types this client handles. This determines compliance requirements.
          </p>
        </div>

        {/* Workflow Profile */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Workflow Profile
          </label>
          <select
            value={formData.workflow_profile_id}
            onChange={(e) => handleChange("workflow_profile_id", e.target.value)}
            disabled={profilesLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
          >
            <option value="">Select a profile</option>
            {filteredProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-gray-500">
            Defines available supplies, container types, and default settings
          </p>
        </div>

        {/* Show selected profile details */}
        {formData.workflow_profile_id && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            {(() => {
              const profile = workflowProfiles.find(
                (p) => p.id === formData.workflow_profile_id
              );
              if (!profile) return null;
              return (
                <div className="space-y-2 text-sm">
                  <p className="text-gray-600">{profile.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.requires_lot_tracking && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        Lot Tracking
                      </span>
                    )}
                    {profile.requires_expiration_dates && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        Expiration Dates
                      </span>
                    )}
                    {profile.requires_age_verification && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                        Age Verification
                      </span>
                    )}
                    {profile.requires_ttb_compliance && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                        TTB Compliance
                      </span>
                    )}
                    {profile.has_state_restrictions && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                        State Restrictions
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500">
                    <span className="font-medium">Container types:</span>{" "}
                    {profile.allowed_container_types.join(", ")}
                  </p>
                </div>
              );
            })()}
          </div>
        )}
      </Card>

      {/* Settings */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Settings
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Service Tier
            </label>
            <select
              value={formData.service_tier_id}
              onChange={(e) => handleChange("service_tier_id", e.target.value)}
              disabled={tiersLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="">No tier selected</option>
              {serviceTiers.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name}
                  {tier.description ? ` - ${tier.description}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-gray-500">
              Assign a service tier to set default pricing for this client
            </p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.active}
              onChange={(e) => handleChange("active", e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-medium text-gray-900">Active</span>
              <p className="text-sm text-gray-500">
                Inactive clients won&apos;t appear in dropdowns for new orders
              </p>
            </div>
          </label>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          loading={submitting}
          disabled={submitting}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
