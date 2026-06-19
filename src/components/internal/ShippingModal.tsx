"use client";

import { useState, useMemo, useEffect } from "react";
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
  PackageCheck,
  Info,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

const MANUAL_CARRIER_OPTIONS = [
  { value: "UPS", label: "UPS" },
  { value: "USPS", label: "USPS" },
  { value: "DHL", label: "DHL" },
  { value: "Freight/LTL", label: "Freight / LTL" },
  { value: "FedEx", label: "FedEx" },
  { value: "ShipStation", label: "ShipStation" },
  { value: "Other", label: "Other" },
];

type ShippingMode = "fedex" | "shipstation" | "manual" | "pickup";

function normalizeInitialCarrier(raw: string): string | null {
  const lower = raw.trim().toLowerCase();
  if (!lower) return null;
  if (lower === "fedex") return "FedEx";
  if (lower === "shipstation") return "ShipStation";
  if (lower === "ups") return "UPS";
  if (lower === "usps") return "USPS";
  if (lower === "dhl") return "DHL";
  if (lower === "freight" || lower.includes("freight") || lower === "freight/ltl") {
    return "Freight/LTL";
  }
  if (lower === "pickup" || lower.includes("pickup")) return "Pickup";
  if (lower === "other") return "Other";
  return null;
}

function getDefaultMode(
  isAlcoholOrder: boolean | undefined,
  isPickupOrder: boolean,
  preferredCarrier: string
): ShippingMode {
  if (isPickupOrder) return "pickup";
  const pref = preferredCarrier?.trim().toLowerCase() || "";
  if (pref === "shipstation") return "shipstation";
  if (pref === "fedex") return "fedex";
  if (["ups", "usps", "dhl", "freight", "freight/ltl", "other"].some((k) => pref.includes(k))) {
    return "manual";
  }
  if (isAlcoholOrder) return "fedex";
  return "shipstation";
}

function getDefaultManualCarrier(preferredCarrier: string, initialCarrier: string): string {
  const fromPreferred = normalizeInitialCarrier(preferredCarrier);
  if (
    fromPreferred &&
    fromPreferred !== "Pickup" &&
    fromPreferred !== "FedEx" &&
    fromPreferred !== "ShipStation"
  ) {
    return fromPreferred;
  }
  const fromInitial = normalizeInitialCarrier(initialCarrier);
  if (
    fromInitial &&
    fromInitial !== "Pickup" &&
    fromInitial !== "FedEx" &&
    fromInitial !== "ShipStation"
  ) {
    return fromInitial;
  }
  return "UPS";
}

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
  // FedEx / ShipStation integration props
  isAlcoholOrder?: boolean;
  fedexConfigured?: boolean;
  shipstationConfigured?: boolean;
  orderId?: string;
  shipToAddress?: ShipToAddress;
  // Pickup support
  preferredCarrier?: string;
  onFedexCancelled?: () => void;
}

export interface ShippingData {
  carrier: string;
  trackingNumber: string;
  shipDate: string;
  notes?: string;
  // Extended fields from FedEx API flow
  labelUrl?: string;
  fedexShipmentId?: string;
  // Shipping method override (pickup, manual, fedex_api)
  shippingMethod?: string;
  // Shipping costs
  shippingCost?: number;
  clientShippingCost?: number;
}

type FedExFlowState = "idle" | "creating" | "success" | "error" | "cancelled";

