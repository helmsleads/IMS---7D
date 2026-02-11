"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Briefcase,
  Package,
  Truck,
  Warehouse,
  Box,
  ClipboardList,
  Settings,
  Shield,
  Zap,
  Users,
  Archive,
  BarChart,
  Calendar,
  Clock,
  Database,
  FileText,
  Globe,
  Home,
  Layers,
  Map,
  Send,
  ShoppingCart,
  Tag,
  Target,
} from "lucide-react";
import Link from "next/link";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Alert from "@/components/ui/Alert";
import FetchError from "@/components/ui/FetchError";
import {
  getServiceTier,
  getServices,
  getServiceTierPricing,
  setServiceTierPrice,
  ServiceWithAddons,
} from "@/lib/api/services";
import { ServiceTier, ServiceTierPricing } from "@/types/database";
import { handleApiError } from "@/lib/utils/error-handler";

const iconMap: Record<string, React.ReactNode> = {
  Briefcase: <Briefcase className="w-6 h-6" />,
  Package: <Package className="w-6 h-6" />,
  Truck: <Truck className="w-6 h-6" />,
  Warehouse: <Warehouse className="w-6 h-6" />,
  Box: <Box className="w-6 h-6" />,
  ClipboardList: <ClipboardList className="w-6 h-6" />,
  Settings: <Settings className="w-6 h-6" />,
  Shield: <Shield className="w-6 h-6" />,
  Zap: <Zap className="w-6 h-6" />,
  Users: <Users className="w-6 h-6" />,
  Archive: <Archive className="w-6 h-6" />,
  BarChart: <BarChart className="w-6 h-6" />,
  Calendar: <Calendar className="w-6 h-6" />,
  Clock: <Clock className="w-6 h-6" />,
  Database: <Database className="w-6 h-6" />,
  FileText: <FileText className="w-6 h-6" />,
  Globe: <Globe className="w-6 h-6" />,
  Home: <Home className="w-6 h-6" />,
  Layers: <Layers className="w-6 h-6" />,
  Map: <Map className="w-6 h-6" />,
  Send: <Send className="w-6 h-6" />,
  ShoppingCart: <ShoppingCart className="w-6 h-6" />,
  Tag: <Tag className="w-6 h-6" />,
  Target: <Target className="w-6 h-6" />,
};

const getServiceIcon = (iconName: string | null) => {
  if (iconName && iconMap[iconName]) {
    return iconMap[iconName];
  }
  return <Briefcase className="w-6 h-6" />;
};

const priceUnitOptions = [
  { value: "", label: "Use base price unit" },
  { value: "per_month", label: "Per Month" },
  { value: "per_pallet", label: "Per Pallet" },
  { value: "per_case", label: "Per Case" },
  { value: "per_order", label: "Per Order" },
  { value: "per_item", label: "Per Item" },
  { value: "per_case_month", label: "Per Case/Month" },
  { value: "per_pallet_month", label: "Per Pallet/Month" },
  { value: "flat", label: "Flat Rate" },
];

const formatCurrency = (value: number | null) => {
  if (value === null) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
};

const formatPriceUnit = (unit: string | null) => {
  if (!unit) return "";
  const units: Record<string, string> = {
    per_month: "/month",
    per_pallet: "/pallet",
    per_case: "/case",
    per_order: "/order",
    per_item: "/item",
    per_case_month: "/case/month",
    per_pallet_month: "/pallet/month",
    flat: " (flat)",
  };
  return units[unit] || unit;
};

interface ServicePricing {
  serviceId: string;
  price: string;
  priceUnit: string;
  isCustom: boolean;
}

