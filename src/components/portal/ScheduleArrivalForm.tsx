"use client";

import { useState, useEffect } from "react";
import {
  Package,
  Calendar,
  ClipboardCheck,
  Check,
  Search,
  Plus,
  Minus,
  Trash2,
  Truck,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useClient } from "@/lib/client-auth";
import { createClient } from "@/lib/supabase";
import { createInboundOrder, CreateInboundItemData } from "@/lib/api/inbound";
import { handleApiError } from "@/lib/utils/error-handler";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import DockCalendar from "@/components/portal/DockCalendar";

interface Product {
  id: string;
  name: string;
  sku: string;
  container_type: string | null;
  units_per_case: number | null;
}

interface SelectedProduct {
  product_id: string;
  name: string;
  sku: string;
  quantity: number;
}

interface DeliveryDetails {
  expected_date: string;
  preferred_time_slot: "am" | "pm";
  carrier: string;
  tracking_number: string;
  notes: string;
}

const CARRIERS = [
  { value: "", label: "Not yet known" },
  { value: "FedEx", label: "FedEx" },
  { value: "UPS", label: "UPS" },
  { value: "USPS", label: "USPS" },
  { value: "DHL", label: "DHL" },
  { value: "Freight/LTL", label: "Freight / LTL" },
  { value: "Other", label: "Other" },
];

type Step = 1 | 2 | 3;

const STEPS = [
  { number: 1, title: "Select Products", icon: Package },
  { number: 2, title: "Delivery Details", icon: Calendar },
  { number: 3, title: "Review & Submit", icon: ClipboardCheck },
] as const;

interface ScheduleArrivalFormProps {
  onSuccess?: () => void;
}

