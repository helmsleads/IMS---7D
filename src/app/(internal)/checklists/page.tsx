"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ClipboardCheck,
  Clock,
  CheckCircle,
  Calendar,
  FileText,
  History,
  Eye,
  Play,
  Trash2,
  Edit,
  AlertCircle,
  CalendarDays,
  CalendarRange,
  CalendarClock,
  ListChecks,
  MapPin,
  X,
  GripVertical,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";
import { handleApiError } from "@/lib/utils/error-handler";
import { ChecklistTemplate, ChecklistFrequency } from "@/types/database";
import {
  getTodaysChecklistsWithStatus,
  TodayChecklist,
  startChecklist,
  getChecklistTemplates,
  updateChecklistTemplate,
  createChecklistTemplate,
  getChecklistTemplate,
} from "@/lib/api/checklists";

type ChecklistTab = "today" | "templates" | "history";

function getFrequencyDisplay(frequency: ChecklistFrequency): {
  label: string;
  icon: React.ReactNode;
  color: string;
} {
  const map: Record<ChecklistFrequency, { label: string; icon: React.ReactNode; color: string }> = {
    daily: {
      label: "Daily",
      icon: <CalendarDays className="w-4 h-4" />,
      color: "bg-blue-100 text-blue-700",
    },
    weekly: {
      label: "Weekly",
      icon: <CalendarRange className="w-4 h-4" />,
      color: "bg-purple-100 text-purple-700",
    },
    monthly: {
      label: "Monthly",
      icon: <CalendarClock className="w-4 h-4" />,
      color: "bg-orange-100 text-orange-700",
    },
    as_needed: {
      label: "As Needed",
      icon: <Calendar className="w-4 h-4" />,
      color: "bg-gray-100 text-gray-700",
    },
  };
  return map[frequency] || map.as_needed;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ChecklistsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ChecklistTab>("today");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [todayChecklists, setTodayChecklists] = useState<TodayChecklist[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  // Action menu state
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  // Template modal state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    description: "",
    frequency: "daily" as ChecklistFrequency,
  });
  const [templateItems, setTemplateItems] = useState<{ id: string; task: string; required: boolean }[]>([]);
  const [newItemText, setNewItemText] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  // Fetch today's checklists
  const fetchTodaysChecklists = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTodaysChecklistsWithStatus();
      setTodayChecklists(data);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  // Fetch templates (including inactive for management)
  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const data = await getChecklistTemplates({ includeInactive: true });
      setTemplates(data);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setTemplatesLoading(false);
    }
  };

  // Fetch data when tab changes
  useEffect(() => {
    if (activeTab === "today") {
      fetchTodaysChecklists();
    } else if (activeTab === "templates") {
      fetchTemplates();
    }
  }, [activeTab]);

  // Handle starting a checklist
  const handleStartChecklist = async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStartingId(templateId);
    try {
      const completion = await startChecklist(templateId);
      setSuccessMessage("Checklist started");
      router.push(`/checklists/${completion.id}`);
    } catch (err) {
      setError(handleApiError(err));
      setStartingId(null);
    }
  };

  // Handle deactivating a template
  const handleDeactivateTemplate = async (templateId: string) => {
    if (!confirm("Are you sure you want to deactivate this template? It will no longer appear in scheduled checklists.")) {
      return;
    }
    setDeactivatingId(templateId);
    setActionMenuOpen(null);
    try {
      await updateChecklistTemplate(templateId, { is_active: false });
      setSuccessMessage("Template deactivated");
      fetchTemplates();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setDeactivatingId(null);
    }
  };

  // Handle activating a template
  const handleActivateTemplate = async (templateId: string) => {
    setDeactivatingId(templateId);
    setActionMenuOpen(null);
    try {
      await updateChecklistTemplate(templateId, { is_active: true });
      setSuccessMessage("Template activated");
      fetchTemplates();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setDeactivatingId(null);
    }
  };

  // Open template modal for creating
  const openCreateTemplateModal = () => {
    setEditingTemplate(null);
    setTemplateForm({ name: "", description: "", frequency: "daily" });
    setTemplateItems([]);
    setNewItemText("");
    setShowTemplateModal(true);
  };

  // Open template modal for editing
  const openEditTemplateModal = async (template: ChecklistTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      description: template.description || "",
      frequency: template.frequency,
    });
    // Parse items from the template
    const rawItems = Array.isArray(template.items) ? template.items : [];
    const items = rawItems.map((item: unknown, index: number) => {
      const itemObj = item as { task?: string; required?: boolean } | string;
      return {
        id: `item-${index}-${Date.now()}`,
        task: typeof itemObj === "string" ? itemObj : itemObj.task || "",
        required: typeof itemObj === "object" ? itemObj.required ?? true : true,
      };
    });
    setTemplateItems(items);
    setNewItemText("");
    setShowTemplateModal(true);
  };

  // Close template modal
  const closeTemplateModal = () => {
    setShowTemplateModal(false);
    setEditingTemplate(null);
    setTemplateForm({ name: "", description: "", frequency: "daily" });
    setTemplateItems([]);
    setNewItemText("");
  };

  // Add item to list
  const handleAddItem = () => {
    if (!newItemText.trim()) return;
    setTemplateItems([
      ...templateItems,
      { id: `item-${Date.now()}`, task: newItemText.trim(), required: true },
    ]);
    setNewItemText("");
  };

  // Remove item from list
  const handleRemoveItem = (itemId: string) => {
    setTemplateItems(templateItems.filter((item) => item.id !== itemId));
  };

  // Toggle item required status
  const handleToggleRequired = (itemId: string) => {
    setTemplateItems(
      templateItems.map((item) =>
        item.id === itemId ? { ...item, required: !item.required } : item
      )
    );
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedItemIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;

    const newItems = [...templateItems];
    const draggedItem = newItems[draggedItemIndex];
    newItems.splice(draggedItemIndex, 1);
    newItems.splice(index, 0, draggedItem);
    setTemplateItems(newItems);
    setDraggedItemIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
  };

  // Save template
  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim()) {
      setError("Template name is required");
      return;
    }

    setSavingTemplate(true);
    try {
      const templateData = {
        name: templateForm.name.trim(),
        description: templateForm.description.trim() || null,
        frequency: templateForm.frequency,
        items: templateItems.map(({ task, required }) => ({ task, required })),
      };

      if (editingTemplate) {
        await updateChecklistTemplate(editingTemplate.id, templateData);
        setSuccessMessage("Template updated successfully");
      } else {
        await createChecklistTemplate(templateData);
        setSuccessMessage("Template created successfully");
      }

      closeTemplateModal();
      fetchTemplates();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setSavingTemplate(false);
    }
  };

  // Summary stats
  const todayStats = useMemo(() => {
    const pending = todayChecklists.filter((c) => c.status === "pending").length;
    const inProgress = todayChecklists.filter((c) => c.status === "in_progress").length;
    const completed = todayChecklists.filter((c) => c.status === "completed").length;
    const overdue = todayChecklists.filter((c) => c.isOverdue).length;
    return { pending, inProgress, completed, overdue, total: todayChecklists.length };
  }, [todayChecklists]);

  const tabs: { key: ChecklistTab; label: string; icon: React.ReactNode; count?: number }[] = [
    {
      key: "today",
      label: "Today's Checklists",
      icon: <ClipboardCheck className="w-4 h-4" />,
      count: todayChecklists.filter((c) => c.status !== "completed").length,
    },
    {
      key: "templates",
      label: "Templates",
      icon: <FileText className="w-4 h-4" />,
      count: templates.length,
    },
    {
      key: "history",
      label: "History",
      icon: <History className="w-4 h-4" />,
    },
  ];

  const actionButtons = (
    <Button onClick={openCreateTemplateModal}>
      <Plus className="w-4 h-4 mr-1" />
      New Template
    </Button>
  );

  return (
    <AppShell title="Warehouse Checklists" actions={actionButtons}>
      {/* Subtitle */}
      <p className="text-gray-500 -mt-4 mb-6">Daily and weekly task management</p>

      {successMessage && (
        <div className="mb-4">
          <Alert type="success" message={successMessage} onClose={() => setSuccessMessage("")} />
        </div>
      )}

      {error && (
        <div className="mb-4">
          <Alert type="error" message={error} onClose={() => setError(null)} />
        </div>
      )}

      {/* Summary Stats */}
      <div className={`grid grid-cols-2 gap-4 mb-6 ${todayStats.overdue > 0 ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
        {todayStats.overdue > 0 && (
          <Card className="border-red-200 bg-red-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-red-600 font-medium">Overdue</p>
                <p className="text-xl font-semibold text-red-600">{todayStats.overdue}</p>
              </div>
            </div>
          </Card>
        )}
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-xl font-semibold text-yellow-600">{todayStats.pending}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Play className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">In Progress</p>
              <p className="text-xl font-semibold text-blue-600">{todayStats.inProgress}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Completed</p>
              <p className="text-xl font-semibold text-green-600">{todayStats.completed}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <ListChecks className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Today</p>
              <p className="text-xl font-semibold text-gray-900">{todayStats.total}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-4 -mb-px overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${
                  activeTab === tab.key
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`
                  px-2 py-0.5 text-xs rounded-full
                  ${
                    activeTab === tab.key
                      ? "bg-blue-100 text-blue-600"
                      : "bg-gray-100 text-gray-600"
                  }
                `}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Today's Checklists Tab */}
      {activeTab === "today" && (
        <div className="space-y-4">
          {loading ? (
            <Card>
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            </Card>
          ) : todayChecklists.length === 0 ? (
            <Card>
              <EmptyState
                icon={<ClipboardCheck className="w-12 h-12" />}
                title="No checklists for today"
                description="All checklists have been completed or none are scheduled."
              />
            </Card>
          ) : (
            todayChecklists.map((checklist) => {
              const progressPercent =
                checklist.totalItems > 0
                  ? (checklist.completedItems / checklist.totalItems) * 100
                  : 0;

              return (
                <Card
                  key={checklist.id}
                  className={`cursor-pointer hover:shadow-md transition-shadow ${
                    checklist.isOverdue
                      ? "border-red-300 bg-red-50/50 ring-1 ring-red-200"
                      : checklist.status === "completed"
                      ? "border-green-200 bg-green-50/30"
                      : checklist.status === "in_progress"
                      ? "border-blue-200 bg-blue-50/30"
                      : ""
                  }`}
                  onClick={() => {
                    if (checklist.completion?.id) {
                      router.push(`/checklists/${checklist.completion.id}`);
                    }
                  }}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div
                        className={`p-3 rounded-xl ${
                          checklist.isOverdue
                            ? "bg-red-100"
                            : checklist.status === "completed"
                            ? "bg-green-100"
                            : checklist.status === "in_progress"
                            ? "bg-blue-100"
                            : "bg-gray-100"
                        }`}
                      >
                        {checklist.isOverdue ? (
                          <AlertCircle className="w-6 h-6 text-red-600" />
                        ) : checklist.status === "completed" ? (
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        ) : checklist.status === "in_progress" ? (
                          <Play className="w-6 h-6 text-blue-600" />
                        ) : (
                          <ClipboardCheck className="w-6 h-6 text-gray-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">
                            {checklist.template.name}
                          </h3>
                          {checklist.isOverdue && (
                            <Badge variant="error" size="sm">
                              Overdue
                            </Badge>
                          )}
                        </div>
                        {checklist.template.description && (
                          <p className="text-sm text-gray-500 mt-0.5">
                            {checklist.template.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {(() => {
                            const freq = getFrequencyDisplay(checklist.template.frequency);
                            return (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${freq.color}`}
                              >
                                {freq.icon}
                                {freq.label}
                              </span>
                            );
                          })()}
                          {checklist.location && (
                            <span className="text-sm text-gray-500">
                              <MapPin className="w-3 h-3 inline mr-1" />
                              {checklist.location.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Progress */}
                      <div className="min-w-[150px]">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-500">Progress</span>
                          <span className="font-medium">
                            {checklist.completedItems}/{checklist.totalItems}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              checklist.status === "completed"
                                ? "bg-green-500"
                                : checklist.isOverdue
                                ? "bg-red-500"
                                : "bg-blue-500"
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Status Badge */}
                      <Badge
                        variant={
                          checklist.status === "completed"
                            ? "success"
                            : checklist.status === "in_progress"
                            ? "info"
                            : checklist.isOverdue
                            ? "error"
                            : "warning"
                        }
                        size="md"
                      >
                        {checklist.status === "completed"
                          ? "Completed"
                          : checklist.status === "in_progress"
                          ? "In Progress"
                          : "Pending"}
                      </Badge>

                      {/* Action Button */}
                      {checklist.status === "pending" ? (
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={startingId === checklist.template.id}
                          onClick={(e) => handleStartChecklist(checklist.template.id, e)}
                        >
                          {startingId === checklist.template.id ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                              Starting...
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-1" />
                              Start
                            </>
                          )}
                        </Button>
                      ) : checklist.status === "in_progress" ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (checklist.completion?.id) {
                              router.push(`/checklists/${checklist.completion.id}`);
                            }
                          }}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Continue
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (checklist.completion?.id) {
                              router.push(`/checklists/${checklist.completion.id}`);
                            }
                          }}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          {/* Create Template Button */}
          <div className="flex justify-end">
            <Button onClick={openCreateTemplateModal}>
              <Plus className="w-4 h-4 mr-1" />
              Create Template
            </Button>
          </div>

          {templatesLoading ? (
            <Card>
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            </Card>
          ) : templates.length === 0 ? (
            <Card>
              <EmptyState
                icon={<FileText className="w-12 h-12" />}
                title="No templates"
                description="Create a checklist template to get started."
                action={
                  <Button onClick={openCreateTemplateModal}>
                    <Plus className="w-4 h-4 mr-1" />
                    Create Template
                  </Button>
                }
              />
            </Card>
          ) : (
            templates.map((template) => {
              const freq = getFrequencyDisplay(template.frequency);
              const itemCount = Array.isArray(template.items) ? template.items.length : 0;
              const isDeactivating = deactivatingId === template.id;

              return (
                <Card
                  key={template.id}
                  className={`hover:shadow-md transition-shadow ${!template.is_active ? "opacity-60" : ""}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl ${template.is_active ? "bg-gray-100" : "bg-gray-50"}`}>
                        <FileText className={`w-6 h-6 ${template.is_active ? "text-gray-600" : "text-gray-400"}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className={`font-semibold ${template.is_active ? "text-gray-900" : "text-gray-500"}`}>
                            {template.name}
                          </h3>
                          {template.is_active ? (
                            <Badge variant="success" size="sm">Active</Badge>
                          ) : (
                            <Badge variant="default" size="sm">Inactive</Badge>
                          )}
                        </div>
                        {template.description && (
                          <p className="text-sm text-gray-500 mt-0.5">{template.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${freq.color}`}
                          >
                            {freq.icon}
                            {freq.label}
                          </span>
                          <span className="text-sm text-gray-500">
                            {itemCount} {itemCount === 1 ? "item" : "items"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEditTemplateModal(template)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      {template.is_active ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isDeactivating}
                          onClick={() => handleDeactivateTemplate(template.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {isDeactivating ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4 mr-1" />
                              Deactivate
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isDeactivating}
                          onClick={() => handleActivateTemplate(template.id)}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          {isDeactivating ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Activate
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <Card>
            <EmptyState
              icon={<History className="w-12 h-12" />}
              title="No history yet"
              description="Completed checklists will appear here once you complete some checklists."
            />
          </Card>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={closeTemplateModal}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingTemplate ? "Edit Template" : "Create Template"}
                </h2>
                <button
                  onClick={closeTemplateModal}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-140px)]">
                <div className="space-y-4">
                  {/* Name Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={templateForm.name}
                      onChange={(e) =>
                        setTemplateForm({ ...templateForm, name: e.target.value })
                      }
                      placeholder="e.g., Daily Opening Checklist"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Description Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={templateForm.description}
                      onChange={(e) =>
                        setTemplateForm({ ...templateForm, description: e.target.value })
                      }
                      placeholder="Brief description of this checklist..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Frequency Dropdown */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Frequency
                    </label>
                    <select
                      value={templateForm.frequency}
                      onChange={(e) =>
                        setTemplateForm({
                          ...templateForm,
                          frequency: e.target.value as ChecklistFrequency,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="as_needed">As Needed</option>
                    </select>
                  </div>

                  {/* Items Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Checklist Items
                    </label>

                    {/* Add Item Input */}
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddItem();
                          }
                        }}
                        placeholder="Enter item description..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <Button onClick={handleAddItem} disabled={!newItemText.trim()}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add Item
                      </Button>
                    </div>

                    {/* Items List */}
                    {templateItems.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                        <ListChecks className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No items added yet</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Add items using the field above
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {templateItems.map((item, index) => (
                          <div
                            key={item.id}
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnd={handleDragEnd}
                            className={`flex items-center gap-3 p-3 bg-white border rounded-lg transition-all ${
                              draggedItemIndex === index
                                ? "border-blue-400 shadow-md opacity-50"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            {/* Drag Handle */}
                            <div className="cursor-grab text-gray-400 hover:text-gray-600">
                              <GripVertical className="w-5 h-5" />
                            </div>

                            {/* Item Number */}
                            <span className="text-sm font-medium text-gray-400 w-6">
                              {index + 1}.
                            </span>

                            {/* Item Text */}
                            <span className="flex-1 text-sm text-gray-700">{item.task}</span>

                            {/* Required Toggle */}
                            <button
                              onClick={() => handleToggleRequired(item.id)}
                              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                                item.required
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {item.required ? "Required" : "Optional"}
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {templateItems.length > 0 && (
                      <p className="text-xs text-gray-500 mt-2">
                        Drag items to reorder. Click "Required" to toggle.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                <Button variant="secondary" onClick={closeTemplateModal}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveTemplate}
                  disabled={savingTemplate || !templateForm.name.trim()}
                >
                  {savingTemplate ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : editingTemplate ? (
                    "Update Template"
                  ) : (
                    "Create Template"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
