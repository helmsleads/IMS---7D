"use client";

import { useState, useMemo } from "react";
import {
  Truck,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Wine,
  Download,
  ArrowRight,
  RotateCcw,
  Loader2,
} from "lucide-react";
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

const FEDEX_SERVICE_OPTIONS = [
  { value: "FEDEX_GROUND", label: "FedEx Ground (3-5 days)" },
  { value: "FEDEX_EXPRESS_SAVER", label: "FedEx Express Saver (3 days)" },
  { value: "FEDEX_2_DAY", label: "FedEx 2Day" },
  { value: "PRIORITY_OVERNIGHT", label: "FedEx Priority Overnight" },
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

export interface ShipToAddress {
  name?: string;
  company?: string;
  address?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
}

interface ShippingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ShippingData) => Promise<void>;
  orderNumber?: string;
  initialCarrier?: string;
  initialTrackingNumber?: string;
  // FedEx alcohol integration props
  isAlcoholOrder?: boolean;
  fedexConfigured?: boolean;
  orderId?: string;
  shipToAddress?: ShipToAddress;
}

export interface ShippingData {
  carrier: string;
  trackingNumber: string;
  shipDate: string;
  notes?: string;
  // Extended fields from FedEx API flow
  labelUrl?: string;
  fedexShipmentId?: string;
}

type FedExFlowState = "idle" | "creating" | "success" | "error";