export default function ScheduleArrivalForm({ onSuccess }: ScheduleArrivalFormProps) {
  const { client } = useClient();

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deliveryDetails, setDeliveryDetails] = useState<DeliveryDetails>({
    expected_date: "",
    preferred_time_slot: "am",
    carrier: "",
    tracking_number: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Fetch client's products
  useEffect(() => {
    const fetchProducts = async () => {
      if (!client || client.id === "staff-preview") return;

      const supabase = createClient();

      const { data } = await supabase
        .from("products")
        .select("id, name, sku, container_type, units_per_case")
        .eq("client_id", client.id)
        .order("name");

      setProducts(data || []);
      setLoadingProducts(false);
    };

    fetchProducts();
  }, [client]);

  const filteredProducts = products.filter((p) => {
    const query = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      p.sku.toLowerCase().includes(query)
    );
  });

  const addProduct = (product: Product) => {
    if (selectedProducts.some((sp) => sp.product_id === product.id)) return;
    setSelectedProducts([
      ...selectedProducts,
      {
        product_id: product.id,
        name: product.name,
        sku: product.sku,
        quantity: 1,
      },
    ]);
  };

  const removeProduct = (productId: string) => {
    setSelectedProducts(selectedProducts.filter((sp) => sp.product_id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) return;
    setSelectedProducts(
      selectedProducts.map((sp) =>
        sp.product_id === productId ? { ...sp, quantity } : sp
      )
    );
  };

  const totalUnits = selectedProducts.reduce((sum, p) => sum + p.quantity, 0);

  const canProceedStep1 = selectedProducts.length > 0 && selectedProducts.every((p) => p.quantity > 0);

  const todayStr = new Date().toISOString().split("T")[0];

  const canProceedStep2 = deliveryDetails.expected_date >= todayStr && deliveryDetails.preferred_time_slot;

  const handleCalendarSelect = (date: string, slot: "am" | "pm") => {
    setDeliveryDetails((prev) => ({
      ...prev,
      expected_date: date,
      preferred_time_slot: slot,
    }));
  };

  const nextStep = () => {
    if (currentStep < 3) setCurrentStep((currentStep + 1) as Step);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep((currentStep - 1) as Step);
  };

  const goToStep = (step: Step) => {
    if (step <= currentStep) setCurrentStep(step);
  };

  const handleSubmit = async () => {
    if (!client || client.id === "staff-preview") return;
    setSubmitError(null);
    setSubmitting(true);

    try {
      const supabase = createClient();

      // Get client company name for supplier field
      const { data: clientData } = await supabase
        .from("clients")
        .select("company_name")
        .eq("id", client.id)
        .single();

      const items: CreateInboundItemData[] = selectedProducts.map((p) => ({
        product_id: p.product_id,
        qty_expected: p.quantity,
      }));

      await createInboundOrder(
        {
          supplier: clientData?.company_name || "Client Portal",
          client_id: client.id,
          expected_date: deliveryDetails.expected_date,
          notes: deliveryDetails.notes || null,
          carrier: deliveryDetails.carrier || null,
          tracking_number: deliveryDetails.tracking_number || null,
          preferred_time_slot: deliveryDetails.preferred_time_slot,
          appointment_status: "pending_approval",
        },
        items
      );

      setSubmitSuccess(true);

      setTimeout(() => {
        onSuccess?.();
      }, 3000);
    } catch (error) {
      console.error("Error scheduling arrival:", error);
      setSubmitError(handleApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (!client) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Step Indicator */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = currentStep > step.number;
            const isCurrent = currentStep === step.number;

            return (
              <div key={step.number} className="flex items-center flex-1">
                <button
                  onClick={() => goToStep(step.number as Step)}
                  disabled={step.number > currentStep}
                  className={`
                    flex items-center gap-3 group
                    ${step.number > currentStep ? "cursor-not-allowed" : "cursor-pointer"}
                  `}
                >
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center transition-colors
                      ${isCompleted
                        ? "bg-green-600 text-white"
                        : isCurrent
                        ? "bg-cyan-600 text-white"
                        : "bg-slate-100 text-slate-400"
                      }
                    `}
                  >
                    {isCompleted ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p
                      className={`text-sm font-medium ${
                        isCurrent ? "text-cyan-600" : isCompleted ? "text-green-600" : "text-slate-400"
                      }`}
                    >
                      Step {step.number}
                    </p>
                    <p
                      className={`text-sm ${
                        isCurrent || isCompleted ? "text-slate-900" : "text-slate-400"
                      }`}
                    >
                      {step.title}
                    </p>
                  </div>
                </button>

                {index < STEPS.length - 1 && (
                  <div className="flex-1 mx-4">
                    <div
                      className={`h-1 rounded-full transition-colors ${
                        currentStep > step.number ? "bg-green-600" : "bg-slate-200"
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {/* Step 1: Select Products */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Select Products</h2>
              <p className="text-sm text-slate-500 mt-1">
                Choose the products you&apos;re sending and specify quantities
              </p>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search products by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Product List */}
            {loadingProducts ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg max-h-72 overflow-y-auto divide-y divide-slate-100">
                {filteredProducts.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    {searchQuery ? "No products match your search" : "No products found"}
                  </div>
                ) : (
                  filteredProducts.map((product) => {
                    const isSelected = selectedProducts.some(
                      (sp) => sp.product_id === product.id
                    );
                    return (
                      <div
                        key={product.id}
                        className={`flex items-center justify-between px-4 py-3 transition-colors ${
                          isSelected
                            ? "bg-cyan-50"
                            : "hover:bg-slate-50 cursor-pointer"
                        }`}
                        onClick={() => !isSelected && addProduct(product)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-900 truncate">
                            {product.name}
                          </p>
                          <p className="text-sm text-slate-500 font-mono">{product.sku}</p>
                        </div>
                        {isSelected ? (
                          <span className="text-xs font-medium text-cyan-600 bg-cyan-100 px-2 py-1 rounded-full">
                            Added
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              addProduct(product);
                            }}
                            className="text-cyan-600 hover:text-cyan-700 p-1"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Selected Products */}
            {selectedProducts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  Selected Products ({selectedProducts.length})
                </h3>
                <div className="space-y-2">
                  {selectedProducts.map((sp) => (
                    <div
                      key={sp.product_id}
                      className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{sp.name}</p>
                        <p className="text-sm text-slate-500 font-mono">{sp.sku}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(sp.product_id, sp.quantity - 1)}
                          disabled={sp.quantity <= 1}
                          className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-300 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={sp.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val > 0) {
                              updateQuantity(sp.product_id, val);
                            }
                          }}
                          className="w-20 text-center border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                        />
                        <button
                          onClick={() => updateQuantity(sp.product_id, sp.quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-300 text-slate-500 hover:bg-slate-100"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeProduct(sp.product_id)}
                          className="ml-2 text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-3 px-1 text-sm">
                  <span className="text-slate-500">
                    {selectedProducts.length} product{selectedProducts.length !== 1 ? "s" : ""}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {totalUnits.toLocaleString()} total units
                  </span>
                </div>
              </div>
            )}

            {/* Next Button */}
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button
                onClick={nextStep}
                disabled={!canProceedStep1}
              >
                Next: Delivery Details
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Delivery Details */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Delivery Details</h2>
              <p className="text-sm text-slate-500 mt-1">
                Pick a date and time slot for your dock appointment
              </p>
            </div>

            {/* Dock Calendar */}
            <DockCalendar
              selectedDate={deliveryDetails.expected_date || null}
              selectedSlot={deliveryDetails.preferred_time_slot || null}
              onSelect={handleCalendarSelect}
            />

            {/* Carrier */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Carrier
              </label>
              <div className="relative">
                <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                <select
                  value={deliveryDetails.carrier}
                  onChange={(e) =>
                    setDeliveryDetails({ ...deliveryDetails, carrier: e.target.value })
                  }
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 bg-white appearance-none"
                >
                  {CARRIERS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tracking Number */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Tracking Number
              </label>
              <Input
                type="text"
                placeholder="Enter tracking number (optional)"
                value={deliveryDetails.tracking_number}
                onChange={(e) =>
                  setDeliveryDetails({ ...deliveryDetails, tracking_number: e.target.value })
                }
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Special Instructions
              </label>
              <textarea
                value={deliveryDetails.notes}
                onChange={(e) =>
                  setDeliveryDetails({ ...deliveryDetails, notes: e.target.value })
                }
                placeholder="Any special handling instructions, pallet count, etc."
                rows={3}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 resize-none"
              />
            </div>

            {/* Nav Buttons */}
            <div className="flex justify-between pt-4 border-t border-slate-100">
              <Button variant="secondary" onClick={prevStep}>
                Back
              </Button>
              <Button
                onClick={nextStep}
                disabled={!canProceedStep2}
              >
                Next: Review
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Submit */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Review & Submit</h2>
              <p className="text-sm text-slate-500 mt-1">
                Confirm the details before scheduling your arrival
              </p>
            </div>

            {/* Success State */}
            {submitSuccess && (
              <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-6 text-center">
                <CheckCircle2 className="w-12 h-12 text-cyan-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-cyan-800">Dock Appointment Requested!</h3>
                <p className="text-cyan-700 mt-1">
                  Pending approval — you&apos;ll be notified once confirmed.
                </p>
                <p className="text-cyan-600 text-sm mt-2">
                  Switching to Arrivals...
                </p>
              </div>
            )}

            {!submitSuccess && (
              <>
                {/* Products Summary */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="w-4 h-4 text-slate-500" />
                    <h3 className="font-semibold text-slate-900">
                      Products ({selectedProducts.length})
                    </h3>
                    <button
                      onClick={() => goToStep(1)}
                      className="ml-auto text-sm text-cyan-600 hover:text-cyan-700"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {selectedProducts.map((sp) => (
                      <div key={sp.product_id} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900">{sp.name}</p>
                          <p className="text-sm text-slate-500 font-mono">{sp.sku}</p>
                        </div>
                        <span className="font-semibold text-slate-900">
                          {sp.quantity.toLocaleString()} units
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
                      <span className="font-medium text-slate-700">Total</span>
                      <span className="font-bold text-slate-900">
                        {totalUnits.toLocaleString()} units
                      </span>
                    </div>
                  </div>
                </div>

                {/* Delivery Details Summary */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <h3 className="font-semibold text-slate-900">Delivery Details</h3>
                    <button
                      onClick={() => goToStep(2)}
                      className="ml-auto text-sm text-cyan-600 hover:text-cyan-700"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-slate-500">Delivery Date</span>
                      <span className="font-medium text-slate-900">
                        {new Date(deliveryDetails.expected_date + "T00:00:00").toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-slate-500">Time Slot</span>
                      <span className="font-medium text-slate-900">
                        {deliveryDetails.preferred_time_slot === "am"
                          ? "AM (8:00 AM \u2013 12:00 PM)"
                          : "PM (12:00 PM \u2013 5:00 PM)"}
                      </span>
                    </div>
                    {deliveryDetails.carrier && (
                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-slate-500">Carrier</span>
                        <span className="font-medium text-slate-900">
                          {deliveryDetails.carrier}
                        </span>
                      </div>
                    )}
                    {deliveryDetails.tracking_number && (
                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-slate-500">Tracking</span>
                        <span className="font-mono text-sm text-slate-900">
                          {deliveryDetails.tracking_number}
                        </span>
                      </div>
                    )}
                    {deliveryDetails.notes && (
                      <div className="px-4 py-3">
                        <p className="text-slate-500 text-sm mb-1">Special Instructions</p>
                        <p className="text-slate-900 whitespace-pre-wrap">
                          {deliveryDetails.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Error */}
                {submitError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800">Unable to schedule arrival</p>
                      <p className="text-sm text-red-700 mt-1">{submitError}</p>
                    </div>
                  </div>
                )}

                {/* Nav Buttons */}
                <div className="flex justify-between pt-4 border-t border-slate-100">
                  <Button variant="secondary" onClick={prevStep}>
                    Back
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    loading={submitting}
                    disabled={submitting}
                  >
                    Schedule Arrival
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
