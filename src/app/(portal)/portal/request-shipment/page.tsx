"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Package, MapPin, ClipboardCheck, Check, Plus, Building2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useClient } from "@/lib/client-auth";
import { createClient } from "@/lib/supabase";

interface ShippingAddress {
  id: string;
  label: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
}

interface InventoryItem {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  qty_available: number;
  image_url: string | null;
}

interface SelectedProduct {
  inventory_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  qty_to_ship: number;
  qty_available: number;
}

interface AdditionalInfo {
  notes: string;
  isRushOrder: boolean;
  preferredCarrier: string;
}

const CARRIERS = [
  { value: "", label: "No preference" },
  { value: "fedex", label: "FedEx" },
  { value: "ups", label: "UPS" },
  { value: "usps", label: "USPS" },
  { value: "dhl", label: "DHL" },
  { value: "freight", label: "Freight / LTL" },
];

type Step = 1 | 2 | 3;

const STEPS = [
  { number: 1, title: "Select Products", icon: Package },
  { number: 2, title: "Shipping Details", icon: MapPin },
  { number: 3, title: "Review & Submit", icon: ClipboardCheck },
] as const;

export default function RequestShipmentPage() {
  const { client } = useClient();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [savedAddresses, setSavedAddresses] = useState<ShippingAddress[]>([]);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    id: "new",
    label: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "USA",
    is_default: false,
  });
  const [additionalInfo, setAdditionalInfo] = useState<AdditionalInfo>({
    notes: "",
    isRushOrder: false,
    preferredCarrier: "",
  });

  // Fetch inventory items for this client
  useEffect(() => {
    const fetchInventory = async () => {
      if (!client) return;

      const supabase = createClient();

      const { data } = await supabase
        .from("inventory")
        .select(`
          id,
          qty_on_hand,
          product:products!inner (
            id,
            name,
            sku,
            image_url,
            client_id
          )
        `)
        .eq("product.client_id", client.id)
        .gt("qty_on_hand", 0)
        .order("qty_on_hand", { ascending: false });

      const items = (data || []).map((item) => {
        const product = Array.isArray(item.product) ? item.product[0] : item.product;
        return {
          id: item.id,
          product_id: product?.id || "",
          product_name: product?.name || "Unknown",
          sku: product?.sku || "",
          qty_available: item.qty_on_hand,
          image_url: product?.image_url || null,
        };
      });

      setInventoryItems(items);
      setLoadingInventory(false);
    };

    fetchInventory();
  }, [client]);

  // Fetch saved addresses from client profile
  useEffect(() => {
    const fetchAddresses = async () => {
      if (!client) return;

      const supabase = createClient();

      // Fetch shipping addresses for this client
      const { data } = await supabase
        .from("client_addresses")
        .select("*")
        .eq("client_id", client.id)
        .order("is_default", { ascending: false });

      if (data && data.length > 0) {
        setSavedAddresses(data);
        // Pre-select default address
        const defaultAddr = data.find((a) => a.is_default) || data[0];
        setShippingAddress(defaultAddr);
      } else if (client) {
        // Use client's primary address as default
        setShippingAddress({
          id: "primary",
          label: "Primary Address",
          address_line1: client.address_line1 || "",
          address_line2: client.address_line2 || "",
          city: client.city || "",
          state: client.state || "",
          postal_code: client.zip || "",
          country: "USA",
          is_default: true,
        });
      }
    };

    fetchAddresses();
  }, [client]);

  const goToStep = (step: Step) => {
    setCurrentStep(step);
  };

  const nextStep = () => {
    if (currentStep < 3) {
      setCurrentStep((currentStep + 1) as Step);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Request Shipment</h1>
        <p className="text-gray-500 mt-1">
          Create a new outbound order to ship your products
        </p>
      </div>

      {/* Step Indicator */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = currentStep > step.number;
            const isCurrent = currentStep === step.number;

            return (
              <div key={step.number} className="flex items-center flex-1">
                {/* Step Circle */}
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
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-400"
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
                        isCurrent ? "text-blue-600" : isCompleted ? "text-green-600" : "text-gray-400"
                      }`}
                    >
                      Step {step.number}
                    </p>
                    <p
                      className={`text-sm ${
                        isCurrent || isCompleted ? "text-gray-900" : "text-gray-400"
                      }`}
                    >
                      {step.title}
                    </p>
                  </div>
                </button>

                {/* Connector Line */}
                {index < STEPS.length - 1 && (
                  <div className="flex-1 mx-4">
                    <div
                      className={`h-1 rounded-full transition-colors ${
                        currentStep > step.number ? "bg-green-600" : "bg-gray-200"
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
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {currentStep === 1 && (
          <StepSelectProducts
            onNext={nextStep}
            inventoryItems={inventoryItems}
            selectedProducts={selectedProducts}
            setSelectedProducts={setSelectedProducts}
            loading={loadingInventory}
          />
        )}
        {currentStep === 2 && (
          <StepShippingDetails
            onNext={nextStep}
            onBack={prevStep}
            savedAddresses={savedAddresses}
            shippingAddress={shippingAddress}
            setShippingAddress={setShippingAddress}
            additionalInfo={additionalInfo}
            setAdditionalInfo={setAdditionalInfo}
          />
        )}
        {currentStep === 3 && client && (
          <StepReviewSubmit
            onBack={prevStep}
            onEditStep={goToStep}
            shippingAddress={shippingAddress}
            selectedProducts={selectedProducts}
            additionalInfo={additionalInfo}
            clientId={client.id}
          />
        )}
      </div>
    </div>
  );
}

// Step 1: Select Products
function StepSelectProducts({
  onNext,
  inventoryItems,
  selectedProducts,
  setSelectedProducts,
  loading,
}: {
  onNext: () => void;
  inventoryItems: InventoryItem[];
  selectedProducts: SelectedProduct[];
  setSelectedProducts: (products: SelectedProduct[]) => void;
  loading: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [inputErrors, setInputErrors] = useState<Record<string, string>>({});
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  const validateAndSetQty = (item: InventoryItem, rawValue: string) => {
    const itemId = item.id;
    setInputValues({ ...inputValues, [itemId]: rawValue });

    // Clear error first
    const newErrors = { ...inputErrors };
    delete newErrors[itemId];

    // Parse the value
    const qty = parseInt(rawValue);

    // Validation checks
    if (rawValue !== "" && isNaN(qty)) {
      newErrors[itemId] = "Enter a valid number";
      setInputErrors(newErrors);
      return;
    }

    if (qty < 0) {
      newErrors[itemId] = "Cannot be negative";
      setInputErrors(newErrors);
      return;
    }

    if (qty > item.qty_available) {
      newErrors[itemId] = `Max available: ${item.qty_available}`;
      setInputErrors(newErrors);
      return;
    }

    setInputErrors(newErrors);

    // Valid - update the selected products
    const validQty = isNaN(qty) ? 0 : qty;

    if (validQty === 0) {
      setSelectedProducts(selectedProducts.filter((p) => p.inventory_id !== item.id));
    } else {
      const existing = selectedProducts.find((p) => p.inventory_id === item.id);
      if (existing) {
        setSelectedProducts(
          selectedProducts.map((p) =>
            p.inventory_id === item.id ? { ...p, qty_to_ship: validQty } : p
          )
        );
      } else {
        setSelectedProducts([
          ...selectedProducts,
          {
            inventory_id: item.id,
            product_id: item.product_id,
            product_name: item.product_name,
            sku: item.sku,
            qty_to_ship: validQty,
            qty_available: item.qty_available,
          },
        ]);
      }
    }
  };

  const handleQtyChange = (item: InventoryItem, qty: number) => {
    // Clamp qty between 0 and available
    const clampedQty = Math.max(0, Math.min(qty, item.qty_available));

    // Clear any error for this item
    const newErrors = { ...inputErrors };
    delete newErrors[item.id];
    setInputErrors(newErrors);

    // Update input value display
    setInputValues({ ...inputValues, [item.id]: clampedQty.toString() });

    if (clampedQty === 0) {
      setSelectedProducts(selectedProducts.filter((p) => p.inventory_id !== item.id));
    } else {
      const existing = selectedProducts.find((p) => p.inventory_id === item.id);
      if (existing) {
        setSelectedProducts(
          selectedProducts.map((p) =>
            p.inventory_id === item.id ? { ...p, qty_to_ship: clampedQty } : p
          )
        );
      } else {
        setSelectedProducts([
          ...selectedProducts,
          {
            inventory_id: item.id,
            product_id: item.product_id,
            product_name: item.product_name,
            sku: item.sku,
            qty_to_ship: clampedQty,
            qty_available: item.qty_available,
          },
        ]);
      }
    }
  };

  const getQtyForItem = (itemId: string) => {
    return selectedProducts.find((p) => p.inventory_id === itemId)?.qty_to_ship || 0;
  };

  const getInputValue = (itemId: string) => {
    if (inputValues[itemId] !== undefined) {
      return inputValues[itemId];
    }
    const qty = getQtyForItem(itemId);
    return qty > 0 ? qty.toString() : "";
  };

  const hasErrors = Object.keys(inputErrors).length > 0;

  const filteredItems = inventoryItems.filter(
    (item) =>
      item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalItems = selectedProducts.reduce((sum, p) => sum + p.qty_to_ship, 0);
  const totalProducts = selectedProducts.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Select Products</h2>
        <p className="text-sm text-gray-500 mt-1">
          Choose the products and quantities you want to ship
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Product List */}
      {filteredItems.length > 0 ? (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                  Product
                </th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">
                  Available
                </th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 w-40">
                  Qty to Ship
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const qty = getQtyForItem(item.id);
                const isSelected = qty > 0;
                const error = inputErrors[item.id];
                const inputValue = getInputValue(item.id);

                return (
                  <tr
                    key={item.id}
                    className={`border-b border-gray-100 last:border-0 ${
                      error ? "bg-red-50" : isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{item.product_name}</p>
                          <p className="text-sm text-gray-500 font-mono">{item.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-gray-600">{item.qty_available.toLocaleString()}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleQtyChange(item, qty - 1)}
                            disabled={qty === 0}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            -
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={inputValue}
                            onChange={(e) => validateAndSetQty(item, e.target.value)}
                            onBlur={() => {
                              // On blur, reset to valid value if there's an error
                              if (inputErrors[item.id]) {
                                const validQty = getQtyForItem(item.id);
                                setInputValues({ ...inputValues, [item.id]: validQty > 0 ? validQty.toString() : "" });
                                const newErrors = { ...inputErrors };
                                delete newErrors[item.id];
                                setInputErrors(newErrors);
                              }
                            }}
                            className={`w-16 text-center py-1.5 border rounded-lg focus:outline-none focus:ring-2 ${
                              error
                                ? "border-red-500 focus:ring-red-500 bg-red-50"
                                : "border-gray-200 focus:ring-blue-500"
                            }`}
                          />
                          <button
                            onClick={() => handleQtyChange(item, qty + 1)}
                            disabled={qty >= item.qty_available}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            +
                          </button>
                        </div>
                        {error && (
                          <div className="flex items-center gap-1 text-red-600 text-xs">
                            <AlertCircle className="w-3 h-3" />
                            <span>{error}</span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
          <Package className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">
            {searchQuery ? "No products match your search" : "No products available"}
          </p>
        </div>
      )}

      {/* Running Total */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
        <div>
          <p className="text-sm text-gray-500">Selected</p>
          <p className="font-semibold text-gray-900">
            {totalProducts} product{totalProducts !== 1 ? "s" : ""}, {totalItems.toLocaleString()} unit{totalItems !== 1 ? "s" : ""}
          </p>
        </div>
        {totalProducts > 0 && (
          <button
            onClick={() => setSelectedProducts([])}
            className="text-sm text-red-600 hover:text-red-700"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Error Summary */}
      {hasErrors && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">Please fix the quantity errors above before continuing.</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          onClick={onNext}
          disabled={totalProducts === 0 || hasErrors}
          className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue to Shipping
        </button>
      </div>
    </div>
  );
}

// Step 2: Shipping Details
function StepShippingDetails({
  onNext,
  onBack,
  savedAddresses,
  shippingAddress,
  setShippingAddress,
  additionalInfo,
  setAdditionalInfo,
}: {
  onNext: () => void;
  onBack: () => void;
  savedAddresses: ShippingAddress[];
  shippingAddress: ShippingAddress;
  setShippingAddress: (address: ShippingAddress) => void;
  additionalInfo: AdditionalInfo;
  setAdditionalInfo: (info: AdditionalInfo) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);

  const handleSelectAddress = (address: ShippingAddress) => {
    setShippingAddress(address);
    setIsEditing(false);
    setShowNewAddressForm(false);
  };

  const handleNewAddress = () => {
    setShippingAddress({
      id: "new",
      label: "",
      address_line1: "",
      address_line2: "",
      city: "",
      state: "",
      postal_code: "",
      country: "USA",
      is_default: false,
    });
    setShowNewAddressForm(true);
    setIsEditing(true);
  };

  const handleFieldChange = (field: keyof ShippingAddress, value: string) => {
    setShippingAddress({ ...shippingAddress, [field]: value });
  };

  const isFormValid = shippingAddress.address_line1 && shippingAddress.city &&
    shippingAddress.state && shippingAddress.postal_code;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Shipping Address</h2>
        <p className="text-sm text-gray-500 mt-1">
          Select or enter the delivery address for this shipment
        </p>
      </div>

      {/* Saved Addresses */}
      {savedAddresses.length > 0 && !showNewAddressForm && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Saved Addresses</p>
          <div className="grid gap-3">
            {savedAddresses.map((address) => (
              <button
                key={address.id}
                onClick={() => handleSelectAddress(address)}
                className={`
                  text-left p-4 rounded-xl border-2 transition-colors
                  ${shippingAddress.id === address.id && !isEditing
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Building2 className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{address.label || "Address"}</span>
                      {address.is_default && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {address.address_line1}
                      {address.address_line2 && `, ${address.address_line2}`}
                    </p>
                    <p className="text-sm text-gray-600">
                      {address.city}, {address.state} {address.postal_code}
                    </p>
                  </div>
                  {shippingAddress.id === address.id && !isEditing && (
                    <Check className="w-5 h-5 text-blue-600" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Add New Address Button */}
          <button
            onClick={handleNewAddress}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium mt-2"
          >
            <Plus className="w-4 h-4" />
            Use a different address
          </button>
        </div>
      )}

      {/* Address Form - Show if no saved addresses, editing, or adding new */}
      {(savedAddresses.length === 0 || isEditing || showNewAddressForm) && (
        <div className="space-y-4">
          {savedAddresses.length > 0 && showNewAddressForm && (
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">New Address</p>
              <button
                onClick={() => {
                  setShowNewAddressForm(false);
                  setIsEditing(false);
                  if (savedAddresses.length > 0) {
                    setShippingAddress(savedAddresses[0]);
                  }
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address Line 1 *
              </label>
              <input
                type="text"
                value={shippingAddress.address_line1}
                onChange={(e) => handleFieldChange("address_line1", e.target.value)}
                placeholder="Street address"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address Line 2
              </label>
              <input
                type="text"
                value={shippingAddress.address_line2}
                onChange={(e) => handleFieldChange("address_line2", e.target.value)}
                placeholder="Apt, suite, unit, etc. (optional)"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City *
              </label>
              <input
                type="text"
                value={shippingAddress.city}
                onChange={(e) => handleFieldChange("city", e.target.value)}
                placeholder="City"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State *
              </label>
              <input
                type="text"
                value={shippingAddress.state}
                onChange={(e) => handleFieldChange("state", e.target.value)}
                placeholder="State"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Postal Code *
              </label>
              <input
                type="text"
                value={shippingAddress.postal_code}
                onChange={(e) => handleFieldChange("postal_code", e.target.value)}
                placeholder="ZIP / Postal code"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Country
              </label>
              <input
                type="text"
                value={shippingAddress.country}
                onChange={(e) => handleFieldChange("country", e.target.value)}
                placeholder="Country"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      )}

      {/* Selected Address Preview (when not editing and address selected) */}
      {!isEditing && !showNewAddressForm && savedAddresses.length === 0 && shippingAddress.address_line1 && (
        <div className="p-4 bg-gray-50 rounded-xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Shipping to:</p>
              <p className="text-gray-900">{shippingAddress.address_line1}</p>
              {shippingAddress.address_line2 && (
                <p className="text-gray-900">{shippingAddress.address_line2}</p>
              )}
              <p className="text-gray-900">
                {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postal_code}
              </p>
              <p className="text-gray-600">{shippingAddress.country}</p>
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Edit
            </button>
          </div>
        </div>
      )}

      {/* Additional Info Section */}
      <div className="space-y-4 pt-6 border-t border-gray-200">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Additional Information</h3>
          <p className="text-sm text-gray-500 mt-1">
            Optional details to help us process your shipment
          </p>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Special Instructions
          </label>
          <textarea
            value={additionalInfo.notes}
            onChange={(e) => setAdditionalInfo({ ...additionalInfo, notes: e.target.value })}
            placeholder="Any special handling instructions, delivery notes, etc."
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Rush Order Checkbox */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="rushOrder"
            checked={additionalInfo.isRushOrder}
            onChange={(e) => setAdditionalInfo({ ...additionalInfo, isRushOrder: e.target.checked })}
            className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="rushOrder" className="cursor-pointer">
            <span className="block text-sm font-medium text-gray-900">Rush Order</span>
            <span className="block text-sm text-gray-500">
              Flag this shipment as urgent for priority processing
            </span>
          </label>
        </div>

        {/* Preferred Carrier */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Preferred Carrier
          </label>
          <select
            value={additionalInfo.preferredCarrier}
            onChange={(e) => setAdditionalInfo({ ...additionalInfo, preferredCarrier: e.target.value })}
            className="w-full sm:w-64 px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {CARRIERS.map((carrier) => (
              <option key={carrier.value} value={carrier.value}>
                {carrier.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            We'll do our best to accommodate your preference
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-gray-200">
        <button
          onClick={onBack}
          className="px-6 py-2.5 text-gray-600 font-medium rounded-xl hover:bg-gray-100 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!isFormValid}
          className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Review Order
        </button>
      </div>
    </div>
  );
}

// Step 3: Review & Submit
function StepReviewSubmit({
  onBack,
  onEditStep,
  shippingAddress,
  selectedProducts,
  additionalInfo,
  clientId,
}: {
  onBack: () => void;
  onEditStep: (step: Step) => void;
  shippingAddress: ShippingAddress;
  selectedProducts: SelectedProduct[];
  additionalInfo: AdditionalInfo;
  clientId: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<{ orderId: string; orderNumber: string } | null>(null);

  const totalItems = selectedProducts.reduce((sum, p) => sum + p.qty_to_ship, 0);

  // Generate order number: ORD-YYYYMMDD-XXXX
  const generateOrderNumber = () => {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${dateStr}-${randomSuffix}`;
  };

  // Validate all required data is present
  const validateSubmission = (): string | null => {
    if (selectedProducts.length === 0) {
      return "No products selected. Please go back and select products to ship.";
    }

    if (!shippingAddress.address_line1 || !shippingAddress.city || !shippingAddress.state || !shippingAddress.postal_code) {
      return "Shipping address is incomplete. Please go back and fill in all required fields.";
    }

    return null;
  };

  const handleSubmit = async () => {
    setSubmitError(null);

    // 1. Validate all sections complete
    const validationError = validateSubmission();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();

      // 2. Generate order number
      const orderNumber = generateOrderNumber();

      // 3. Create outbound order with status "pending"
      const { data: orderData, error: orderError } = await supabase
        .from("outbound_orders")
        .insert({
          client_id: clientId,
          order_number: orderNumber,
          status: "pending",
          ship_to_address: shippingAddress.address_line1,
          ship_to_address2: shippingAddress.address_line2 || null,
          ship_to_city: shippingAddress.city,
          ship_to_state: shippingAddress.state,
          ship_to_postal_code: shippingAddress.postal_code,
          ship_to_country: shippingAddress.country,
          notes: additionalInfo.notes || null,
          is_rush: additionalInfo.isRushOrder,
          preferred_carrier: additionalInfo.preferredCarrier || null,
        })
        .select("id")
        .single();

      if (orderError) {
        throw new Error(`Failed to create order: ${orderError.message}`);
      }

      const orderId = orderData.id;

      // 4. Create line items
      const lineItems = selectedProducts.map((product) => ({
        outbound_order_id: orderId,
        product_id: product.product_id,
        qty_requested: product.qty_to_ship,
        qty_picked: 0,
        status: "pending",
      }));

      const { error: itemsError } = await supabase
        .from("outbound_items")
        .insert(lineItems);

      if (itemsError) {
        // Attempt to clean up the order if line items fail
        await supabase.from("outbound_orders").delete().eq("id", orderId);
        throw new Error(`Failed to create order items: ${itemsError.message}`);
      }

      // 5. Show success confirmation
      setSubmitSuccess({ orderId, orderNumber });

      // 6. Redirect to confirmation page after a short delay
      setTimeout(() => {
        router.push(`/portal/request-shipment/confirmation?orderId=${orderId}`);
      }, 2000);

    } catch (error) {
      console.error("Error submitting order:", error);
      setSubmitError(error instanceof Error ? error.message : "An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Success state
  if (submitSuccess) {
    return (
      <div className="py-12 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Submitted!</h2>
        <p className="text-gray-600 mb-4">
          Your shipment request has been submitted successfully.
        </p>
        <div className="bg-gray-50 rounded-xl p-4 max-w-sm mx-auto mb-6">
          <p className="text-sm text-gray-500">Order Number</p>
          <p className="text-lg font-mono font-bold text-gray-900">{submitSuccess.orderNumber}</p>
        </div>
        <p className="text-sm text-gray-500">Redirecting to order details...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Review & Submit</h2>
        <p className="text-sm text-gray-500 mt-1">
          Review your order details before submitting
        </p>
      </div>

      {/* Products Summary */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-500" />
            <h3 className="font-medium text-gray-900">Products</h3>
          </div>
          <button
            onClick={() => onEditStep(1)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Edit
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                  Product
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                  SKU
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">
                  Qty to Ship
                </th>
              </tr>
            </thead>
            <tbody>
              {selectedProducts.map((product) => (
                <tr
                  key={product.inventory_id}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td className="py-3 px-4">
                    <span className="font-medium text-gray-900">{product.product_name}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-500 font-mono">{product.sku}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="font-semibold text-gray-900">{product.qty_to_ship.toLocaleString()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td colSpan={2} className="py-3 px-4 text-right">
                  <span className="font-medium text-gray-700">Total Units:</span>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="font-bold text-gray-900 text-lg">{totalItems.toLocaleString()}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Shipping Address Summary */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-500" />
            <h3 className="font-medium text-gray-900">Shipping Address</h3>
          </div>
          <button
            onClick={() => onEditStep(2)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Edit
          </button>
        </div>
        <div className="p-4">
          <p className="text-gray-900">{shippingAddress.address_line1}</p>
          {shippingAddress.address_line2 && (
            <p className="text-gray-900">{shippingAddress.address_line2}</p>
          )}
          <p className="text-gray-900">
            {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postal_code}
          </p>
          <p className="text-gray-500">{shippingAddress.country}</p>
        </div>
      </div>

      {/* Additional Info Summary */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-gray-500" />
            <h3 className="font-medium text-gray-900">Additional Details</h3>
          </div>
          <button
            onClick={() => onEditStep(2)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Edit
          </button>
        </div>
        <div className="p-4">
          {(additionalInfo.notes || additionalInfo.isRushOrder || additionalInfo.preferredCarrier) ? (
            <div className="space-y-3">
              {additionalInfo.isRushOrder && (
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                    Rush Order
                  </span>
                  <span className="text-sm text-gray-600">Priority processing requested</span>
                </div>
              )}
              {additionalInfo.preferredCarrier && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Preferred Carrier:</span>
                  <span className="text-sm text-gray-900 font-medium">
                    {CARRIERS.find((c) => c.value === additionalInfo.preferredCarrier)?.label || additionalInfo.preferredCarrier}
                  </span>
                </div>
              )}
              {additionalInfo.notes && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Special Instructions:</p>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                    {additionalInfo.notes}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">No additional details provided</p>
          )}
        </div>
      </div>

      {/* Error Display */}
      {submitError && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Unable to submit order</p>
            <p className="text-sm mt-1">{submitError}</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-gray-200">
        <button
          onClick={onBack}
          disabled={submitting}
          className="px-6 py-2.5 text-gray-600 font-medium rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-6 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Request"
          )}
        </button>
      </div>
    </div>
  );
}