export default function TierPricingPage() {
  const params = useParams();
  const router = useRouter();
  const tierId = params.id as string;

  const [tier, setTier] = useState<ServiceTier | null>(null);
  const [services, setServices] = useState<ServiceWithAddons[]>([]);
  const [existingPricing, setExistingPricing] = useState<ServiceTierPricing[]>([]);
  const [pricing, setPricing] = useState<Record<string, ServicePricing>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tierData, servicesData, pricingData] = await Promise.all([
        getServiceTier(tierId),
        getServices(),
        getServiceTierPricing(tierId),
      ]);

      if (!tierData) {
        setError("Tier not found");
        return;
      }

      setTier(tierData);
      setServices(servicesData);
      setExistingPricing(pricingData);

      // Initialize pricing state
      const initialPricing: Record<string, ServicePricing> = {};
      servicesData.forEach((service) => {
        const existing = pricingData.find((p) => p.service_id === service.id);
        initialPricing[service.id] = {
          serviceId: service.id,
          price: existing?.price?.toString() ?? "",
          priceUnit: existing?.price_unit ?? "",
          isCustom: existing?.is_custom ?? false,
        };
      });
      setPricing(initialPricing);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tierId) {
      fetchData();
    }
  }, [tierId]);

  const handlePriceChange = (serviceId: string, value: string) => {
    setPricing((prev) => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        price: value,
      },
    }));
  };

  const handlePriceUnitChange = (serviceId: string, value: string) => {
    setPricing((prev) => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        priceUnit: value,
      },
    }));
  };

  const handleCustomToggle = (serviceId: string, checked: boolean) => {
    setPricing((prev) => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        isCustom: checked,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.values(pricing).map((p) => {
        const price = p.price === "" ? null : parseFloat(p.price);
        const priceUnit = p.priceUnit || null;
        return setServiceTierPrice(p.serviceId, tierId, price, priceUnit);
      });

      await Promise.all(updates);
      setSuccessMessage("Pricing saved successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const backLink = (
    <Link
      href="/services/tiers"
      className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
    >
      <ArrowLeft className="w-4 h-4 mr-1" />
      Back to Tiers
    </Link>
  );

  if (error && !tier) {
    return (
      <AppShell title="Tier Pricing">
        {backLink}
        <FetchError message={error} onRetry={fetchData} />
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell title="Loading...">
        {backLink}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gray-200 rounded"></div>
                <div className="h-5 bg-gray-200 rounded w-2/3"></div>
              </div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </AppShell>
    );
  }

  if (!tier) {
    return (
      <AppShell title="Tier Not Found">
        {backLink}
        <Card>
          <EmptyState
            icon={<Layers className="w-12 h-12" />}
            title="Tier not found"
            description="The tier you're looking for doesn't exist"
            action={
              <Button onClick={() => router.push("/services/tiers")}>
                Go to Tiers
              </Button>
            }
          />
        </Card>
      </AppShell>
    );
  }

  if (services.length === 0) {
    return (
      <AppShell
        title={`${tier.name} Pricing`}
        subtitle="Configure service pricing for this tier"
      >
        {backLink}
        <Card>
          <EmptyState
            icon={<Package className="w-12 h-12" />}
            title="No services available"
            description="Create services first to configure tier pricing"
            action={
              <Button onClick={() => router.push("/services")}>
                Go to Services
              </Button>
            }
          />
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={`${tier.name} Pricing`}
      subtitle="Configure service pricing for this tier"
      actions={
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving..." : "Save All Pricing"}
        </Button>
      }
    >
      {backLink}
      {successMessage && (
        <div className="mb-4">
          <Alert
            type="success"
            message={successMessage}
            onClose={() => setSuccessMessage("")}
          />
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Alert
            type="error"
            message={error}
            onClose={() => setError(null)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((service) => {
          const servicePricing = pricing[service.id] || {
            serviceId: service.id,
            price: "",
            priceUnit: "",
            isCustom: false,
          };

          return (
            <div
              key={service.id}
              className="bg-white rounded-lg shadow-md overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-blue-600">
                    {getServiceIcon(service.icon)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{service.name}</h3>
                    <p className="text-sm text-gray-500">
                      Base: {formatCurrency(service.base_price)}
                      {service.price_unit && (
                        <span>{formatPriceUnit(service.price_unit)}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor={`price-${service.id}`}
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Tier Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        $
                      </span>
                      <input
                        id={`price-${service.id}`}
                        type="number"
                        value={servicePricing.price}
                        onChange={(e) => handlePriceChange(service.id, e.target.value)}
                        placeholder={service.base_price?.toString() || "0.00"}
                        min={0}
                        step={0.01}
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor={`unit-${service.id}`}
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Price Unit
                    </label>
                    <select
                      id={`unit-${service.id}`}
                      value={servicePricing.priceUnit}
                      onChange={(e) => handlePriceUnitChange(service.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {priceUnitOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id={`custom-${service.id}`}
                      checked={servicePricing.isCustom}
                      onChange={(e) => handleCustomToggle(service.id, e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label
                      htmlFor={`custom-${service.id}`}
                      className="text-sm text-gray-600"
                    >
                      Custom pricing (overrides defaults)
                    </label>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving..." : "Save All Pricing"}
        </Button>
      </div>
    </AppShell>
  );
}
