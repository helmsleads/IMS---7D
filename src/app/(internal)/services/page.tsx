"use client";

import { useEffect, useMemo, useState } from "react";
import {
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
  Edit,
  Plus,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import Alert from "@/components/ui/Alert";
import FetchError from "@/components/ui/FetchError";
import ServiceForm from "@/components/internal/ServiceForm";
import {
  getServices,
  createService,
  updateService,
  deleteService,
  ServiceWithAddons,
} from "@/lib/api/services";
import { Service } from "@/types/database";
import { handleApiError } from "@/lib/utils/error-handler";
import { createClient } from "@/lib/supabase";

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
    flat: " (flat)",
  };
  return units[unit] || unit;
};

const iconMap: Record<string, React.ReactNode> = {
  Package: <Package className="w-8 h-8" />,
  Truck: <Truck className="w-8 h-8" />,
  Warehouse: <Warehouse className="w-8 h-8" />,
  Box: <Box className="w-8 h-8" />,
  ClipboardList: <ClipboardList className="w-8 h-8" />,
  Settings: <Settings className="w-8 h-8" />,
  Shield: <Shield className="w-8 h-8" />,
  Zap: <Zap className="w-8 h-8" />,
  Briefcase: <Briefcase className="w-8 h-8" />,
};

const getServiceIcon = (iconName: string | null) => {
  if (iconName && iconMap[iconName]) {
    return iconMap[iconName];
  }
  return <Briefcase className="w-8 h-8" />;
};

interface ServiceWithClientCount extends ServiceWithAddons {
  activeClientCount: number;
}

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceWithClientCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingService, setEditingService] = useState<ServiceWithClientCount | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const fetchServices = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const data = await getServices();

      // Get active client counts for each service
      const serviceIds = data.map((s) => s.id);
      const { data: clientServices } = await supabase
        .from("client_services")
        .select("service_id")
        .in("service_id", serviceIds)
        .eq("is_active", true);

      // Count clients per service
      const clientCounts: Record<string, number> = {};
      (clientServices || []).forEach((cs) => {
        clientCounts[cs.service_id] = (clientCounts[cs.service_id] || 0) + 1;
      });

      const servicesWithCounts = data.map((service) => ({
        ...service,
        activeClientCount: clientCounts[service.id] || 0,
      }));

      setServices(servicesWithCounts);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleSaveService = async (serviceData: Partial<Service>) => {
    try {
      await createService(serviceData);
      await fetchServices();
      setShowAddModal(false);
      setSuccessMessage("Service created successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Failed to create service:", error);
    }
  };

  const handleUpdateService = async (serviceData: Partial<Service>) => {
    if (!editingService) return;
    try {
      await updateService(editingService.id, serviceData);
      await fetchServices();
      setEditingService(null);
      setSuccessMessage("Service updated successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Failed to update service:", error);
    }
  };

  const handleDeleteService = async () => {
    if (!editingService) return;
    try {
      await deleteService(editingService.id);
      await fetchServices();
      setEditingService(null);
      setSuccessMessage("Service deleted successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Failed to delete service:", error);
    }
  };

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const search = searchTerm.toLowerCase();
      return (
        service.name.toLowerCase().includes(search) ||
        service.slug.toLowerCase().includes(search) ||
        (service.description?.toLowerCase().includes(search) ?? false)
      );
    });
  }, [services, searchTerm]);

  if (!loading && services.length === 0) {
    return (
      <AppShell
        title="Services"
        subtitle="Manage services offered to clients"
        actions={<Button onClick={() => setShowAddModal(true)}>Add Service</Button>}
      >
        <Card>
          <EmptyState
            icon={<Briefcase className="w-12 h-12" />}
            title="No services yet"
            description="Add your first service to get started"
            action={<Button onClick={() => setShowAddModal(true)}>Add Service</Button>}
          />
        </Card>
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add Service"
          size="lg"
        >
          <ServiceForm
            onSave={handleSaveService}
            onCancel={() => setShowAddModal(false)}
          />
        </Modal>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Services" subtitle="Manage services offered to clients">
        <FetchError message={error} onRetry={fetchServices} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Services"
      subtitle="Manage services offered to clients"
      actions={<Button onClick={() => setShowAddModal(true)}>Add Service</Button>}
    >
      {successMessage && (
        <div className="mb-4">
          <Alert
            type="success"
            message={successMessage}
            onClose={() => setSuccessMessage("")}
          />
        </div>
      )}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search services..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
              <div className="h-8 w-8 bg-gray-200 rounded mb-4"></div>
              <div className="h-6 bg-gray-200 rounded w-2/3 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-full mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="text-blue-600">
                    {getServiceIcon(service.icon)}
                  </div>
                  <Badge variant={service.status === "active" ? "success" : "default"}>
                    {service.status}
                  </Badge>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {service.name}
                </h3>

                <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                  {service.description || "No description"}
                </p>

                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-xl font-bold text-gray-900">
                      {formatCurrency(service.base_price)}
                    </span>
                    {service.price_unit && (
                      <span className="text-sm text-gray-500">
                        {formatPriceUnit(service.price_unit)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center text-sm text-gray-500 mb-4">
                  <Users className="w-4 h-4 mr-1" />
                  <span>
                    {service.activeClientCount} active{" "}
                    {service.activeClientCount === 1 ? "client" : "clients"}
                  </span>
                </div>

                <div className="flex gap-2 pt-4 border-t border-gray-100">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditingService(service)}
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => window.location.href = `/services/${service.id}/addons`}
                    className="flex-1"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add-Ons ({service.service_addons?.length || 0})
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filteredServices.length === 0 && services.length > 0 && (
        <Card>
          <EmptyState
            icon={<Briefcase className="w-12 h-12" />}
            title="No services found"
            description="Try adjusting your search"
          />
        </Card>
      )}

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Service"
        size="lg"
      >
        <ServiceForm
          onSave={handleSaveService}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>

      <Modal
        isOpen={!!editingService}
        onClose={() => setEditingService(null)}
        title="Edit Service"
        size="lg"
      >
        {editingService && (
          <ServiceForm
            service={editingService}
            onSave={handleUpdateService}
            onCancel={() => setEditingService(null)}
            onDelete={handleDeleteService}
          />
        )}
      </Modal>
    </AppShell>
  );
}