export default function ShippingModal({
  isOpen,
  onClose,
  onSubmit,
  orderNumber,
  initialCarrier = "",
  initialTrackingNumber = "",
  isAlcoholOrder,
  fedexConfigured,
  shipstationConfigured,
  orderId,
  shipToAddress,
  preferredCarrier,
  onFedexCancelled,
}: ShippingModalProps) {
  const isPickupOrder =
    preferredCarrier?.toLowerCase() === "pickup" ||
    preferredCarrier?.toLowerCase() === "customer pickup";
  const canUseFedex = !!fedexConfigured;
  const canUseShipstation = !!shipstationConfigured;
  const [mode, setMode] = useState<ShippingMode>(() =>
    getDefaultMode(isAlcoholOrder, isPickupOrder, preferredCarrier || "")
  );
  const [manualCarrier, setManualCarrier] = useState(() =>
    getDefaultManualCarrier(preferredCarrier || "", initialCarrier)
  );

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
  const [fedexRatesLoading, setFedexRatesLoading] = useState(false);
  const [fedexRatesError, setFedexRatesError] = useState("");
  const [fedexRates, setFedexRates] = useState<
    { serviceType: string; serviceName: string; accountRate?: number; listRate?: number; deliveryDate?: string }[]
  >([]);
  const [fedexTrackLoading, setFedexTrackLoading] = useState(false);
  const [fedexTrackError, setFedexTrackError] = useState("");
  const [fedexLatestStatus, setFedexLatestStatus] = useState<string>("");
  const [fedexResult, setFedexResult] = useState<{
    trackingNumber: string;
    labelUrl: string | null;
    shipmentId: string;
    actualCost: number | null;
    listCost: number | null;
  } | null>(null);
  const [fedexError, setFedexError] = useState("");
  const [fedexCancelLoading, setFedexCancelLoading] = useState(false);
  const [fedexCancelError, setFedexCancelError] = useState("");
  const [manualShippingCost, setManualShippingCost] = useState<number | "">("");

  // ShipStation label flow state
  type ShipStationFlowState = "idle" | "creating" | "success" | "error";
  const [shipstationLoading, setShipstationLoading] = useState(false);
  const [shipstationError, setShipstationError] = useState("");
  const [shipstationFlowState, setShipstationFlowState] = useState<ShipStationFlowState>("idle");
  const [shipstationResult, setShipstationResult] = useState<{
    trackingNumber: string;
    labelUrl: string | null;
    shipmentId: string;
    carrier: string;
    actualCost: number | null;
    listCost: number | null;
  } | null>(null);

  const resetFlowStates = () => {
    setFedexFlowState("idle");
    setFedexResult(null);
    setFedexError("");
    setFedexRates([]);
    setFedexRatesError("");
    setFedexCancelError("");
    setShipstationFlowState("idle");
    setShipstationResult(null);
    setShipstationError("");
  };

  const resetForm = () => {
    setMode(getDefaultMode(isAlcoholOrder, isPickupOrder, preferredCarrier || ""));
    setManualCarrier(getDefaultManualCarrier(preferredCarrier || "", initialCarrier));
    setCustomCarrier("");
    setTrackingNumber(initialTrackingNumber);
    setShipDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setErrors({});
    setFedexFlowState("idle");
    setFedexResult(null);
    setFedexError("");
    setFedexRates([]);
    setFedexRatesError("");
    setFedexRatesLoading(false);
    setFedexTrackLoading(false);
    setFedexTrackError("");
    setFedexLatestStatus("");
    setFedexCancelLoading(false);
    setFedexCancelError("");
    setPackageWeight(1);
    setPackageLength("");
    setPackageWidth("");
    setPackageHeight("");
    setManualShippingCost("");
    setShipstationLoading(false);
    resetFlowStates();
  };

  const handleModeChange = (nextMode: ShippingMode) => {
    setMode(nextMode);
    setErrors({});
    resetFlowStates();
  };

  const handleManualCarrierChange = (value: string) => {
    setManualCarrier(value);
    if (value !== "Other") setCustomCarrier("");
    setErrors({});
  };

  useEffect(() => {
    if (!isOpen) return;
    resetForm();
  }, [isOpen, isAlcoholOrder, fedexConfigured, shipstationConfigured, isPickupOrder, preferredCarrier, initialCarrier, initialTrackingNumber]);

  // Demo flag: disable tracking refresh until FedEx tracking credentials are fixed.
  // Rates + label/ship creation can still work.
  const ENABLE_FEDEX_TRACKING_REFRESH = false;

  // Tracking URL and validation (manual flow)
  const finalCarrier = manualCarrier === "Other" ? customCarrier : manualCarrier;
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
    const fc = manualCarrier === "Other" ? customCarrier : manualCarrier;

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
        clientShippingCost: manualShippingCost !== "" ? manualShippingCost : undefined,
      });
      resetForm();
    } catch (error) {
      console.error("Failed to submit shipping info:", error);
      setErrors({ submit: error instanceof Error ? error.message : "Failed to ship order. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Pickup submit ──────────────────────────────
  const handlePickupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!shipDate) newErrors.shipDate = "Pickup date is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        carrier: "Pickup",
        trackingNumber: "N/A",
        shipDate,
        notes: notes.trim() || undefined,
        shippingMethod: "pickup",
      });
      resetForm();
    } catch (error) {
      console.error("Failed to mark as picked up:", error);
    } finally {
      setSubmitting(false);
    }
  };

  // ── FedEx create shipment ─────────────────────
  const handleFedExCreate = async () => {
    if (!orderId || packageWeight <= 0) return;

    setFedexFlowState("creating");
    setFedexError("");
    setFedexCancelError("");

    try {
      console.log("📦 FedEx create shipment request", {
        orderId,
        serviceType: fedexService,
        packageWeight,
        packageLength: packageLength || undefined,
        packageWidth: packageWidth || undefined,
        packageHeight: packageHeight || undefined,
        isAlcohol: isAlcoholOrder ?? false,
        shipDate,
      });
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
        console.error("❌ FedEx create shipment failed", { status: res.status, data });
        setFedexFlowState("error");
        if (data?.missingFields?.length) {
          const pretty = (data.missingFields as string[])
            .map((f) => f.replace(/^ship_to_/, "").replace(/_/g, " "))
            .join(", ");
          setFedexError(
            `Missing Ship-To fields on this order: ${pretty}. Click "Edit Order" on the order page, fill the Shipping Address, then Save.`
          );
        } else {
          setFedexError(data.error || "Failed to create FedEx shipment");
        }
        setFedexRates([]);
        return;
      }

      console.log("✅ FedEx create shipment success", data);
      setFedexResult({
        ...data,
        actualCost: data.actualCost ?? null,
        listCost: data.listCost ?? null,
      });
      setFedexRates([]);
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
      console.log("✅ FedEx complete shipment → ship order", {
        orderId,
        trackingNumber: fedexResult.trackingNumber,
        shipmentId: fedexResult.shipmentId,
        labelUrl: fedexResult.labelUrl || null,
        actualCost: fedexResult.actualCost ?? null,
        listCost: fedexResult.listCost ?? null,
        shipDate,
      });
      await onSubmit({
        carrier: "FedEx",
        trackingNumber: fedexResult.trackingNumber,
        shipDate,
        notes: notes.trim() || undefined,
        labelUrl: fedexResult.labelUrl || undefined,
        fedexShipmentId: fedexResult.shipmentId,
        shippingCost: fedexResult.actualCost ?? undefined,
        clientShippingCost: fedexResult.listCost ?? undefined,
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
    console.log("🏷️ FedEx label download requested", { labelUrl: fedexResult.labelUrl });
    // Generate a signed URL for the label
    window.open(`/api/shipping/fedex/label?path=${encodeURIComponent(fedexResult.labelUrl)}`, "_blank");
  };

  const handleFedExCancel = async () => {
    if (!orderId || !fedexResult?.trackingNumber) return;

    setFedexCancelLoading(true);
    setFedexCancelError("");
    try {
      const res = await fetch("/api/shipping/fedex/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          trackingNumber: fedexResult.trackingNumber,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const hint = typeof data?.hint === "string" && data.hint.trim() ? ` ${data.hint}` : "";
        setFedexCancelError(`${data.error || "Failed to cancel FedEx shipment"}${hint}`);
        return;
      }
      setFedexResult(null);
      setFedexFlowState("cancelled");
      onFedexCancelled?.();
    } catch (err) {
      setFedexCancelError(err instanceof Error ? err.message : "Network error");
    } finally {
      setFedexCancelLoading(false);
    }
  };

  const handleFedExTrack = async () => {
    if (!ENABLE_FEDEX_TRACKING_REFRESH) return; // demo safety: avoid calling FedEx tracking
    if (!fedexResult?.trackingNumber) return;
    console.log("📍 FedEx tracking request", { trackingNumber: fedexResult.trackingNumber });
    setFedexTrackLoading(true);
    setFedexTrackError("");
    try {
      const url =
        `/api/shipping/fedex/track?trackingNumber=${encodeURIComponent(fedexResult.trackingNumber)}` +
        (orderId ? `&orderId=${encodeURIComponent(orderId)}` : '') +
        (shipDate ? `&shipDate=${encodeURIComponent(shipDate)}` : '');
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        console.error("❌ FedEx tracking failed", { status: res.status, data });
        const hint = typeof data?.hint === "string" && data.hint.trim()
          ? ` (${data.hint})`
          : "";
        setFedexTrackError(`${data.error || "Failed to fetch tracking"}${hint}`);
        setFedexLatestStatus("");
      } else {
        console.log("✅ FedEx tracking success", data);
        setFedexLatestStatus(data.statusDescription || data.statusCode || "");
      }
    } catch (err) {
      console.error("❌ FedEx tracking network error", err);
      setFedexTrackError(err instanceof Error ? err.message : "Network error while tracking");
      setFedexLatestStatus("");
    } finally {
      setFedexTrackLoading(false);
    }
  };

  const handleClose = () => {
    if (!submitting && !fedexCancelLoading && fedexFlowState !== "creating") {
      setErrors({});
      onClose();
    }
  };

  const handleShipStationCreate = async () => {
    if (!orderId || packageWeight <= 0) return;

    setShipstationFlowState("creating");
    setShipstationLoading(true);
    setShipstationError("");

    try {
      const res = await fetch("/api/shipping/shipstation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          packageWeight,
          shipDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const hint =
          typeof data?.hint === "string" && data.hint.trim() ? ` ${data.hint}` : "";
        setShipstationFlowState("error");
        setShipstationError(`${data.error || "Failed to create ShipStation shipment"}${hint}`);
        return;
      }

      setShipstationResult({
        trackingNumber: data.trackingNumber,
        labelUrl: data.labelUrl || null,
        shipmentId: String(data.shipmentId || data.shipStationOrderId || ""),
        carrier: data.carrier || "ShipStation",
        actualCost: data.actualCost ?? null,
        listCost: data.listCost ?? null,
      });
      setShipstationFlowState("success");
    } catch (err) {
      setShipstationFlowState("error");
      setShipstationError(err instanceof Error ? err.message : "Network error");
    } finally {
      setShipstationLoading(false);
    }
  };

  const handleShipStationComplete = async () => {
    if (!shipstationResult) return;

    setSubmitting(true);
    try {
      await onSubmit({
        carrier: shipstationResult.carrier,
        trackingNumber: shipstationResult.trackingNumber,
        shipDate,
        notes: notes.trim() || undefined,
        labelUrl: shipstationResult.labelUrl || undefined,
        shippingMethod: "shipstation_api",
        shippingCost: shipstationResult.actualCost ?? undefined,
        clientShippingCost: shipstationResult.listCost ?? undefined,
      });
      resetForm();
    } catch (error) {
      console.error("Failed to complete ShipStation shipment:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadShipStationLabel = () => {
    if (!shipstationResult?.labelUrl) return;
    window.open(
      `/api/shipping/fedex/label?path=${encodeURIComponent(shipstationResult.labelUrl)}`,
      "_blank"
    );
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

        {!isPickupOrder && (
          <div className="flex flex-wrap rounded-lg bg-slate-100 p-1 gap-1">
            <button
              type="button"
              onClick={() => handleModeChange("fedex")}
              className={`flex-1 min-w-[110px] text-sm font-medium py-1.5 px-3 rounded-md transition-colors ${
                mode === "fedex"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              FedEx
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("shipstation")}
              className={`flex-1 min-w-[110px] text-sm font-medium py-1.5 px-3 rounded-md transition-colors ${
                mode === "shipstation"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              ShipStation
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("manual")}
              className={`flex-1 min-w-[110px] text-sm font-medium py-1.5 px-3 rounded-md transition-colors ${
                mode === "manual"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Manual Entry
            </button>
          </div>
        )}

        {isAlcoholOrder && mode === "fedex" && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-start gap-2.5">
            <Wine className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-purple-800">Alcohol Order</p>
              <p className="text-purple-600 mt-0.5">
                FedEx API label with adult signature. Use Manual Entry for other carriers.
              </p>
            </div>
          </div>
        )}

        {mode === "shipstation" && (
          <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-sky-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-sky-800">ShipStation</p>
              <p className="text-sky-700 mt-0.5">
                ShipStation will automatically choose the best carrier and service for this shipment.
              </p>
            </div>
          </div>
        )}

        {mode !== "pickup" && shipToAddress && (
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

        {/* ── FedEx API ──────────────────────── */}
        {mode === "fedex" && (
          <>
            {!canUseFedex && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800">FedEx Not Configured</p>
                  <p className="text-amber-600 mt-0.5">
                    Configure FedEx credentials in Settings → System, or use ShipStation / Manual Entry.
                  </p>
                </div>
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

                {/* FedEx Rates */}
                {fedexRatesError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-700">{fedexRatesError}</p>
                  </div>
                )}
                {fedexRates.length > 0 && (
                  <div className="border border-slate-200 rounded-lg">
                    <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">FedEx Rates</p>
                      <p className="text-[11px] text-slate-400">Select a service</p>
                    </div>
                    <div className="divide-y divide-slate-200">
                      {fedexRates.map((rate, idx) => {
                        const isSelected = fedexService === rate.serviceType;
                        return (
                          <button
                            key={`${rate.serviceType}-${idx}`}
                            type="button"
                            onClick={() => setFedexService(rate.serviceType)}
                            className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-3 ${
                              isSelected ? "bg-blue-50" : "hover:bg-slate-50"
                            }`}
                          >
                            <div>
                              <div className="font-medium text-slate-900">
                                {rate.serviceName || rate.serviceType}
                                {isSelected && (
                                  <span className="ml-2 inline-flex items-center rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                                    Selected
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5 space-x-2">
                                {rate.accountRate != null && (
                                  <span>Our cost: ${rate.accountRate.toFixed(2)}</span>
                                )}
                                {rate.listRate != null && (
                                  <span>Client rate: ${rate.listRate.toFixed(2)}</span>
                                )}
                                {rate.deliveryDate && (
                                  <span>ETA: {rate.deliveryDate}</span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

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
                    variant="ghost"
                    onClick={async () => {
                      if (!orderId || packageWeight <= 0) return;
                      console.log("💲 FedEx rates request", {
                        orderId,
                        packageWeight,
                        shipDate,
                      });
                      setFedexRatesLoading(true);
                      setFedexRatesError("");
                      try {
                        const res = await fetch("/api/shipping/fedex/rates", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            orderId,
                            packageWeight,
                            shipDate,
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          console.error("❌ FedEx rates failed", { status: res.status, data });
                          setFedexRates([]);
                          const message = data?.error || "Failed to fetch FedEx rates";
                          const hint = typeof data?.hint === "string" && data.hint.trim() ? ` (${data.hint})` : "";
                          setFedexRatesError(`${message}${hint}`);
                        } else {
                          console.log("✅ FedEx rates success", data);
                          setFedexRates(data.options || []);
                          if (data.options && data.options.length > 0) {
                            setFedexService(data.options[0].serviceType);
                          }
                        }
                      } catch (err) {
                        console.error("❌ FedEx rates network error", err);
                        setFedexRates([]);
                        setFedexRatesError(err instanceof Error ? err.message : "Network error while fetching rates");
                      } finally {
                        setFedexRatesLoading(false);
                      }
                    }}
                    disabled={!canUseFedex || packageWeight <= 0 || fedexRatesLoading}
                    className="flex-1"
                  >
                    {fedexRatesLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Getting Rates...
                      </>
                    ) : (
                      <>
                        <Info className="w-4 h-4 mr-2" />
                        Get FedEx Rates
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleFedExCreate}
                    disabled={!canUseFedex || packageWeight <= 0}
                    className="flex-1"
                  >
                    <Truck className="w-4 h-4 mr-2" />
                    Create FedEx Shipment
                  </Button>
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

            {fedexFlowState === "cancelled" && (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <span className="font-semibold text-emerald-900">FedEx cancelled successfully</span>
                  </div>
                  <p className="text-sm text-emerald-800">
                    The FedEx shipment was voided and tracking was cleared on this order. You can create a new label or close this dialog.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1 min-w-[120px]"
                    onClick={() => {
                      resetForm();
                      onClose();
                    }}
                  >
                    Close
                  </Button>
                  <Button type="button" className="flex-1 min-w-[120px]" onClick={() => resetForm()}>
                    Create new FedEx shipment
                  </Button>
                </div>
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
                  {(fedexResult.actualCost != null || fedexResult.listCost != null) && (
                    <div className="grid grid-cols-2 gap-3 text-sm mt-3 pt-3 border-t border-green-200">
                      {fedexResult.actualCost != null && (
                        <div>
                          <p className="text-gray-500">Our Cost</p>
                          <p className="font-medium text-gray-900">${fedexResult.actualCost.toFixed(2)}</p>
                        </div>
                      )}
                      {fedexResult.listCost != null && (
                        <div>
                          <p className="text-gray-500">Client Rate</p>
                          <p className="font-medium text-gray-900">${fedexResult.listCost.toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  )}
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

                <div className="space-y-2">
                  {ENABLE_FEDEX_TRACKING_REFRESH && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleFedExTrack}
                      loading={fedexTrackLoading}
                      disabled={fedexTrackLoading}
                      className="w-full"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Refresh Tracking Status
                    </Button>
                  )}
                  {fedexLatestStatus && (
                    <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      Latest status: <span className="font-medium text-slate-800">{fedexLatestStatus}</span>
                    </div>
                  )}
                  {fedexTrackError && (
                    <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {fedexTrackError}
                    </div>
                  )}
                </div>

                {fedexCancelError && (
                  <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {fedexCancelError}
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleClose}
                    disabled={submitting || fedexCancelLoading}
                    className="flex-1 min-w-[100px]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={handleFedExCancel}
                    loading={fedexCancelLoading}
                    disabled={submitting || fedexCancelLoading}
                    className="flex-1 min-w-[100px]"
                  >
                    Cancel FedEx
                  </Button>
                  <Button
                    type="button"
                    onClick={handleFedExComplete}
                    loading={submitting}
                    disabled={submitting || fedexCancelLoading}
                    className="flex-1 min-w-[100px]"
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
                    onClick={() => handleModeChange("manual")}
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

        {/* ── ShipStation Mode ───────────────── */}
        {mode === "shipstation" && (
          <>
            {!canUseShipstation && shipstationFlowState === "idle" && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800">ShipStation Not Configured</p>
                  <p className="text-amber-600 mt-0.5">
                    Add SHIPSTATION_API_KEY and SHIPSTATION_API_SECRET, or choose Freight/LTL or Other for manual entry.
                  </p>
                </div>
              </div>
            )}

            {shipstationFlowState === "idle" && (
              <div className="space-y-4">
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
                    onClick={handleShipStationCreate}
                    disabled={!canUseShipstation || packageWeight <= 0}
                    className="flex-1"
                  >
                    <Truck className="w-4 h-4 mr-2" />
                    Create{" "}
                    Create Label
                  </Button>
                </div>
              </div>
            )}

            {shipstationFlowState === "creating" && (
              <div className="py-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">Creating ShipStation label...</p>
                <p className="text-xs text-gray-500 mt-1">
                  ShipStation is selecting carrier and purchasing label
                </p>
              </div>
            )}

            {shipstationFlowState === "success" && shipstationResult && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-800">Label Created</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Carrier</p>
                      <p className="font-medium text-gray-900">{shipstationResult.carrier}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Tracking Number</p>
                      <p className="font-mono font-medium text-gray-900">
                        {shipstationResult.trackingNumber}
                      </p>
                    </div>
                  </div>
                  {shipstationResult.actualCost != null && (
                    <div className="text-sm mt-3 pt-3 border-t border-green-200">
                      <p className="text-gray-500">Shipping Cost</p>
                      <p className="font-medium text-gray-900">
                        ${shipstationResult.actualCost.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>

                {shipstationResult.labelUrl && (
                  <button
                    type="button"
                    onClick={handleDownloadShipStationLabel}
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
                    onClick={handleShipStationComplete}
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

            {shipstationFlowState === "error" && (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="font-semibold text-red-800">Label Failed</span>
                  </div>
                  <p className="text-sm text-red-700">{shipstationError}</p>
                </div>
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleModeChange("manual")}
                    className="flex-1"
                  >
                    Manual Entry
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setShipstationFlowState("idle");
                      setShipstationError("");
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

        {/* ── Manual tracking entry ──────────── */}
        {mode === "manual" && (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <Select
              label="Carrier"
              name="manualCarrier"
              options={MANUAL_CARRIER_OPTIONS}
              value={manualCarrier}
              onChange={(e) => handleManualCarrierChange(e.target.value)}
            />

            {manualCarrier === "Freight/LTL" && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  Enter the freight carrier tracking details manually after the label is created.
                </p>
              </div>
            )}

            {manualCarrier === "Other" && (
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

            <div className="grid grid-cols-2 gap-3">
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
              <Input
                label="Shipping Cost (to client)"
                name="manualShippingCost"
                type="number"
                step="0.01"
                min="0"
                value={manualShippingCost}
                onChange={(e) => setManualShippingCost(e.target.value ? parseFloat(e.target.value) : "")}
                placeholder="0.00"
              />
            </div>

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

            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{errors.submit}</p>
              </div>
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
        )}

        {/* ── Pickup Mode ─────────────────────── */}
        {mode === "pickup" && (
          <form onSubmit={handlePickupSubmit} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-800">Customer Pickup</p>
                <p className="text-blue-600 mt-0.5">
                  Customer will pick up this order at the warehouse. No carrier or tracking needed.
                </p>
              </div>
            </div>

            <Input
              label="Pickup Date"
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
                placeholder="Who picked up, ID checked, etc."
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
                <PackageCheck className="w-4 h-4 mr-2" />
                Mark as Picked Up
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
