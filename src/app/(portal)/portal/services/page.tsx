"use client";

import { useEffect, useState, useCallback } from "react";
import { Package, Check, Truck, Boxes, ClipboardList, RotateCcw, Wrench } from "lucide-react";
import Card from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import FetchError from "@/components/ui/FetchError";
import { handleApiError } from "@/lib/utils/error-handler";
import {
  getPortalServices,
  PortalService,
} from "@/lib/api/portal-services";

// Map icon names to components
const iconMap: Record<string, React.ReactNode> = {
  package: <Package className="w-6 h-6" />,
  truck: <Truck className="w-6 h-6" />,
  boxes: <Boxes className="w-6 h-6" />,
  clipboard: <ClipboardList className="w-6 h-6" />,
  returns: <RotateCcw className="w-6 h-6" />,
  wrench: <Wrench className="w-6 h-6" />,
};

export default function PortalServicesPage() {
  const [services, setServices] = useState<PortalService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const servicesData = await getPortalServices();
      setServices(servicesData);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatPrice = (price: number | null, unit: string | null) => {
    if (price === null) return "Custom";
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(price);
    return unit ? `${formatted}/${unit}` : formatted;
  };

  const getServiceIcon = (iconName: string | null) => {
    if (iconName && iconMap[iconName.toLowerCase()]) {
      return iconMap[iconName.toLowerCase()];
    }
    return <Package className="w-6 h-6" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <FetchError message={error} onRetry={fetchData} />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Our Services</h1>
        <p className="text-slate-500 mt-1">
          Explore our comprehensive fulfillment and storage services
        </p>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((service) => (
          <Card key={service.id}>
            {/* Icon */}
            <div className="p-3 bg-cyan-100 rounded-lg text-cyan-600 w-fit mb-4">
              {getServiceIcon(service.icon)}
            </div>

            {/* Name */}
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {service.name}
            </h3>

            {/* Description */}
            {service.description && (
              <p className="text-slate-600 text-sm mb-4">{service.description}</p>
            )}

            {/* Features List */}
            {service.features && service.features.length > 0 && (
              <ul className="space-y-2 mb-4">
                {service.features.map((feature, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-slate-600"
                  >
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Starting Price */}
            {service.base_price !== null && (
              <div className="pt-4 border-t border-slate-100">
                <p className="text-sm text-slate-500">
                  Starting at{" "}
                  <span className="font-semibold text-slate-900">
                    {formatPrice(service.base_price, service.price_unit)}
                  </span>
                </p>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Empty State for Services */}
      {services.length === 0 && (
        <Card>
          <div className="text-center py-12 text-slate-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No services available at this time.</p>
          </div>
        </Card>
      )}

    </div>
  );
}
