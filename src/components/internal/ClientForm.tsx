"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { Client } from "@/lib/api/clients";

export interface ClientFormData {
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip: string;
  active: boolean;
  enable_portal: boolean;
  initial_password: string;
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
  isEdit = false,
}: ClientFormProps) {
  const hasPortalAccess = !!initialData?.auth_id;

  const [formData, setFormData] = useState<ClientFormData>({
    company_name: initialData?.company_name || "",
    contact_name: initialData?.contact_name || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    address_line1: initialData?.address_line1 || "",
    address_line2: initialData?.address_line2 || "",
    city: initialData?.city || "",
    state: initialData?.state || "",
    zip: initialData?.zip || "",
    active: initialData?.active ?? true,
    enable_portal: hasPortalAccess,
    initial_password: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field: keyof ClientFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.company_name.trim()) {
      newErrors.company_name = "Company name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    // Validate password if enabling portal for first time
    if (formData.enable_portal && !hasPortalAccess) {
      if (!formData.initial_password.trim()) {
        newErrors.initial_password = "Initial password is required";
      } else if (formData.initial_password.length < 8) {
        newErrors.initial_password = "Password must be at least 8 characters";
      }
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Company Name"
            name="company_name"
            value={formData.company_name}
            onChange={(e) => handleChange("company_name", e.target.value)}
            error={errors.company_name}
            required
            placeholder="e.g., Acme Corporation"
          />
          <Input
            label="Contact Name"
            name="contact_name"
            value={formData.contact_name}
            onChange={(e) => handleChange("contact_name", e.target.value)}
            placeholder="Primary contact person"
          />
          <Input
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            error={errors.email}
            required
            placeholder="contact@company.com"
          />
          <Input
            label="Phone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            placeholder="(555) 123-4567"
          />
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

      {/* Portal Access */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Portal Access
        </h2>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.enable_portal}
              onChange={(e) => handleChange("enable_portal", e.target.checked)}
              disabled={hasPortalAccess}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
            />
            <div>
              <span className="font-medium text-gray-900">Enable Portal Access</span>
              <p className="text-sm text-gray-500">
                Allow this client to log in and view their inventory and orders
              </p>
            </div>
          </label>

          {hasPortalAccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800">
                Portal access is enabled. Client can log in using their email address.
              </p>
            </div>
          )}

          {formData.enable_portal && !hasPortalAccess && (
            <div className="space-y-3 pl-8">
              <Input
                label="Initial Password"
                name="initial_password"
                type="password"
                value={formData.initial_password}
                onChange={(e) => handleChange("initial_password", e.target.value)}
                error={errors.initial_password}
                required
                placeholder="Minimum 8 characters"
              />
              <p className="text-sm text-gray-500">
                Client will receive an email with instructions to set up their account.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Settings */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Settings
        </h2>
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