export default function ShippingModal({
  isOpen,
  onClose,
  onSubmit,
  orderNumber,
  initialCarrier = "",
  initialTrackingNumber = "",
  isAlcoholOrder,
  fedexConfigured,
  orderId,
  shipToAddress,
}: ShippingModalProps) {
  // Mode: "fedex" (API) or "manual"
  const defaultMode = isAlcoholOrder && fedexConfigured ? "fedex" : "manual";
  const [mode, setMode] = useState<"fedex" | "manual">(defaultMode);

  // Manual mode state
  const [carrier, setCarrier] = useState(initialCarrier);
  const [customCarrier, setCustomCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState(initialTrackingNumber);
  const [shipDate, setShipDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // FedEx mode state
  const [fedexService, setFedexService] = useState("FEDEX_GROUND");
  const [packageWeight, setPackageWeight] = useState<number>(1);
  const [packageLength, setPackageLength] = useState<number | "">("");
  const [packageWidth, setPackageWidth] = useState<number | "">("");
  const [packageHeight, setPackageHeight] = useState<number | "">("");
  const [fedexFlowState, setFedexFlowState] = useState<FedExFlowState>("idle");
  const [fedexResult, setFedexResult] = useState<{
    trackingNumber: string;
    labelUrl: string | null;
    shipmentId: string;
  } | null>(null);
  const [fedexError, setFedexError] = useState("");

  // Tracking URL and validation (manual mode)
  const finalCarrier = carrier === "Other" ? customCarrier : carrier;
  const trackingUrl = useMemo(
    () => getTrackingUrl(finalCarrier, trackingNumber),
    [finalCarrier, trackingNumber]
  );
  const trackingValidation = useMemo(
    () => validateTrackingNumber(finalCarrier, trackingNumber),
    [finalCarrier, trackingNumber]
  );

  // ── Manual submit ─────────────────────────────
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    const fc = carrier === "Other" ? customCarrier : carrier;

    if (!fc) newErrors.carrier = "Carrier is required";
    if (!trackingNumber.trim()) newErrors.trackingNumber = "Tracking number is required";
    if (!shipDate) newErrors.shipDate = "Ship date is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        carrier: fc,
        trackingNumber: trackingNumber.trim(),
        shipDate,
        notes: notes.trim() || undefined,
      });
      resetForm();
    } catch (error) {
      console.error("Failed to submit shipping info:", error);
    } finally {
      setSubmitting(false);
    }
  };

  // ── FedEx create shipment ─────────────────────
  const handleFedExCreate = async () => {
    if (!orderId || packageWeight <= 0) return;

    setFedexFlowState("creating");
    setFedexError("");

    try {
      const res = await fetch("/api/shipping/fedex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          serviceType: fedexService,
          packageWeight,
          packageLength: packageLength || undefined,
          packageWidth: packageWidth || undefined,
          packageHeight: packageHeight || undefined,
          isAlcohol: isAlcoholOrder ?? false,
          shipDate,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFedexFlowState("error");
        setFedexError(data.error || "Failed to create FedEx shipment");
        return;
      }

      setFedexResult(data);
      setFedexFlowState("success");
    } catch (err) {
      setFedexFlowState("error");
      setFedexError(err instanceof Error ? err.message : "Network error");
    }
  };

  // ── FedEx complete (auto-fill tracking → onSubmit) ──
  const handleFedExComplete = async () => {
    if (!fedexResult) return;

    setSubmitting(true);
    try {
      await onSubmit({
        carrier: "FedEx",
        trackingNumber: fedexResult.trackingNumber,
        shipDate,
        notes: notes.trim() || undefined,
        labelUrl: fedexResult.labelUrl || undefined,
        fedexShipmentId: fedexResult.shipmentId,
      });
      resetForm();
    } catch (error) {
      console.error("Failed to complete FedEx shipment:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadLabel = () => {
    if (!fedexResult?.labelUrl) return;
    // Generate a signed URL for the label
    window.open(`/api/shipping/fedex/label?path=${encodeURIComponent(fedexResult.labelUrl)}`, "_blank");
  };

  const resetForm = () => {
    setCarrier("");
    setCustomCarrier("");
    setTrackingNumber("");
    setShipDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setErrors({});
    setFedexFlowState("idle");
    setFedexResult(null);
    setFedexError("");
    setPackageWeight(1);
    setPackageLength("");
    setPackageWidth("");
    setPackageHeight("");
  };

  const handleClose = () => {
    if (!submitting && fedexFlowState !== "creating") {
      setErrors({});
      onClose();
    }
  };

  // ── Render ────────────────────────────────────
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Ship Order"
      size="md"
    >
      <div className="space-y-4">
        {orderNumber && (
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-500">Order</p>
            <p className="font-semibold text-gray-900">{orderNumber}</p>
          </div>
        )}

        {/* Alcohol warning banners */}
        {isAlcoholOrder && fedexConfigured && mode === "fedex" && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-start gap-2.5">
            <Wine className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-purple-800">Alcohol Shipment</p>
              <p className="text-purple-600 mt-0.5">
                This order requires adult signature. FedEx alcohol-licensed account will be used.
              </p>
            </div>
          </div>
        )}

        {isAlcoholOrder && !fedexConfigured && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">Alcohol Order — FedEx Not Configured</p>
              <p className="text-amber-600 mt-0.5">
                FedEx API integration is not set up. Go to Settings &rarr; System to configure FedEx credentials for automatic alcohol shipping.
              </p>
            </div>
          </div>
        )}

        {/* ── FedEx API Mode ─────────────────── */}
        {mode === "fedex" && (
          <>
            {/* Ship-to address summary */}
            {shipToAddress && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Ship To</p>
                <p className="text-sm font-medium text-gray-900">
                  {shipToAddress.name}
                  {shipToAddress.company && ` — ${shipToAddress.company}`}
                </p>
                <p className="text-sm text-gray-600">
                  {shipToAddress.address}
                  {shipToAddress.address2 && `, ${shipToAddress.address2}`}
                </p>
                <p className="text-sm text-gray-600">
                  {shipToAddress.city}, {shipToAddress.state} {shipToAddress.zip}
                </p>
              </div>
            )}

            {fedexFlowState === "idle" && (
              <div className="space-y-4">
                <Select
                  label="Service Type"
                  name="fedexService"
                  options={FEDEX_SERVICE_OPTIONS}
                  value={fedexService}
                  onChange={(e) => setFedexService(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Package Weight (lbs)"
                    name="packageWeight"
                    type="number"
                    value={packageWeight}
                    onChange={(e) => setPackageWeight(parseFloat(e.target.value) || 0)}
                    required
                  />
                  <Input
                    label="Ship Date"
                    name="shipDate"
                    type="date"
                    value={shipDate}
                    onChange={(e) => setShipDate(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Input
                    label="Length (in)"
                    name="packageLength"
                    type="number"
                    value={packageLength}
                    onChange={(e) => setPackageLength(e.target.value ? parseFloat(e.target.value) : "")}
                  />
                  <Input
                    label="Width (in)"
                    name="packageWidth"
                    type="number"
                    value={packageWidth}
                    onChange={(e) => setPackageWidth(e.target.value ? parseFloat(e.target.value) : "")}
                  />
                  <Input
                    label="Height (in)"
                    name="packageHeight"
                    type="number"
                    value={packageHeight}
                    onChange={(e) => setPackageHeight(e.target.value ? parseFloat(e.target.value) : "")}
                  />
                </div>

                {/* Adult signature forced for alcohol */}
                {isAlcoholOrder && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-700">Adult Signature Required</span>
                    <span className="text-xs text-purple-500 ml-auto">Enforced for alcohol</span>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
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
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleFedExCreate}
                    disabled={packageWeight <= 0}
                    className="flex-1"
                  >
                    <Truck className="w-4 h-4 mr-2" />
                    Create FedEx Shipment
                  </Button>
                </div>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setMode("manual")}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    Switch to Manual Entry
                  </button>
                </div>
              </div>
            )}

            {fedexFlowState === "creating" && (
              <div className="py-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">Creating FedEx shipment...</p>
                <p className="text-xs text-gray-500 mt-1">This may take a few seconds</p>
              </div>
            )}

            {fedexFlowState === "success" && fedexResult && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-800">Shipment Created</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Tracking Number</p>
                      <p className="font-mono font-medium text-gray-900">{fedexResult.trackingNumber}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Shipment ID</p>
                      <p className="font-mono text-gray-700 text-xs">{fedexResult.shipmentId}</p>
                    </div>
                  </div>
                </div>

                {fedexResult.labelUrl && (
                  <button
                    type="button"
                    onClick={handleDownloadLabel}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-100 transition-colors text-sm font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Download Shipping Label (PDF)
                  </button>
                )}

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
                    type="button"
                    onClick={handleFedExComplete}
                    loading={submitting}
                    disabled={submitting}
                    className="flex-1"
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Complete Shipment
                  </Button>
                </div>
              </div>
            )}

            {fedexFlowState === "error" && (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="font-semibold text-red-800">Shipment Failed</span>
                  </div>
                  <p className="text-sm text-red-700">{fedexError}</p>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setMode("manual")}
                    className="flex-1"
                  >
                    Manual Entry
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setFedexFlowState("idle");
                      setFedexError("");
                    }}
                    className="flex-1"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Manual Mode ────────────────────── */}
        {mode === "manual" && (
          <form onSubmit={handleManualSubmit} className="space-y-4">
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

            {/* Switch back to FedEx if available */}
            {isAlcoholOrder && fedexConfigured && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setMode("fedex")}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Switch to FedEx API
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </Modal>
  );
}
