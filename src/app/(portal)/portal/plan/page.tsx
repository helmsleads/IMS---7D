"use client";

import { useEffect, useState } from "react";
import {
  CreditCard,
  FileText,
  Check,
  Download,
  Eye,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useClient } from "@/lib/client-auth";
import Card from "@/components/ui/Card";
import { getMyPlan, MyPlan } from "@/lib/api/portal-services";
import {
  getMyInvoices,
  getMyInvoiceSummary,
  PortalInvoice,
  InvoiceSummary,
} from "@/lib/api/portal-billing";

type TabType = "plan" | "invoices";

export default function PortalPlanPage() {
  const { client } = useClient();
  const [activeTab, setActiveTab] = useState<TabType>("plan");
  const [myPlan, setMyPlan] = useState<MyPlan | null>(null);
  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [invoiceSummary, setInvoiceSummary] = useState<InvoiceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!client) return;

      try {
        const [planData, invoicesData, summaryData] = await Promise.all([
          getMyPlan(client.id),
          getMyInvoices(client.id),
          getMyInvoiceSummary(client.id),
        ]);

        setMyPlan(planData);
        setInvoices(invoicesData);
        setInvoiceSummary(summaryData);
      } catch (error) {
        console.error("Failed to fetch data:", error);
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

  const getStatusBadge = (status: string, dueDate: string | null) => {
    const today = new Date().toISOString().split("T")[0];
    const isOverdue = status === "sent" && dueDate && dueDate < today;

    if (status === "paid") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
          <CheckCircle className="w-3 h-3" />
          Paid
        </span>
      );
    }

    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
          <AlertCircle className="w-3 h-3" />
          Overdue
        </span>
      );
    }

    if (status === "sent") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
          <Clock className="w-3 h-3" />
          Due
        </span>
      );
    }

    if (status === "cancelled") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
          <XCircle className="w-3 h-3" />
          Cancelled
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium capitalize">
        {status}
      </span>
    );
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
        <h1 className="text-2xl font-bold text-gray-900">My Plan & Billing</h1>
        <p className="text-gray-500 mt-1">
          Manage your service plan and view invoices
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("plan")}
          className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
            activeTab === "plan"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          My Plan
        </button>
        <button
          onClick={() => setActiveTab("invoices")}
          className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
            activeTab === "invoices"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <FileText className="w-4 h-4" />
          Invoices
        </button>
      </div>

      {/* My Plan Tab */}
      {activeTab === "plan" && (
        <div className="space-y-6">
          {/* Current Tier */}
          <Card>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Current Plan
                </h2>
                <p className="text-sm text-gray-500">
                  Your active service tier
                </p>
              </div>
              {myPlan?.tier && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  {myPlan.tier.name}
                </span>
              )}
            </div>

            {myPlan?.tier ? (
              <>
                {myPlan.tier.description && (
                  <p className="text-gray-600 mb-4">{myPlan.tier.description}</p>
                )}

                {myPlan.tier.features && myPlan.tier.features.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                      Plan Features
                    </h3>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {myPlan.tier.features.map((feature, index) => (
                        <li
                          key={index}
                          className="flex items-center gap-2 text-sm text-gray-600"
                        >
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <CreditCard className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>No service tier assigned</p>
                <a
                  href="/portal/services"
                  className="text-blue-600 hover:underline text-sm mt-1 inline-block"
                >
                  View available service tiers
                </a>
              </div>
            )}
          </Card>

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
                  href="/portal/services"
                  className="text-blue-600 hover:underline text-sm mt-1 inline-block"
                >
                  Browse available services
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
      )}

      {/* Invoices Tab */}
      {activeTab === "invoices" && (
        <div className="space-y-6">
          {/* Invoice Summary */}
          {invoiceSummary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <p className="text-sm text-gray-500">Total Invoices</p>
                <p className="text-2xl font-bold text-gray-900">
                  {invoiceSummary.totalInvoices}
                </p>
              </Card>
              <Card>
                <p className="text-sm text-gray-500">Total Paid</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(invoiceSummary.totalPaid)}
                </p>
              </Card>
              <Card>
                <p className="text-sm text-gray-500">Outstanding</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(invoiceSummary.totalOutstanding)}
                </p>
              </Card>
              <Card>
                <p className="text-sm text-gray-500">Overdue</p>
                <p className={`text-2xl font-bold ${invoiceSummary.overdueCount > 0 ? "text-red-600" : "text-gray-900"}`}>
                  {invoiceSummary.overdueCount > 0
                    ? formatCurrency(invoiceSummary.overdueAmount)
                    : "$0.00"}
                </p>
                {invoiceSummary.overdueCount > 0 && (
                  <p className="text-xs text-red-500">
                    {invoiceSummary.overdueCount} invoice{invoiceSummary.overdueCount !== 1 ? "s" : ""}
                  </p>
                )}
              </Card>
            </div>
          )}

          {/* Invoice List */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Invoice History
            </h2>

            {invoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                        Invoice
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                        Period
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                        Due Date
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                        Amount
                      </th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">
                        Status
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr
                        key={invoice.id}
                        className="border-b border-gray-100 last:border-0"
                      >
                        <td className="py-3 px-4">
                          <p className="font-medium text-gray-900">
                            {invoice.invoice_number}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {formatDate(invoice.period_start)} -{" "}
                          {formatDate(invoice.period_end)}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {formatDate(invoice.due_date)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-gray-900">
                          {formatCurrency(invoice.total)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {getStatusBadge(invoice.status, invoice.due_date)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <a
                              href={`/portal/plan/invoice/${invoice.id}`}
                              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                              <Eye className="w-4 h-4" />
                              View
                            </a>
                            <a
                              href={`/portal/plan/invoice/${invoice.id}/pdf`}
                              className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-700 font-medium"
                            >
                              <Download className="w-4 h-4" />
                              PDF
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No invoices yet</p>
                <p className="text-sm mt-1">
                  Invoices will appear here once generated
                </p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
