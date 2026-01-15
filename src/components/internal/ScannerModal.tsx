"use client";

import { useState, useCallback } from "react";
import { X, Package, MapPin, AlertTriangle, CheckCircle, Search } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import BarcodeScanner from "@/components/ui/BarcodeScanner";
import { lookupBarcodeWithInventory, BarcodeProduct } from "@/lib/api/barcode";

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductFound: (product: BarcodeProduct) => void;
}

interface ScanResult {
  status: "idle" | "scanning" | "loading" | "found" | "not_found" | "error";
  scannedCode: string | null;
  product: BarcodeProduct | null;
  inventory: {
    location_id: string;
    location_name: string;
    qty_on_hand: number;
    qty_reserved: number;
  }[];
  error: string | null;
}

export default function ScannerModal({
  isOpen,
  onClose,
  onProductFound,
}: ScannerModalProps) {
  const [result, setResult] = useState<ScanResult>({
    status: "scanning",
    scannedCode: null,
    product: null,
    inventory: [],
    error: null,
  });

  const handleScan = useCallback(async (code: string) => {
    setResult({
      status: "loading",
      scannedCode: code,
      product: null,
      inventory: [],
      error: null,
    });

    try {
      const data = await lookupBarcodeWithInventory(code);

      if (data) {
        setResult({
          status: "found",
          scannedCode: code,
          product: data.product,
          inventory: data.inventory,
          error: null,
        });
      } else {
        setResult({
          status: "not_found",
          scannedCode: code,
          product: null,
          inventory: [],
          error: null,
        });
      }
    } catch (err) {
      setResult({
        status: "error",
        scannedCode: code,
        product: null,
        inventory: [],
        error: err instanceof Error ? err.message : "Failed to lookup product",
      });
    }
  }, []);

  const handleScanError = useCallback((error: string) => {
    setResult((prev) => ({
      ...prev,
      status: "error",
      error,
    }));
  }, []);

  const handleSelectProduct = () => {
    if (result.product) {
      onProductFound(result.product);
      handleClose();
    }
  };

  const handleScanAgain = () => {
    setResult({
      status: "scanning",
      scannedCode: null,
      product: null,
      inventory: [],
      error: null,
    });
  };

  const handleClose = () => {
    setResult({
      status: "scanning",
      scannedCode: null,
      product: null,
      inventory: [],
      error: null,
    });
    onClose();
  };

  const totalQty = result.inventory.reduce((sum, inv) => sum + inv.qty_on_hand, 0);
  const totalAvailable = result.inventory.reduce(
    (sum, inv) => sum + (inv.qty_on_hand - inv.qty_reserved),
    0
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Scan Product"
      size="md"
    >
      <div className="space-y-4">
        {/* Scanner */}
        {result.status === "scanning" && (
          <BarcodeScanner
            isActive={isOpen && result.status === "scanning"}
            onScan={handleScan}
            onError={handleScanError}
          />
        )}

        {/* Loading */}
        {result.status === "loading" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mb-4"></div>
            <p className="text-gray-600">Looking up product...</p>
            <p className="text-sm text-gray-400 font-mono mt-1">{result.scannedCode}</p>
          </div>
        )}

        {/* Product Found */}
        {result.status === "found" && result.product && (
          <div className="space-y-4">
            {/* Success Badge */}
            <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-2 rounded-lg">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Product Found</span>
            </div>

            {/* Product Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {result.product.name}
                  </h3>
                  <p className="text-sm text-gray-500 font-mono">
                    {result.product.sku}
                  </p>
                  {result.product.barcode && result.product.barcode !== result.product.sku && (
                    <p className="text-xs text-gray-400 mt-1">
                      Barcode: {result.product.barcode}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Inventory Info */}
            {result.inventory.length > 0 ? (
              <div className="border rounded-lg divide-y">
                <div className="px-4 py-2 bg-gray-50 flex justify-between text-sm font-medium text-gray-600">
                  <span>Location</span>
                  <span>Available</span>
                </div>
                {result.inventory.map((inv) => (
                  <div key={inv.location_id} className="px-4 py-2 flex justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-900">{inv.location_name}</span>
                    </div>
                    <div className="text-right">
                      <span className={`font-medium ${
                        inv.qty_on_hand - inv.qty_reserved > 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}>
                        {inv.qty_on_hand - inv.qty_reserved}
                      </span>
                      <span className="text-gray-400 text-sm ml-1">
                        / {inv.qty_on_hand}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="px-4 py-2 bg-gray-50 flex justify-between font-medium">
                  <span className="text-gray-700">Total</span>
                  <div>
                    <span className={totalAvailable > 0 ? "text-green-600" : "text-red-600"}>
                      {totalAvailable}
                    </span>
                    <span className="text-gray-400 text-sm ml-1">/ {totalQty}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No inventory records</p>
              </div>
            )}

            {/* Actions - Touch friendly */}
            <div className="flex gap-3">
              <Button variant="secondary" onClick={handleScanAgain} className="flex-1 min-h-[48px]">
                <Search className="w-5 h-5 mr-2" />
                Scan Another
              </Button>
              <Button onClick={handleSelectProduct} className="flex-1 min-h-[48px]">
                Select Product
              </Button>
            </div>
          </div>
        )}

        {/* Not Found */}
        {result.status === "not_found" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Product Not Found</h3>
              <p className="text-gray-500 text-center mt-1">
                No product matches the scanned code
              </p>
              <p className="font-mono text-sm bg-gray-100 px-3 py-1 rounded mt-3">
                {result.scannedCode}
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={handleScanAgain} className="flex-1 min-h-[48px]">
                <Search className="w-5 h-5 mr-2" />
                Scan Again
              </Button>
              <Button variant="secondary" onClick={handleClose} className="flex-1 min-h-[48px]">
                Close
              </Button>
            </div>
          </div>
        )}

        {/* Error */}
        {result.status === "error" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <X className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Error</h3>
              <p className="text-gray-500 text-center mt-1">
                {result.error || "Something went wrong"}
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={handleScanAgain} className="flex-1 min-h-[48px]">
                Try Again
              </Button>
              <Button variant="secondary" onClick={handleClose} className="flex-1 min-h-[48px]">
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
