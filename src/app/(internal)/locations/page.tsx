"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, MapPin, Pencil, Trash2 } from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Alert from "@/components/ui/Alert";
import Modal from "@/components/ui/Modal";
import LocationForm from "@/components/internal/LocationForm";
import {
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  Location,
} from "@/lib/api/locations";
import { getInventory, InventoryWithDetails } from "@/lib/api/inventory";

interface LocationWithStats extends Location {
  totalSKUs: number;
  totalUnits: number;
}

export default function LocationsPage() {
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>([]);
  const [inventory, setInventory] = useState<InventoryWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  const fetchData = async () => {
    try {
      const [locationsData, inventoryData] = await Promise.all([
        getLocations(),
        getInventory(),
      ]);
      setLocations(locationsData);
      setInventory(inventoryData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const locationsWithStats: LocationWithStats[] = useMemo(() => {
    return locations.map((location) => {
      const locationInventory = inventory.filter(
        (item) => item.location_id === location.id
      );
      return {
        ...location,
        totalSKUs: locationInventory.length,
        totalUnits: locationInventory.reduce((sum, item) => sum + item.qty_on_hand, 0),
      };
    });
  }, [locations, inventory]);

  const openAddModal = () => {
    setEditingLocation(null);
    setShowModal(true);
  };

  const openEditModal = (location: Location) => {
    setEditingLocation(location);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingLocation(null);
  };

  const handleSave = async (data: Partial<Location>) => {
    try {
      if (editingLocation) {
        await updateLocation(editingLocation.id, data);
        setSuccessMessage("Location updated successfully");
      } else {
        await createLocation(data as Omit<Location, "id" | "created_at">);
        setSuccessMessage("Location created successfully");
      }
      await fetchData();
      closeModal();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save location");
    }
  };

  const handleDelete = async (location?: LocationWithStats) => {
    const locationToDelete = location || editingLocation;
    if (!locationToDelete) return;

    setDeletingId(locationToDelete.id);
    setErrorMessage("");

    try {
      await deleteLocation(locationToDelete.id);
      await fetchData();
      closeModal();
      setSuccessMessage(`Location "${locationToDelete.name}" deleted successfully`);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete location");
    } finally {
      setDeletingId(null);
    }
  };

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (location: LocationWithStats) => (
        <span className="font-medium text-gray-900">{location.name}</span>
      ),
    },
    {
      key: "address",
      header: "Address",
      render: (location: LocationWithStats) => (
        <span className="text-gray-600">
          {location.city || location.state
            ? [location.city, location.state].filter(Boolean).join(", ")
            : <span className="text-gray-400">—</span>}
        </span>
      ),
    },
    {
      key: "active",
      header: "Status",
      render: (location: LocationWithStats) => (
        <Badge variant={location.active ? "success" : "default"}>
          {location.active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "totalSKUs",
      header: "Total SKUs",
      render: (location: LocationWithStats) => (
        <span className="text-gray-900">{location.totalSKUs}</span>
      ),
    },
    {
      key: "totalUnits",
      header: "Total Units",
      render: (location: LocationWithStats) => (
        <span className="font-medium text-gray-900">
          {location.totalUnits.toLocaleString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (location: LocationWithStats) => {
        const isDeleting = deletingId === location.id;
        return (
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                openEditModal(location);
              }}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(location);
              }}
              disabled={isDeleting}
              loading={isDeleting}
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        );
      },
    },
  ];

  const actionButtons = (
    <Button onClick={openAddModal}>
      <Plus className="w-4 h-4 mr-1" />
      Add Location
    </Button>
  );

  if (!loading && locations.length === 0) {
    return (
      <AppShell title="Locations" actions={actionButtons}>
        <Card>
          <EmptyState
            icon={<MapPin className="w-12 h-12" />}
            title="No locations yet"
            description="Add your first warehouse or store location to get started"
            action={
              <Button onClick={openAddModal}>
                <Plus className="w-4 h-4 mr-1" />
                Add Location
              </Button>
            }
          />
        </Card>

        <Modal
          isOpen={showModal}
          onClose={closeModal}
          title="Add Location"
          size="md"
        >
          <LocationForm
            onSave={handleSave}
            onCancel={closeModal}
          />
        </Modal>
      </AppShell>
    );
  }

  return (
    <AppShell title="Locations" actions={actionButtons}>
      {successMessage && (
        <div className="mb-4">
          <Alert
            type="success"
            message={successMessage}
            onClose={() => setSuccessMessage("")}
          />
        </div>
      )}

      {errorMessage && (
        <div className="mb-4">
          <Alert
            type="error"
            message={errorMessage}
            onClose={() => setErrorMessage("")}
          />
        </div>
      )}

      <Card padding="none">
        <Table
          columns={columns}
          data={locationsWithStats}
          loading={loading}
          emptyMessage="No locations found"
          onRowClick={(location) => router.push(`/locations/${location.id}`)}
        />
      </Card>

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingLocation ? "Edit Location" : "Add Location"}
        size="md"
      >
        <LocationForm
          location={editingLocation || undefined}
          onSave={handleSave}
          onCancel={closeModal}
          onDelete={editingLocation ? () => handleDelete() : undefined}
        />
      </Modal>
    </AppShell>
  );
}
