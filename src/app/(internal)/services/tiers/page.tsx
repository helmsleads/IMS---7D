"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers, Star, Users, Settings, Edit } from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import Alert from "@/components/ui/Alert";
import FetchError from "@/components/ui/FetchError";
import ServiceTierForm from "@/components/internal/ServiceTierForm";
import {
  getServiceTiers,
  createServiceTier,
  updateServiceTier,
  deleteServiceTier,
} from "@/lib/api/services";
import { ServiceTier } from "@/types/database";
import { handleApiError } from "@/lib/utils/error-handler";
import { createClient } from "@/lib/supabase";

interface TierWithClientCount extends ServiceTier {
  clientCount: number;
}

export default function ServiceTiersPage() {
  const [tiers, setTiers] = useState<TierWithClientCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTier, setEditingTier] = useState<TierWithClientCount | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const fetchTiers = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const data = await getServiceTiers();

      // Get client counts for each tier
      const tierIds = data.map((t) => t.id);
      const { data: clientServices } = await supabase
        .from("client_services")
        .select("tier_id")
        .in("tier_id", tierIds)
        .eq("is_active", true);

      // Count clients per tier
      const clientCounts: Record<string, number> = {};
      (clientServices || []).forEach((cs) => {
        if (cs.tier_id) {
          clientCounts[cs.tier_id] = (clientCounts[cs.tier_id] || 0) + 1;
        }
      });

      const tiersWithCounts = data.map((tier) => ({
        ...tier,
        clientCount: clientCounts[tier.id] || 0,
      }));

      setTiers(tiersWithCounts);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTiers();
  }, []);

  const handleSaveTier = async (tierData: Partial<ServiceTier>) => {
    try {
      await createServiceTier(tierData);
      await fetchTiers();
      setShowAddModal(false);
      setSuccessMessage("Tier created successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Failed to create tier:", error);
    }
  };

  const handleUpdateTier = async (tierData: Partial<ServiceTier>) => {
    if (!editingTier) return;
    try {
      await updateServiceTier(editingTier.id, tierData);
      await fetchTiers();
      setEditingTier(null);
      setSuccessMessage("Tier updated successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Failed to update tier:", error);
    }
  };

  const handleDeleteTier = async () => {
    if (!editingTier) return;
    try {
      await deleteServiceTier(editingTier.id);
      await fetchTiers();
      setEditingTier(null);
      setSuccessMessage("Tier deleted successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Failed to delete tier:", error);
    }
  };

  const filteredTiers = useMemo(() => {
    return tiers.filter((tier) => {
      const search = searchTerm.toLowerCase();
      return (
        tier.name.toLowerCase().includes(search) ||
        tier.slug.toLowerCase().includes(search) ||
        (tier.description?.toLowerCase().includes(search) ?? false)
      );
    });
  }, [tiers, searchTerm]);

  const formatVolumeRange = (tier: ServiceTier) => {
    if (tier.min_volume === null && tier.max_volume === null) {
      return "No volume limits";
    }
    const min = tier.min_volume ?? 0;
    const max = tier.max_volume !== null ? tier.max_volume.toLocaleString() : "Unlimited";
    return `${min.toLocaleString()} - ${max}`;
  };

  if (!loading && tiers.length === 0) {
    return (
      <AppShell
        title="Service Tiers"
        subtitle="Configure pricing tiers"
        actions={<Button onClick={() => setShowAddModal(true)}>Add Tier</Button>}
      >
        <Card>
          <EmptyState
            icon={<Layers className="w-12 h-12" />}
            title="No tiers yet"
            description="Add your first service tier to get started"
            action={<Button onClick={() => setShowAddModal(true)}>Add Tier</Button>}
          />
        </Card>
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add Tier"
          size="lg"
        >
          <ServiceTierForm
            onSave={handleSaveTier}
            onCancel={() => setShowAddModal(false)}
          />
        </Modal>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Service Tiers" subtitle="Configure pricing tiers">
        <FetchError message={error} onRetry={fetchTiers} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Service Tiers"
      subtitle="Configure pricing tiers"
      actions={<Button onClick={() => setShowAddModal(true)}>Add Tier</Button>}
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
          placeholder="Search tiers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-2/3 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-full mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTiers.map((tier) => (
            <div
              key={tier.id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {tier.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    {tier.is_popular && (
                      <Badge variant="warning">
                        <Star className="w-3 h-3 mr-1 fill-current" />
                        Popular
                      </Badge>
                    )}
                    <Badge
                      variant={
                        tier.status === "active"
                          ? "success"
                          : tier.status === "draft"
                          ? "warning"
                          : "default"
                      }
                    >
                      {tier.status}
                    </Badge>
                  </div>
                </div>

                <p className="text-sm text-gray-500 mb-4">
                  {tier.description || "No description"}
                </p>

                <div className="mb-4">
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                    Volume Range
                  </div>
                  <div className="text-sm font-medium text-gray-700">
                    {formatVolumeRange(tier)}
                  </div>
                </div>

                {tier.features && tier.features.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                      Features
                    </div>
                    <ul className="space-y-1">
                      {tier.features.slice(0, 4).map((feature, index) => (
                        <li
                          key={index}
                          className="text-sm text-gray-600 flex items-start"
                        >
                          <span className="text-green-500 mr-2">✓</span>
                          {feature}
                        </li>
                      ))}
                      {tier.features.length > 4 && (
                        <li className="text-sm text-gray-400">
                          +{tier.features.length - 4} more features
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="flex items-center text-sm text-gray-500 mb-4 pt-2 border-t border-gray-100">
                  <Users className="w-4 h-4 mr-1" />
                  <span>
                    {tier.clientCount} {tier.clientCount === 1 ? "client" : "clients"} on this tier
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => window.location.href = `/services/tiers/${tier.id}/pricing`}
                    className="flex-1"
                  >
                    <Settings className="w-4 h-4 mr-1" />
                    Configure Pricing
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditingTier(tier)}
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filteredTiers.length === 0 && tiers.length > 0 && (
        <Card>
          <EmptyState
            icon={<Layers className="w-12 h-12" />}
            title="No tiers found"
            description="Try adjusting your search"
          />
        </Card>
      )}

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Tier"
        size="lg"
      >
        <ServiceTierForm
          onSave={handleSaveTier}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>

      <Modal
        isOpen={!!editingTier}
        onClose={() => setEditingTier(null)}
        title="Edit Tier"
        size="lg"
      >
        {editingTier && (
          <ServiceTierForm
            tier={editingTier}
            onSave={handleUpdateTier}
            onCancel={() => setEditingTier(null)}
            onDelete={handleDeleteTier}
          />
        )}
      </Modal>
    </AppShell>
  );
}
