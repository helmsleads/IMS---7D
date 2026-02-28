"use client";

import { useEffect, useState, useCallback } from "react";
import { Package, Check, Truck, Boxes, ClipboardList, RotateCcw, Wrench, Star } from "lucide-react";
import { useClient } from "@/lib/client-auth";
import Card from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import FetchError from "@/components/ui/FetchError";
import { handleApiError } from "@/lib/utils/error-handler";
import {
  getPortalServices,
  getPortalServiceTiers,
  PortalService,
  PortalServiceTier,
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
  const { client } = useClient();
  const [services, setServices] = useState<PortalService[]>([]);
  const [tiers, setTiers] = useState<PortalServiceTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [servicesData, tiersData] = await Promise.all([
        getPortalServices(),
        getPortalServiceTiers(),
      ]);
      setServices(servicesData);
      setTiers(tiersData);
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

  const getTierPrice = (tier: PortalServiceTier, serviceId: string) => {
    const pricing = tier.pricing.find((p) => p.service_id === serviceId);
    if (!pricing) return null;
    if (pricing.is_custom) return "Custom";
    return formatPrice(pricing.price, pricing.price_unit);
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

      {/* Tier Comparison Table */}
      {tiers.length > 0 && services.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            Pricing by Tier
          </h2>
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left p-4 font-semibold text-slate-900 bg-slate-50">
                      Service
                    </th>
                    {tiers.map((tier) => {
                      const isCurrentTier = client?.service_tier_id === tier.id;
                      const isPopular = tier.is_popular;

                      return (
                        <th
                          key={tier.id}
                          className={`text-center p-4 font-semibold min-w-[140px] ${
                            isCurrentTier
                              ? "bg-cyan-50 text-cyan-900"
                              : "bg-slate-50 text-slate-900"
                          }`}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-2">
                              {tier.name}
                              {isCurrentTier && (
                                <span className="text-xs font-medium text-cyan-600">
                                  (Your Tier)
                                </span>
                              )}
                            </div>
                            {isPopular && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                                <Star className="w-3 h-3 fill-yellow-500" />
                                Popular
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {services.map((service, index) => (
                    <tr
                      key={service.id}
                      className={index !== services.length - 1 ? "border-b border-slate-100" : ""}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-cyan-100 rounded-lg text-cyan-600">
                            {getServiceIcon(service.icon)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {service.name}
                            </p>
                            {service.description && (
                              <p className="text-xs text-slate-500 max-w-[200px] truncate">
                                {service.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      {tiers.map((tier) => {
                        const isCurrentTier = client?.service_tier_id === tier.id;
                        const price = getTierPrice(tier, service.id);

                        return (
                          <td
                            key={tier.id}
                            className={`p-4 text-center ${
                              isCurrentTier ? "bg-cyan-50" : ""
                            }`}
                          >
                            {price ? (
                              <span
                                className={`font-medium ${
                                  price === "Custom"
                                    ? "text-cyan-600"
                                    : "text-slate-900"
                                }`}
                              >
                                {price}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
