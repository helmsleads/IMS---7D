"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import {
  Plus,
  Search,
  Settings2,
  Copy,
  Trash2,
  Users,
  Package,
  Truck,
  RotateCcw,
  CreditCard,
  Globe,
  Loader2,
  Wine,
  Beer,
  Coffee,
  ShoppingBag,
  Sparkles,
  Pill,
  Shirt,
  Box,
  ArrowLeft,
} from "lucide-react";
import {
  getAllWorkflowProfiles,
  getWorkflowProfileClientCounts,
  createWorkflowProfile,
  duplicateWorkflowProfile,
  deleteWorkflowProfile,
  getIndustryDisplayName,
  getAllIndustries,
  DEFAULT_WORKFLOW_PROFILE,
} from "@/lib/api/workflow-profiles";
import { WorkflowProfile, ClientIndustry } from "@/types/database";

// Icon mapping for industries
const INDUSTRY_ICONS: Record<ClientIndustry, typeof Wine> = {
  spirits: Wine,
  wine: Wine,
  beer: Beer,
  rtd: Coffee,
  beverage_non_alc: Coffee,
  food: Package,
  cosmetics: Sparkles,
  supplements: Pill,
  apparel: Shirt,
  general_merchandise: Box,
};

// Color presets for workflows
const COLOR_PRESETS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#84CC16", // Lime
  "#F97316", // Orange
  "#6366F1", // Indigo
];

