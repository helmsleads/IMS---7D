"use client";

import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { useClient } from "@/lib/client-auth";
import Card from "@/components/ui/Card";
import { getMyPlan, MyPlan } from "@/lib/api/portal-services";

export default function PortalPlanPage() {
  const { client } = useClient();
  const [myPlan, setMyPlan] = useState<MyPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!client) return;

      try {
        const planData = await getMyPlan(client.id);
        setMyPlan(planData);
      } catch (error) {
        console.error("Failed to fetch plan data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [client]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Plan</h1>
        <p className="text-slate-500 mt-1">
          View your current service plan
        </p>
      </div>

      <div className="space-y-6">
          {/* Services Included */}
          <Card>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Services Included
                </h2>
                <p className="text-sm text-gray-500">
                  Active services in your plan
                </p>
              </div>
              {myPlan && myPlan.totalMonthlyEstimate > 0 && (
                <div className="text-right">
                  <p className="text-sm text-gray-500">Est. Monthly Total</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(myPlan.totalMonthlyEstimate)}
                  </p>
                </div>
              )}
            </div>

            {myPlan && myPlan.services.filter((s) => s.is_active).length > 0 ? (
              <div className="divide-y divide-gray-100">
                {myPlan.services
                  .filter((s) => s.is_active)
                  .map((service) => (
                    <div key={service.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {service.service_name}
                          </p>
                          {service.service_description && (
                            <p className="text-sm text-gray-500 mt-0.5">
                              {service.service_description}
                            </p>
                          )}
                          {service.started_at && (
                            <p className="text-xs text-gray-400 mt-1">
                              Effective since {formatDate(service.started_at)}
                            </p>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          {service.effective_price !== null ? (
                            <p className="font-semibold text-gray-900">
                              {formatCurrency(service.effective_price)}
                              {service.effective_price_unit && (
                                <span className="text-sm font-normal text-gray-500">
                                  /{service.effective_price_unit}
                                </span>
                              )}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-500">Custom pricing</p>
                          )}
                        </div>
                      </div>

                      {/* Add-ons for this service */}
                      {service.addons.filter((a) => a.is_active).length > 0 && (
                        <div className="mt-3 pl-4 border-l-2 border-gray-200">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                            Add-ons Enabled
                          </p>
                          <div className="space-y-2">
                            {service.addons
                              .filter((a) => a.is_active)
                              .map((addon) => (
                                <div
                                  key={addon.id}
                                  className="flex items-center justify-between"
                                >
                                  <span className="text-sm text-gray-600">
                                    {addon.addon_name}
                                  </span>
                                  {addon.effective_price !== null && (
                                    <span className="text-sm font-medium text-gray-700">
                                      +{formatCurrency(addon.effective_price)}
                                    </span>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <p>No active services</p>
                <a
                  href="/portal/messages"
                  className="text-cyan-600 hover:underline text-sm mt-1 inline-block"
                >
                  Contact us to get started
                </a>
              </div>
            )}
          </Card>

          {/* Contact Note */}
          <Card className="bg-blue-50 border-blue-100">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CreditCard className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">
                  Need to change your plan?
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  To upgrade, downgrade, or modify your service plan, please contact
                  the 7 Degrees team. We&apos;ll help you find the best solution for
                  your business needs.
                </p>
                <a
                  href="/portal/messages"
                  className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Contact Us
                  <span aria-hidden="true">→</span>
                </a>
              </div>
            </div>
          </Card>
        </div>
    </div>
  );
}
