"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, PlusCircle, Package, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import Alert from "@/components/ui/Alert";
import FetchError from "@/components/ui/FetchError";
import ServiceAddonForm from "@/components/internal/ServiceAddonForm";
import {
  getService,
  getServiceAddons,
  createServiceAddon,
  updateServiceAddon,
  deleteServiceAddon,
} from "@/lib/api/services";
import { Service, ServiceAddon } from "@/types/database";
import { handleApiError } from "@/lib/utils/error-handler";

const formatCurrency = (value: number | null) => {
  if (value === null) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
};

const formatPriceUnit = (unit: string | null) => {
  if (!unit) return "-";
  const units: Record<string, string> = {
    per_month: "Per Month",
    per_pallet: "Per Pallet",
    per_case: "Per Case",
    per_order: "Per Order",
    per_item: "Per Item",
    one_time: "One Time",
    flat: "Flat Rate",
  };
  return units[unit] || unit;
};

export default function ServiceAddonsPage() {
  const params = useParams();
  const router = useRouter();
  const serviceId = params.id as string;

  const [service, setService] = useState<Service | null>(null);
  const [addons, setAddons] = useState<ServiceAddon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAddon, setEditingAddon] = useState<ServiceAddon | null>(null);
  const [deletingAddon, setDeletingAddon] = useState<ServiceAddon | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [serviceData, addonsData] = await Promise.all([
        getService(serviceId),
        getServiceAddons(serviceId),
      ]);

      if (!serviceData) {
        setError("Service not found");
        return;
      }

      setService(serviceData);
      setAddons(addonsData);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (serviceId) {
      fetchData();
    }
  }, [serviceId]);

  const handleSaveAddon = async (addonData: Partial<ServiceAddon>) => {
    try {
      await createServiceAddon(addonData);
      await fetchData();
      setShowAddModal(false);
      setSuccessMessage("Add-on created successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Failed to create add-on:", error);
    }
  };

  const handleUpdateAddon = async (addonData: Partial<ServiceAddon>) => {
    if (!editingAddon) return;
    try {
      await updateServiceAddon(editingAddon.id, addonData);
      await fetchData();
      setEditingAddon(null);
      setSuccessMessage("Add-on updated successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Failed to update add-on:", error);
    }
  };

  const handleDeleteAddon = async () => {
    if (!deletingAddon) return;
    try {
      await deleteServiceAddon(deletingAddon.id);
      await fetchData();
      setDeletingAddon(null);
      setSuccessMessage("Add-on deleted successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Failed to delete add-on:", error);
    }
  };

  const columns = [
    { key: "name", header: "Name" },
    {
      key: "description",
      header: "Description",
      render: (addon: ServiceAddon) => (
        <span className="text-gray-500 truncate max-w-xs block">
          {addon.description || "-"}
        </span>
      ),
    },
    {
      key: "price",
      header: "Price",
      render: (addon: ServiceAddon) => formatCurrency(addon.price),
    },
    {
      key: "price_unit",
      header: "Price Unit",
      render: (addon: ServiceAddon) => formatPriceUnit(addon.price_unit),
    },
    {
      key: "status",
      header: "Status",
      render: (addon: ServiceAddon) => (
        <Badge
          variant={
            addon.status === "active"
              ? "success"
              : addon.status === "draft"
              ? "warning"
              : "default"
          }
        >
          {addon.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (addon: ServiceAddon) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingAddon(addon);
            }}
            className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeletingAddon(addon);
            }}
            className="p-1 text-gray-500 hover:text-red-600 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const filteredAddons = useMemo(() => {
    return addons.filter((addon) => {
      const search = searchTerm.toLowerCase();
      return (
        addon.name.toLowerCase().includes(search) ||
        addon.slug.toLowerCase().includes(search) ||
        (addon.description?.toLowerCase().includes(search) ?? false)
      );
    });
  }, [addons, searchTerm]);

  const backLink = (
    <Link
      href="/services"
      className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
    >
      <ArrowLeft className="w-4 h-4 mr-1" />
      Back to Services
    </Link>
  );

  if (error) {
    return (
      <AppShell title="Service Add-Ons">
        {backLink}
        <FetchError message={error} onRetry={fetchData} />
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell title="Loading...">
        {backLink}
        <Card>
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </Card>
      </AppShell>
    );
  }

  if (!service) {
    return (
      <AppShell title="Service Not Found">
        {backLink}
        <Card>
          <EmptyState
            icon={<Package className="w-12 h-12" />}
            title="Service not found"
            description="The service you're looking for doesn't exist"
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

  if (addons.length === 0 && !loading) {
    return (
      <AppShell
        title={`${service.name} Add-Ons`}
        subtitle="Manage optional add-ons for this service"
        actions={
          <Button onClick={() => setShowAddModal(true)}>
            <PlusCircle className="w-4 h-4 mr-2" />
            Add Add-On
          </Button>
        }
      >
        {backLink}
        <Card>
          <EmptyState
            icon={<Package className="w-12 h-12" />}
            title="No add-ons yet"
            description="Add your first add-on to this service"
            action={
              <Button onClick={() => setShowAddModal(true)}>Add Add-On</Button>
            }
          />
        </Card>
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add Add-On"
          size="lg"
        >
          <ServiceAddonForm
            serviceId={serviceId}
            onSave={handleSaveAddon}
            onCancel={() => setShowAddModal(false)}
          />
        </Modal>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={`${service.name} Add-Ons`}
      subtitle="Manage optional add-ons for this service"
      actions={
        <Button onClick={() => setShowAddModal(true)}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Add Add-On
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
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search add-ons..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <Card padding="none">
        <Table
          columns={columns}
          data={filteredAddons}
          loading={loading}
          emptyMessage="No add-ons found"
        />
      </Card>

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Add-On"
        size="lg"
      >
        <ServiceAddonForm
          serviceId={serviceId}
          onSave={handleSaveAddon}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>

      <Modal
        isOpen={!!editingAddon}
        onClose={() => setEditingAddon(null)}
        title="Edit Add-On"
        size="lg"
      >
        {editingAddon && (
          <ServiceAddonForm
            addon={editingAddon}
            serviceId={serviceId}
            onSave={handleUpdateAddon}
            onCancel={() => setEditingAddon(null)}
          />
        )}
      </Modal>

      <Modal
        isOpen={!!deletingAddon}
        onClose={() => setDeletingAddon(null)}
        title="Delete Add-On"
        size="sm"
      >
        <p className="text-gray-600 mb-4">
          Are you sure you want to delete <strong>{deletingAddon?.name}</strong>? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeletingAddon(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteAddon}>
            Delete
          </Button>
        </div>
      </Modal>
    </AppShell>
  );
}
