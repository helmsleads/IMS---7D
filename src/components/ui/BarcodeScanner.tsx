"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { Camera, CameraOff, RefreshCw, Flashlight } from "lucide-react";
import Button from "./Button";

interface BarcodeScannerProps {
  onScan: (value: string) => void;
  onError?: (error: string) => void;
  isActive: boolean;
  className?: string;
}

const SCANNER_ID = "barcode-scanner";

type PermissionState = "prompt" | "granted" | "denied" | "checking" | "error";

export default function BarcodeScanner({
  onScan,
  onError,
  isActive,
  className = "",
}: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [permissionState, setPermissionState] = useState<PermissionState>("checking");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Calculate responsive qrbox size based on container
  const getQrBoxSize = useCallback(() => {
    if (containerRef.current) {
      const width = containerRef.current.offsetWidth;
      // Make scanner box responsive - 80% of container width, max 280px
      const boxWidth = Math.min(Math.floor(width * 0.8), 280);
      const boxHeight = Math.floor(boxWidth * 0.6); // 5:3 aspect ratio for barcodes
      return { width: boxWidth, height: boxHeight };
    }
    return { width: 250, height: 150 };
  }, []);

  // Check camera permission
  useEffect(() => {
    const checkPermission = async () => {
      setPermissionState("checking");

      try {
        // Check if permission API is available
        if (navigator.permissions) {
          try {
            const result = await navigator.permissions.query({ name: "camera" as PermissionName });
            if (result.state === "granted") {
              setPermissionState("granted");
            } else if (result.state === "denied") {
              setPermissionState("denied");
              return;
            } else {
              setPermissionState("prompt");
            }
          } catch {
            // Permission API not supported for camera, continue to check devices
          }
        }

        // Check for available cameras
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setHasMultipleCameras(devices.length > 1);
          setPermissionState("granted");
        } else {
          setPermissionState("denied");
          setCameraError("No camera found on this device");
        }
      } catch (err) {
        // Permission denied or error accessing camera
        const message = err instanceof Error ? err.message : "Camera access denied";
        if (message.includes("Permission denied") || message.includes("NotAllowedError")) {
          setPermissionState("denied");
          setCameraError("Camera permission denied. Please allow camera access in your browser settings.");
        } else {
          setPermissionState("error");
          setCameraError(message);
        }
      }
    };

    checkPermission();
  }, []);

  // Request camera permission
  const requestPermission = async () => {
    setPermissionState("checking");
    setCameraError(null);

    try {
      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });

      // Stop the stream immediately (we just needed permission)
      stream.getTracks().forEach(track => track.stop());

      setPermissionState("granted");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to access camera";
      setPermissionState("denied");
      setCameraError(message);
    }
  };

  // Start/stop scanner
  useEffect(() => {
    const startScanner = async () => {
      if (!isActive || permissionState !== "granted" || scannerRef.current) return;

      setIsStarting(true);
      setCameraError(null);

      try {
        const scanner = new Html5Qrcode(SCANNER_ID);
        scannerRef.current = scanner;

        const qrbox = getQrBoxSize();

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox,
            aspectRatio: window.innerHeight > window.innerWidth ? 1.0 : 1.5,
            disableFlip: false,
          },
          (decodedText) => {
            // Vibrate on successful scan (if supported)
            if (navigator.vibrate) {
              navigator.vibrate(100);
            }
            onScan(decodedText);
          },
          () => {
            // Scan error callback (called frequently, ignore)
          }
        );

        // Check if torch is supported
        try {
          const capabilities = scanner.getRunningTrackCameraCapabilities();
          setTorchSupported(capabilities.torchFeature().isSupported());
        } catch {
          setTorchSupported(false);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to start scanner";

        // Provide user-friendly error messages
        let friendlyMessage = errorMessage;
        if (errorMessage.includes("NotAllowedError") || errorMessage.includes("Permission denied")) {
          friendlyMessage = "Camera permission denied. Please allow camera access and try again.";
          setPermissionState("denied");
        } else if (errorMessage.includes("NotFoundError")) {
          friendlyMessage = "No camera found. Please connect a camera and try again.";
        } else if (errorMessage.includes("NotReadableError")) {
          friendlyMessage = "Camera is in use by another app. Please close other camera apps and try again.";
        }

        setCameraError(friendlyMessage);
        onError?.(friendlyMessage);
        scannerRef.current = null;
      } finally {
        setIsStarting(false);
      }
    };

    const stopScanner = async () => {
      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState();
          if (state === Html5QrcodeScannerState.SCANNING) {
            await scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch (err) {
          console.error("Error stopping scanner:", err);
        }
        scannerRef.current = null;
        setTorchOn(false);
      }
    };

    if (isActive && permissionState === "granted") {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isActive, permissionState, onScan, onError, getQrBoxSize]);

  // Handle orientation change
  useEffect(() => {
    const handleOrientationChange = () => {
      if (scannerRef.current && isActive) {
        // Restart scanner on orientation change for proper sizing
        const restartScanner = async () => {
          try {
            const state = scannerRef.current?.getState();
            if (state === Html5QrcodeScannerState.SCANNING) {
              await scannerRef.current?.stop();
            }
            scannerRef.current = null;
            // Small delay to let the DOM update
            setTimeout(() => {
              setIsStarting(true);
            }, 100);
          } catch (err) {
            console.error("Error restarting scanner:", err);
          }
        };
        restartScanner();
      }
    };

    window.addEventListener("orientationchange", handleOrientationChange);
    window.addEventListener("resize", handleOrientationChange);

    return () => {
      window.removeEventListener("orientationchange", handleOrientationChange);
      window.removeEventListener("resize", handleOrientationChange);
    };
  }, [isActive]);

  // Toggle torch/flashlight
  const toggleTorch = async () => {
    if (!scannerRef.current || !torchSupported) return;

    try {
      const capabilities = scannerRef.current.getRunningTrackCameraCapabilities();
      const newState = !torchOn;
      await capabilities.torchFeature().apply(newState);
      setTorchOn(newState);
    } catch (err) {
      console.error("Error toggling torch:", err);
    }
  };

  // Checking state
  if (permissionState === "checking") {
    return (
      <div className={`flex items-center justify-center p-8 bg-gray-100 rounded-lg min-h-[200px] ${className}`}>
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-sm text-gray-600 font-medium">Checking camera...</p>
        </div>
      </div>
    );
  }

  // Permission needed
  if (permissionState === "prompt") {
    return (
      <div className={`flex items-center justify-center p-8 bg-gray-100 rounded-lg min-h-[200px] ${className}`}>
        <div className="text-center max-w-xs">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Camera className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Camera Access Required</h3>
          <p className="text-sm text-gray-500 mb-4">
            Allow camera access to scan barcodes
          </p>
          <Button onClick={requestPermission} className="min-h-[48px] px-6">
            <Camera className="w-5 h-5 mr-2" />
            Allow Camera
          </Button>
        </div>
      </div>
    );
  }

  // Permission denied
  if (permissionState === "denied") {
    return (
      <div className={`flex items-center justify-center p-8 bg-gray-100 rounded-lg min-h-[200px] ${className}`}>
        <div className="text-center max-w-xs">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CameraOff className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Camera Access Denied</h3>
          <p className="text-sm text-gray-500 mb-4">
            {cameraError || "Please allow camera access in your browser settings to scan barcodes."}
          </p>
          <Button variant="secondary" onClick={requestPermission} className="min-h-[48px] px-6">
            <RefreshCw className="w-5 h-5 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Error state
  if (permissionState === "error") {
    return (
      <div className={`flex items-center justify-center p-8 bg-gray-100 rounded-lg min-h-[200px] ${className}`}>
        <div className="text-center max-w-xs">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CameraOff className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Camera Error</h3>
          <p className="text-sm text-gray-500 mb-4">
            {cameraError || "Unable to access camera"}
          </p>
          <Button variant="secondary" onClick={requestPermission} className="min-h-[48px] px-6">
            <RefreshCw className="w-5 h-5 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={className} ref={containerRef}>
      {cameraError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{cameraError}</p>
        </div>
      )}

      {isActive ? (
        <div className="relative">
          {/* Scanner container */}
          <div
            id={SCANNER_ID}
            className="w-full rounded-lg overflow-hidden bg-black"
            style={{ minHeight: "250px" }}
          />

          {/* Loading overlay */}
          {isStarting && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/75 rounded-lg">
              <div className="text-center text-white">
                <div className="animate-spin w-10 h-10 border-4 border-white border-t-transparent rounded-full mx-auto mb-3"></div>
                <p className="text-sm font-medium">Starting camera...</p>
              </div>
            </div>
          )}

          {/* Torch button (if supported) */}
          {torchSupported && !isStarting && (
            <button
              onClick={toggleTorch}
              className={`
                absolute top-3 right-3 w-11 h-11 rounded-full flex items-center justify-center
                transition-colors shadow-lg
                ${torchOn
                  ? "bg-yellow-400 text-yellow-900"
                  : "bg-black/50 text-white hover:bg-black/70"
                }
              `}
              aria-label={torchOn ? "Turn off flashlight" : "Turn on flashlight"}
            >
              <Flashlight className="w-5 h-5" />
            </button>
          )}

          {/* Instructions */}
          <div className="mt-3 text-center">
            <p className="text-sm text-gray-600">
              Position barcode within the frame
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Hold steady for best results
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center p-8 bg-gray-100 rounded-lg min-h-[200px]">
          <div className="text-center">
            <Camera className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">Scanner inactive</p>
            <p className="text-sm text-gray-500 mt-1">
              Activate to start scanning
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (value: string) => void;
  title?: string;
}

export function BarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
  title = "Scan Barcode",
}: BarcodeScannerModalProps) {
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  const handleScan = (value: string) => {
    setLastScanned(value);
    onScan(value);
  };

  const handleClose = () => {
    setLastScanned(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={handleClose}
      />

      {/* Modal - Full width on mobile, centered on desktop */}
      <div className="relative bg-white w-full sm:max-w-md sm:mx-4 sm:rounded-xl rounded-t-xl shadow-xl max-h-[90vh] overflow-hidden">
        {/* Header with touch-friendly close button */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={handleClose}
            className="w-11 h-11 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors -mr-2"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scanner */}
        <div className="p-4">
          <BarcodeScanner
            isActive={isOpen}
            onScan={handleScan}
            onError={(err) => console.error("Scanner error:", err)}
          />

          {lastScanned && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                <span className="font-medium">Scanned:</span> {lastScanned}
              </p>
            </div>
          )}
        </div>

        {/* Footer with touch-friendly button */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <Button
            variant="secondary"
            onClick={handleClose}
            className="w-full min-h-[48px] text-base"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