export default function WorkflowsPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<WorkflowProfile[]>([]);
  const [clientCounts, setClientCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [industryFilter, setIndustryFilter] = useState<string>("");

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newIndustry, setNewIndustry] = useState<ClientIndustry>("general_merchandise");
  const [createError, setCreateError] = useState("");

  // Duplicate modal state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<WorkflowProfile | null>(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicateCode, setDuplicateCode] = useState("");

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkflowProfile | null>(null);

  const industries = getAllIndustries();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [profilesData, countsData] = await Promise.all([
        getAllWorkflowProfiles(true), // Include inactive
        getWorkflowProfileClientCounts(),
      ]);
      setProfiles(profilesData);
      setClientCounts(countsData);
    } catch (error) {
      console.error("Failed to fetch workflows:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter profiles
  const filteredProfiles = profiles.filter((profile) => {
    const matchesSearch =
      !searchQuery ||
      profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.code.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesIndustry = !industryFilter || profile.industry === industryFilter;

    return matchesSearch && matchesIndustry;
  });

  const handleCreate = async () => {
    if (!newName.trim() || !newCode.trim()) {
      setCreateError("Name and code are required");
      return;
    }

    setCreating(true);
    setCreateError("");

    try {
      const profile = await createWorkflowProfile({
        ...DEFAULT_WORKFLOW_PROFILE,
        name: newName.trim(),
        code: newCode.trim().toUpperCase(),
        industry: newIndustry,
      });

      router.push(`/settings/workflows/${profile.id}`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create workflow");
      setCreating(false);
    }
  };

  const handleDuplicate = async () => {
    if (!duplicateSource || !duplicateName.trim() || !duplicateCode.trim()) return;

    setDuplicating(true);

    try {
      const profile = await duplicateWorkflowProfile(
        duplicateSource.id,
        duplicateCode.trim().toUpperCase(),
        duplicateName.trim()
      );

      setShowDuplicateModal(false);
      router.push(`/settings/workflows/${profile.id}`);
    } catch (error) {
      console.error("Failed to duplicate:", error);
      setDuplicating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);

    try {
      await deleteWorkflowProfile(deleteTarget.id);
      setShowDeleteModal(false);
      setDeleteTarget(null);
      fetchData();
    } catch (error) {
      console.error("Failed to delete:", error);
      alert(error instanceof Error ? error.message : "Failed to delete workflow");
    } finally {
      setDeleting(false);
    }
  };

  const openDuplicateModal = (profile: WorkflowProfile) => {
    setDuplicateSource(profile);
    setDuplicateName(`${profile.name} (Copy)`);
    setDuplicateCode(`${profile.code}_COPY`);
    setShowDuplicateModal(true);
  };

  const openDeleteModal = (profile: WorkflowProfile) => {
    setDeleteTarget(profile);
    setShowDeleteModal(true);
  };

  // Generate code from name
  const generateCodeFromName = (name: string) => {
    return name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .substring(0, 20);
  };

  return (
    <AppShell title="Workflow Profiles">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Workflow Profiles</h1>
            <p className="text-gray-500 mt-1">
              Configure operational rules, compliance requirements, and automation for different client types
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Workflow
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search workflows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <Select
            name="industry_filter"
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            options={industries.map((i) => ({ value: i.value, label: i.label }))}
            placeholder="All Industries"
            className="w-full sm:w-48"
          />
        </div>
      </Card>

      {/* Workflow Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : filteredProfiles.length === 0 ? (
        <Card className="text-center py-12">
          <Settings2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No workflow profiles found</p>
          <Button onClick={() => setShowCreateModal(true)} className="mt-4">
            Create Your First Workflow
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProfiles.map((profile) => {
            const IndustryIcon = INDUSTRY_ICONS[profile.industry] || Box;
            const clientCount = clientCounts[profile.id] || 0;

            return (
              <Card
                key={profile.id}
                className={`hover:shadow-md transition-shadow ${!profile.is_active ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: profile.color || "#E5E7EB" }}
                    >
                      <IndustryIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{profile.name}</h3>
                      <p className="text-xs text-gray-500">{profile.code}</p>
                    </div>
                  </div>
                  {!profile.is_active && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                      Inactive
                    </span>
                  )}
                </div>

                {profile.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{profile.description}</p>
                )}

                <div className="flex flex-wrap gap-1.5 mb-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                    {getIndustryDisplayName(profile.industry)}
                  </span>
                  {profile.requires_lot_tracking && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                      Lot Tracking
                    </span>
                  )}
                  {profile.requires_age_verification && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700">
                      Age Verify
                    </span>
                  )}
                </div>

                {/* Feature toggles summary */}
                <div className="grid grid-cols-6 gap-1 mb-4">
                  <div
                    className={`p-1.5 rounded text-center ${profile.inbound_enabled ? "bg-green-50" : "bg-gray-50"}`}
                    title="Inbound Rules"
                  >
                    <Package className={`w-4 h-4 mx-auto ${profile.inbound_enabled ? "text-green-600" : "text-gray-300"}`} />
                  </div>
                  <div
                    className={`p-1.5 rounded text-center ${profile.outbound_enabled ? "bg-green-50" : "bg-gray-50"}`}
                    title="Outbound Rules"
                  >
                    <Truck className={`w-4 h-4 mx-auto ${profile.outbound_enabled ? "text-green-600" : "text-gray-300"}`} />
                  </div>
                  <div
                    className={`p-1.5 rounded text-center ${profile.inventory_enabled ? "bg-green-50" : "bg-gray-50"}`}
                    title="Inventory Rules"
                  >
                    <Box className={`w-4 h-4 mx-auto ${profile.inventory_enabled ? "text-green-600" : "text-gray-300"}`} />
                  </div>
                  <div
                    className={`p-1.5 rounded text-center ${profile.returns_enabled ? "bg-green-50" : "bg-gray-50"}`}
                    title="Returns Rules"
                  >
                    <RotateCcw className={`w-4 h-4 mx-auto ${profile.returns_enabled ? "text-green-600" : "text-gray-300"}`} />
                  </div>
                  <div
                    className={`p-1.5 rounded text-center ${profile.billing_enabled ? "bg-green-50" : "bg-gray-50"}`}
                    title="Billing Rules"
                  >
                    <CreditCard className={`w-4 h-4 mx-auto ${profile.billing_enabled ? "text-green-600" : "text-gray-300"}`} />
                  </div>
                  <div
                    className={`p-1.5 rounded text-center ${profile.shipping_enabled ? "bg-green-50" : "bg-gray-50"}`}
                    title="Shipping Rules"
                  >
                    <Globe className={`w-4 h-4 mx-auto ${profile.shipping_enabled ? "text-green-600" : "text-gray-300"}`} />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Users className="w-4 h-4" />
                    <span>{clientCount} client{clientCount !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openDuplicateModal(profile)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                      title="Duplicate"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openDeleteModal(profile)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                      disabled={clientCount > 0}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <Link
                      href={`/settings/workflows/${profile.id}`}
                      className="ml-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setNewName("");
          setNewCode("");
          setCreateError("");
        }}
        title="Create Workflow Profile"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              if (!newCode || newCode === generateCodeFromName(newName)) {
                setNewCode(generateCodeFromName(e.target.value));
              }
            }}
            placeholder="e.g., Spirits Premium"
            required
          />
          <Input
            label="Code"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
            placeholder="e.g., SPIRITS_PREMIUM"
            hint="Unique identifier for this workflow"
            required
          />
          <Select
            label="Industry"
            name="industry"
            value={newIndustry}
            onChange={(e) => setNewIndustry(e.target.value as ClientIndustry)}
            options={industries.map((i) => ({ value: i.value, label: i.label }))}
            required
          />

          {createError && (
            <p className="text-sm text-red-600">{createError}</p>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={creating}>
              Create Workflow
            </Button>
          </div>
        </div>
      </Modal>

      {/* Duplicate Modal */}
      <Modal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        title="Duplicate Workflow"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Create a copy of <strong>{duplicateSource?.name}</strong> with all its settings.
          </p>
          <Input
            label="New Name"
            value={duplicateName}
            onChange={(e) => setDuplicateName(e.target.value)}
            required
          />
          <Input
            label="New Code"
            value={duplicateCode}
            onChange={(e) => setDuplicateCode(e.target.value.toUpperCase())}
            required
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowDuplicateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleDuplicate} loading={duplicating}>
              Duplicate
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Workflow"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
          </p>
          {(clientCounts[deleteTarget?.id || ""] || 0) > 0 && (
            <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded">
              This workflow is currently assigned to {clientCounts[deleteTarget?.id || ""]} client(s).
              You must reassign them before deleting.
            </p>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deleting}
              disabled={(clientCounts[deleteTarget?.id || ""] || 0) > 0}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
