"use client";

import { useState, useMemo } from "react";
import { Truck, ExternalLink, AlertCircle, CheckCircle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

const CARRIER_OPTIONS = [
  { value: "UPS", label: "UPS" },
  { value: "FedEx", label: "FedEx" },
  { value: "USPS", label: "USPS" },
  { value: "DHL", label: "DHL" },
  { value: "Other", label: "Other" },
];

// Tracking URL generators for each carrier
const TRACKING_URLS: Record<string, (tracking: string) => string> = {
  UPS: (t) => `https://www.ups.com/track?tracknum=${t}`,
  FedEx: (t) => `https://www.fedex.com/fedextrack/?trknbr=${t}`,
  USPS: (t) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`,
  DHL: (t) => `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${t}`,
};

// Tracking number validation patterns
const TRACKING_PATTERNS: Record<string, { pattern: RegExp; hint: string }> = {
  UPS: {
    pattern: /^1Z[A-Z0-9]{16}$/i,
    hint: "UPS tracking numbers start with 1Z followed by 16 characters (e.g., 1Z999AA10123456784)",
  },
  FedEx: {
    pattern: /^(\d{12}|\d{15}|\d{20}|\d{22})$/,
    hint: "FedEx tracking numbers are 12, 15, 20, or 22 digits",
  },
  USPS: {
    pattern: /^(94|93|92|91|94|70|14|23|03|01)\d{18,22}$/,
    hint: "USPS tracking numbers are 20-22 digits starting with 94, 93, 92, etc.",
  },
  DHL: {
    pattern: /^\d{10,11}$/,
    hint: "DHL tracking numbers are typically 10-11 digits",
  },
};

function getTrackingUrl(carrier: string, trackingNumber: string): string | null {
  const generator = TRACKING_URLS[carrier];
  if (generator && trackingNumber) {
    return generator(trackingNumber);
  }
  return null;
}

function validateTrackingNumber(carrier: string, trackingNumber: string): { valid: boolean; hint?: string } {
  const validation = TRACKING_PATTERNS[carrier];
  if (!validation) {
    return { valid: true }; // No validation for unknown carriers
  }

  const cleanTracking = trackingNumber.replace(/\s/g, "").toUpperCase();
  if (validation.pattern.test(cleanTracking)) {
    return { valid: true };
  }
  return { valid: false, hint: validation.hint };
}

interface ShippingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ShippingData) => Promise<void>;
  orderNumber?: string;
  initialCarrier?: string;
  initialTrackingNumber?: string;
}

export interface ShippingData {
  carrier: string;
  trackingNumber: string;
  shipDate: string;
  notes?: string;
}

export default function ShippingModal({
  isOpen,
  onClose,
  onSubmit,
  orderNumber,
  initialCarrier = "",
  initialTrackingNumber = "",
}: ShippingModalProps) {
  const [carrier, setCarrier] = useState(initialCarrier);
  const [customCarrier, setCustomCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState(initialTrackingNumber);
  const [shipDate, setShipDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Tracking URL and validation
  const finalCarrier = carrier === "Other" ? customCarrier : carrier;
  const trackingUrl = useMemo(
    () => getTrackingUrl(finalCarrier, trackingNumber),
    [finalCarrier, trackingNumber]
  );
  const trackingValidation = useMemo(
    () => validateTrackingNumber(finalCarrier, trackingNumber),
    [finalCarrier, trackingNumber]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const newErrors: Record<string, string> = {};
    const finalCarrier = carrier === "Other" ? customCarrier : carrier;

    if (!finalCarrier) {
      newErrors.carrier = "Carrier is required";
    }
    if (!trackingNumber.trim()) {
      newErrors.trackingNumber = "Tracking number is required";
    }
    if (!shipDate) {
      newErrors.shipDate = "Ship date is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        carrier: finalCarrier,
        trackingNumber: trackingNumber.trim(),
        shipDate,
        notes: notes.trim() || undefined,
      });
      // Reset form on success
      setCarrier("");
      setCustomCarrier("");
      setTrackingNumber("");
      setShipDate(new Date().toISOString().split("T")[0]);
      setNotes("");
      setErrors({});
    } catch (error) {
      console.error("Failed to submit shipping info:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setErrors({});
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Ship Order"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {orderNumber && (
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-sm text-gray-500">Order</p>
            <p className="font-semibold text-gray-900">{orderNumber}</p>
          </div>
        )}

        <Select
          label="Carrier"
          name="carrier"
          options={CARRIER_OPTIONS}
          value={carrier}
          onChange={(e) => {
            setCarrier(e.target.value);
            if (e.target.value !== "Other") {
              setCustomCarrier("");
            }
            setErrors({ ...errors, carrier: "" });
          }}
          placeholder="Select carrier"
          error={errors.carrier}
          required
        />

        {carrier === "Other" && (
          <Input
            label="Carrier Name"
            name="customCarrier"
            value={customCarrier}
            onChange={(e) => {
              setCustomCarrier(e.target.value);
              setErrors({ ...errors, carrier: "" });
            }}
            placeholder="Enter carrier name"
            error={errors.carrier}
            required
          />
        )}

        <div>
          <Input
            label="Tracking Number"
            name="trackingNumber"
            value={trackingNumber}
            onChange={(e) => {
              setTrackingNumber(e.target.value);
              setErrors({ ...errors, trackingNumber: "" });
            }}
            placeholder="Enter tracking number"
            error={errors.trackingNumber}
            required
          />
          {/* Validation hint */}
          {trackingNumber && finalCarrier && finalCarrier !== "Other" && (
            <div className={`mt-1.5 flex items-start gap-1.5 text-xs ${
              trackingValidation.valid ? "text-green-600" : "text-amber-600"
            }`}>
              {trackingValidation.valid ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>Valid {finalCarrier} tracking number format</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{trackingValidation.hint}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Tracking URL Preview */}
        {trackingUrl && trackingNumber && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs font-medium text-blue-700 mb-1">
              Tracking Link Preview
            </p>
            <a
              href={trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Track on {finalCarrier}
            </a>
          </div>
        )}

        <Input
          label="Ship Date"
          name="shipDate"
          type="date"
          value={shipDate}
          onChange={(e) => {
            setShipDate(e.target.value);
            setErrors({ ...errors, shipDate: "" });
          }}
          error={errors.shipDate}
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Any additional shipping notes..."
          />
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={submitting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={submitting}
            disabled={submitting}
            className="flex-1"
          >
            <Truck className="w-4 h-4 mr-2" />
            Ship Order
          </Button>
        </div>
      </form>
    </Modal>
  );
}
