"use client";

import { useState, useRef, useEffect } from "react";
import {
  ScanLine,
  Package,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import {
  getPalletForBreakdown,
  pullFromPallet,
  formatCaseAwareQty,
  getContainerTypeBadgeColor,
  PalletForBreakdown,
  PalletContentItem,
} from "@/lib/api/pallet-breakdown";

type ScanStep = "scan_pallet" | "select_product" | "enter_qty" | "scan_destination" | "confirm";

interface PalletBreakdownScannerProps {
  onComplete: (updatedPallet: PalletForBreakdown | null) => void;
}

export default function PalletBreakdownScanner({
  onComplete,
}: PalletBreakdownScannerProps) {
  const [step, setStep] = useState<ScanStep>("scan_pallet");
  const [scanInput, setScanInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  // Data
  const [pallet, setPallet] = useState<PalletForBreakdown | null>(null);
  const [selectedContent, setSelectedContent] = useState<PalletContentItem | null>(null);
  const [pullQty, setPullQty] = useState(0);
  const [destinationCode, setDestinationCode] = useState("");
  const [destinationLocationId, setDestinationLocationId] = useState("");
  const [destinationSublocationId, setDestinationSublocationId] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const handleScanPallet = async () => {
    const code = scanInput.trim();
    if (!code) return;

    setLoading(true);
    setError("");
    try {
      const result = await getPalletForBreakdown(code);
      if (!result) {
        setError(`No pallet found: ${code}`);
        return;
      }
      if (result.container_type !== "pallet") {
        setError(`LPN ${code} is not a pallet`);
        return;
      }
      if (result.status === "empty") {
        setError("Pallet is empty");
        return;
      }
      setPallet(result);
      setScanInput("");
      setStep("select_product");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProduct = (content: PalletContentItem) => {
    setSelectedContent(content);
    const upc = content.product.units_per_case || 1;
    setPullQty(upc);
    setScanInput("");
    setStep("enter_qty");
  };

  const handleScanProductBarcode = async () => {
    const barcode = scanInput.trim();
    if (!barcode || !pallet) return;

    // Try to find product by SKU in pallet contents
    const found = pallet.contents.find(
      (c) => c.product.sku.toLowerCase() === barcode.toLowerCase()
    );

    if (found) {
      handleSelectProduct(found);
    } else {
      setError(`Product "${barcode}" not found on this pallet`);
    }
    setScanInput("");
  };

  const handleQtyConfirm = () => {
    if (pullQty <= 0 || !selectedContent || pullQty > selectedContent.qty) {
      setError("Invalid quantity");
      return;
    }
    setScanInput("");
    setStep("scan_destination");
  };

  const handleScanDestination = async () => {
    const code = scanInput.trim();
    if (!code) return;

    // For the scanner flow, we look up sublocations by code/barcode
    setLoading(true);
    setError("");

    try {
      const { createClient } = await import("@/lib/supabase");
      const supabase = createClient();

      // Try sublocation barcode first
      const { data: sub } = await supabase
        .from("sublocations")
        .select("id, code, location_id")
        .or(`code.eq.${code},barcode.eq.${code}`)
        .limit(1)
        .single();

      if (sub) {
        setDestinationCode(sub.code);
        setDestinationLocationId(sub.location_id);
        setDestinationSublocationId(sub.id);
        setScanInput("");
        setStep("confirm");
        return;
      }

      // Try location by name
      const { data: loc } = await supabase
        .from("locations")
        .select("id, name")
        .ilike("name", code)
        .limit(1)
        .single();

      if (loc) {
        setDestinationCode(loc.name);
        setDestinationLocationId(loc.id);
        setDestinationSublocationId("");
        setScanInput("");
        setStep("confirm");
        return;
      }

      setError(`Location "${code}" not found`);
    } catch {
      setError("Could not find destination location");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPull = async () => {
    if (!pallet || !selectedContent || !destinationLocationId) return;

    setLoading(true);
    setError("");
    try {
      const updated = await pullFromPallet({
        palletId: pallet.id,
        productId: selectedContent.product_id,
        quantity: pullQty,
        destinationLocationId,
        destinationSublocationId: destinationSublocationId || undefined,
        lotId: selectedContent.lot_id || undefined,
      });

      setPallet(updated);
      setSuccess(
        `Pulled ${pullQty} ${selectedContent.product.name} to ${destinationCode}`
      );
      setSelectedContent(null);
      setPullQty(0);
      setDestinationCode("");
      setDestinationLocationId("");
      setDestinationSublocationId("");
      setScanInput("");

      // Go back to product selection for another pull, or finish
      if (updated.status === "empty") {
        setSuccess("Pallet is now empty! All items have been broken down.");
      } else {
        setStep("select_product");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pull failed");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      switch (step) {
        case "scan_pallet":
          handleScanPallet();
          break;
        case "select_product":
          handleScanProductBarcode();
          break;
        case "enter_qty":
          handleQtyConfirm();
          break;
        case "scan_destination":
          handleScanDestination();
          break;
        case "confirm":
          handleConfirmPull();
          break;
      }
    }
  };

  const handleReset = () => {
    setStep("scan_pallet");
    setPallet(null);
    setSelectedContent(null);
    setPullQty(0);
    setDestinationCode("");
    setDestinationLocationId("");
    setDestinationSublocationId("");
    setScanInput("");
    setError("");
    setSuccess("");
  };

  const stepLabels: Record<ScanStep, string> = {
    scan_pallet: "1. Scan Pallet",
    select_product: "2. Select Product",
    enter_qty: "3. Enter Quantity",
    scan_destination: "4. Scan Destination",
    confirm: "5. Confirm",
  };

  const steps: ScanStep[] = ["scan_pallet", "select_product", "enter_qty", "scan_destination", "confirm"];
  const currentStepIndex = steps.indexOf(step);

  return (
    <div className="space-y-4">
      {/* Step Indicator */}
      <div className="flex items-center gap-1">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-2 h-2 rounded-full ${
                i <= currentStepIndex ? "bg-blue-600" : "bg-gray-300"
              }`}
            />
            {i < steps.length - 1 && (
              <div
                className={`w-6 h-0.5 ${
                  i < currentStepIndex ? "bg-blue-600" : "bg-gray-300"
                }`}
              />
            )}
          </div>
        ))}
        <span className="ml-2 text-sm font-medium text-gray-600">
          {stepLabels[step]}
        </span>
      </div>

      {/* Success Banner */}
      {success && (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg p-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{success}</p>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 text-red-700 bg-red-50 rounded-lg p-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
          <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600">
            &times;
          </button>
        </div>
      )}

      {/* Pallet Info (when loaded) */}
      {pallet && step !== "scan_pallet" && (
        <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
          <Package className="w-5 h-5 text-blue-600" />
          <div>
            <p className="font-medium text-gray-900">{pallet.lpn_number}</p>
            <p className="text-xs text-gray-500">
              {pallet.contents?.length || 0} products |{" "}
              {pallet.contents?.reduce((sum, c) => sum + c.qty, 0) || 0} total units
            </p>
          </div>
          <Badge
            variant={pallet.status === "active" ? "success" : "default"}
          >
            {pallet.status}
          </Badge>
        </div>
      )}

      {/* Step Content */}
      {step === "scan_pallet" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scan or enter pallet barcode..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-lg focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <Button onClick={handleScanPallet} loading={loading} disabled={!scanInput.trim()}>
              Go
            </Button>
          </div>
        </div>
      )}

      {step === "select_product" && pallet && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <ScanLine className="w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scan product SKU or select below..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {pallet.contents?.map((content) => (
              <button
                key={content.id}
                onClick={() => handleSelectProduct(content)}
                className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
              >
                <div>
                  <p className="font-medium text-gray-900">{content.product.name}</p>
                  <p className="text-sm text-gray-500">{content.product.sku}</p>
                </div>
                <div className="text-right">
                  <Badge variant={getContainerTypeBadgeColor(content.product.container_type || "other")}>
                    {content.product.container_type || "other"}
                  </Badge>
                  <p className="text-sm font-medium mt-1">
                    {formatCaseAwareQty(
                      content.qty,
                      content.product.container_type || "other",
                      content.product.units_per_case
                    )}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "enter_qty" && selectedContent && (
        <div className="space-y-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="font-medium">{selectedContent.product.name}</p>
            <p className="text-sm text-gray-500">
              Available:{" "}
              {formatCaseAwareQty(
                selectedContent.qty,
                selectedContent.product.container_type || "other",
                selectedContent.product.units_per_case
              )}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity to Pull
            </label>
            <input
              ref={inputRef}
              type="number"
              min={1}
              max={selectedContent.qty}
              value={pullQty}
              onChange={(e) =>
                setPullQty(Math.min(parseInt(e.target.value) || 0, selectedContent.qty))
              }
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => setPullQty(1)}>
              1 unit
            </Button>
            {(selectedContent.product.units_per_case || 1) > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPullQty(selectedContent.product.units_per_case || 1)}
              >
                1 case ({selectedContent.product.units_per_case})
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setPullQty(selectedContent.qty)}>
              All ({selectedContent.qty})
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            {formatCaseAwareQty(
              pullQty,
              selectedContent.product.container_type || "other",
              selectedContent.product.units_per_case
            )}
          </p>
          <Button
            onClick={handleQtyConfirm}
            disabled={pullQty <= 0 || pullQty > selectedContent.qty}
            className="w-full"
          >
            Next: Scan Destination
          </Button>
        </div>
      )}

      {step === "scan_destination" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scan destination location barcode..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-lg focus:ring-2 focus:ring-blue-500"
            />
            <Button onClick={handleScanDestination} loading={loading} disabled={!scanInput.trim()}>
              Go
            </Button>
          </div>
        </div>
      )}

      {step === "confirm" && selectedContent && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Package className="w-4 h-4 text-blue-600" />
              <span className="text-gray-600">Product:</span>
              <span className="font-medium">{selectedContent.product.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600 ml-6">Quantity:</span>
              <span className="font-medium">
                {formatCaseAwareQty(
                  pullQty,
                  selectedContent.product.container_type || "other",
                  selectedContent.product.units_per_case
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <ArrowRight className="w-4 h-4 text-blue-600" />
              <span className="text-gray-600">Destination:</span>
              <span className="font-medium">{destinationCode}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setStep("scan_destination");
                setScanInput("");
              }}
              className="flex-1"
            >
              Back
            </Button>
            <Button onClick={handleConfirmPull} loading={loading} className="flex-1">
              Confirm Pull
            </Button>
          </div>
        </div>
      )}

      {/* Bottom actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <Button variant="ghost" size="sm" onClick={handleReset}>
          <RotateCcw className="w-4 h-4 mr-1" />
          Start Over
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onComplete(pallet)}>
          Done
        </Button>
      </div>
    </div>
  );
}
