"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  Circle,
  Clock,
  AlertCircle,
  FileText,
  MapPin,
  User,
  CalendarDays,
  CalendarRange,
  CalendarClock,
  Calendar,
  Save,
  Send,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Alert from "@/components/ui/Alert";
import { handleApiError } from "@/lib/utils/error-handler";
import { ChecklistFrequency } from "@/types/database";
import {
  getChecklistCompletion,
  ChecklistCompletionWithTemplate,
  completeChecklistItem,
  submitChecklist,
  approveChecklist,
  requestRedoChecklist,
  updateChecklistNotes,
} from "@/lib/api/checklists";
import { useAuth } from "@/lib/auth-context";

interface ChecklistItem {
  id: string;
  task: string;
  required: boolean;
}

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

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ChecklistDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const checklistId = params.id as string;

  const [checklist, setChecklist] = useState<ChecklistCompletionWithTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [completedItemIds, setCompletedItemIds] = useState<Set<string>>(new Set());
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState("");
  const [approving, setApproving] = useState(false);
  const [showRedoModal, setShowRedoModal] = useState(false);
  const [redoNotes, setRedoNotes] = useState("");
  const [requestingRedo, setRequestingRedo] = useState(false);

  // Fetch checklist data
  const fetchChecklist = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getChecklistCompletion(checklistId);
      if (!data) {
        setError("Checklist not found");
        return;
      }
      setChecklist(data);
      // Initialize completed items from the stored data
      const completed = new Set<string>(
        Array.isArray(data.completed_items)
          ? (data.completed_items as string[])
          : []
      );
      setCompletedItemIds(completed);
      setNotes(data.notes || "");
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (checklistId) {
      fetchChecklist();
    }
  }, [checklistId]);

  // Parse template items
  const templateItems = useMemo((): ChecklistItem[] => {
    if (!checklist?.template?.items) return [];
    const rawItems = Array.isArray(checklist.template.items) ? checklist.template.items : [];
    return rawItems.map((item: unknown, index: number) => {
      const itemObj = item as { id?: string; task?: string; required?: boolean } | string;
      const id = typeof itemObj === "object" && itemObj.id ? itemObj.id : `item-${index}`;
      return {
        id,
        task: typeof itemObj === "string" ? itemObj : itemObj.task || "",
        required: typeof itemObj === "object" ? itemObj.required ?? true : true,
      };
    });
  }, [checklist?.template?.items]);

  // Calculate progress
  const progress = useMemo(() => {
    const total = templateItems.length;
    const completed = completedItemIds.size;
    const requiredItems = templateItems.filter((item) => item.required);
    const completedRequired = requiredItems.filter((item) => completedItemIds.has(item.id)).length;
    const allRequiredComplete = completedRequired === requiredItems.length;
    const percent = total > 0 ? (completed / total) * 100 : 0;
    return { total, completed, percent, allRequiredComplete, requiredItems: requiredItems.length, completedRequired };
  }, [templateItems, completedItemIds]);

  // Check if checklist is already submitted
  const isSubmitted = !!checklist?.completed_at;

  // Handle item toggle
  const handleToggleItem = async (itemId: string) => {
    if (isSubmitted) return;

    const newCompleted = new Set(completedItemIds);
    if (newCompleted.has(itemId)) {
      newCompleted.delete(itemId);
    } else {
      newCompleted.add(itemId);
    }
    setCompletedItemIds(newCompleted);

    // Save to server
    setSavingItemId(itemId);
    try {
      await completeChecklistItem(checklistId, itemId);
    } catch (err) {
      // Revert on error
      setCompletedItemIds(completedItemIds);
      setError(handleApiError(err));
    } finally {
      setSavingItemId(null);
    }
  };

  // Handle submit checklist
  const handleSubmit = async () => {
    if (!progress.allRequiredComplete) {
      setError("Please complete all required items before submitting");
      return;
    }

    if (!user?.email) {
      setError("User not authenticated");
      return;
    }

    setSubmitting(true);
    try {
      // Save notes first if any
      if (notes.trim()) {
        await updateChecklistNotes(checklistId, notes.trim());
      }
      await submitChecklist(checklistId, user.email);
      setSuccessMessage("Checklist submitted for approval");
      fetchChecklist();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle approve checklist (supervisor action)
  const handleApprove = async () => {
    if (!user?.email) {
      setError("User not authenticated");
      return;
    }

    setApproving(true);
    try {
      await approveChecklist(checklistId, user.email);
      setSuccessMessage("Checklist approved successfully");
      fetchChecklist();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setApproving(false);
    }
  };

  // Handle request redo (supervisor action)
  const handleRequestRedo = async () => {
    if (!user?.email) {
      setError("User not authenticated");
      return;
    }

    if (!redoNotes.trim()) {
      setError("Please provide notes explaining what needs to be redone");
      return;
    }

    setRequestingRedo(true);
    try {
      await requestRedoChecklist(checklistId, user.email, redoNotes.trim());
      setSuccessMessage("Redo requested - the assignee will be notified");
      setShowRedoModal(false);
      setRedoNotes("");
      fetchChecklist();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setRequestingRedo(false);
    }
  };

  // Back button
  const backButton = (
    <button
      onClick={() => router.push("/checklists")}
      className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to Checklists
    </button>
  );

  if (loading) {
    return (
      <AppShell title="Loading...">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AppShell>
    );
  }

  if (error && !checklist) {
    return (
      <AppShell title="Error">
        <div className="mb-4">{backButton}</div>
        <Alert type="error" message={error} />
      </AppShell>
    );
  }

  if (!checklist) {
    return (
      <AppShell title="Not Found">
        <div className="mb-4">{backButton}</div>
        <Card>
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">Checklist not found</h3>
            <p className="text-gray-500 mt-1">The checklist you're looking for doesn't exist.</p>
          </div>
        </Card>
      </AppShell>
    );
  }

  const freq = getFrequencyDisplay(checklist.template.frequency);

  return (
    <AppShell title={checklist.template.name}>
      <Breadcrumbs items={[
        { label: "Checklists", href: "/checklists" },
        { label: checklist.template.name || "Checklist Details" }
      ]} />
      {/* Back Link */}
      <div className="mb-4 -mt-2">{backButton}</div>

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

      {/* Progress Bar - Prominent at Top */}
      <div className="mb-6 bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-gray-900">
              {progress.completed} of {progress.total} items completed
            </span>
            {progress.percent === 100 && (
              <Badge variant="success" size="md">
                <CheckCircle className="w-3 h-3 mr-1" />
                All Done
              </Badge>
            )}
          </div>
          <span className="text-2xl font-bold text-gray-900">
            {Math.round(progress.percent)}%
          </span>
        </div>
        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              progress.percent === 100 ? "bg-green-500" : "bg-blue-500"
            }`}
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        {!isSubmitted && progress.requiredItems > 0 && (
          <p className="text-sm text-gray-500 mt-2">
            {progress.completedRequired} of {progress.requiredItems} required items complete
            {progress.allRequiredComplete && (
              <span className="text-green-600 ml-2 font-medium">- Ready to submit!</span>
            )}
          </p>
        )}
      </div>

      {/* Header Info */}
      <Card className="mb-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium ${freq.color}`}>
                {freq.icon}
                {freq.label}
              </span>
              {isSubmitted && checklist.supervisor_approved ? (
                <Badge variant="success" size="md">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  Approved
                </Badge>
              ) : isSubmitted ? (
                <Badge variant="warning" size="md">
                  <Clock className="w-3 h-3 mr-1" />
                  Pending Approval
                </Badge>
              ) : (
                <Badge variant="info" size="md">
                  <Clock className="w-3 h-3 mr-1" />
                  In Progress
                </Badge>
              )}
            </div>
            {checklist.template.description && (
              <p className="text-gray-600">{checklist.template.description}</p>
            )}
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 flex-wrap">
              {checklist.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {checklist.location.name}
                </span>
              )}
              {isSubmitted && checklist.completed_by && (
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {checklist.completed_by}
                </span>
              )}
              {isSubmitted && checklist.completed_at && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDateTime(checklist.completed_at)}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Checklist Items */}
      <Card className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Checklist Items</h3>

        {templateItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No items in this checklist
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {templateItems.map((item, index) => {
              const isCompleted = completedItemIds.has(item.id);
              const isSaving = savingItemId === item.id;

              return (
                <label
                  key={item.id}
                  className={`
                    flex items-start gap-4 py-4 px-2 rounded-lg transition-all
                    ${isSubmitted ? "cursor-default" : "cursor-pointer hover:bg-gray-50"}
                    ${isCompleted ? "bg-green-50/50" : ""}
                    ${isSaving ? "opacity-60" : ""}
                  `}
                >
                  {/* Checkbox */}
                  <div className="flex-shrink-0 pt-0.5">
                    {isSaving ? (
                      <div className="w-6 h-6 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                      </div>
                    ) : (
                      <input
                        type="checkbox"
                        checked={isCompleted}
                        onChange={() => !isSubmitted && handleToggleItem(item.id)}
                        disabled={isSubmitted}
                        className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer disabled:cursor-default"
                      />
                    )}
                  </div>

                  {/* Item Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={`text-base ${
                          isCompleted
                            ? "text-gray-500 line-through"
                            : "text-gray-900"
                        }`}
                      >
                        {item.task}
                      </span>

                      {/* Status Indicator */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {item.required && !isCompleted && (
                          <span className="text-xs text-red-600 font-medium">Required</span>
                        )}
                        {isCompleted && (
                          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                            <CheckCircle className="w-4 h-4" />
                            Done
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </Card>

      {/* Submit for Approval Section - Shows when all items checked */}
      {!isSubmitted && progress.allRequiredComplete && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-800 mb-1">
                Ready to Submit for Approval
              </h3>
              <p className="text-sm text-green-700 mb-4">
                All required items are complete. Add any notes and submit for supervisor approval.
              </p>

              {/* Notes Textarea */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-green-800 mb-2">
                  <MessageSquare className="w-4 h-4 inline mr-1" />
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes, observations, or issues encountered..."
                  rows={3}
                  className="w-full px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none bg-white"
                />
              </div>

              {/* Submit Button */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-1" />
                      Submit for Approval
                    </>
                  )}
                </Button>
                <Button variant="secondary" onClick={() => router.push("/checklists")}>
                  Save & Exit
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Notes Section - Only when not ready to submit */}
      {!isSubmitted && !progress.allRequiredComplete && (
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Notes
          </h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes or observations..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </Card>
      )}

      {/* Submitted Notes Display */}
      {isSubmitted && checklist.notes && (
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Notes
          </h3>
          <p className="text-gray-700 whitespace-pre-wrap">{checklist.notes}</p>
        </Card>
      )}

      {/* Action Buttons - Only when items still need completion */}
      {!isSubmitted && !progress.allRequiredComplete && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            <span className="flex items-center gap-1 text-amber-600">
              <AlertCircle className="w-4 h-4" />
              Complete all required items to submit for approval
            </span>
          </div>
          <Button variant="secondary" onClick={() => router.push("/checklists")}>
            <Save className="w-4 h-4 mr-1" />
            Save & Exit
          </Button>
        </div>
      )}

      {/* Pending Approval Status + Supervisor Actions */}
      {isSubmitted && !checklist.supervisor_approved && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-full">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-800">Pending Approval</h3>
                <p className="text-sm text-amber-700">
                  Submitted by {checklist.completed_by} on {checklist.completed_at && formatDateTime(checklist.completed_at)}
                </p>
              </div>
            </div>

            {/* Supervisor Actions */}
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowRedoModal(true)}
                className="text-amber-700 border-amber-300 hover:bg-amber-100"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Request Redo
              </Button>
              <Button
                onClick={handleApprove}
                disabled={approving}
                className="bg-green-600 hover:bg-green-700"
              >
                {approving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Approving...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 mr-1" />
                    Approve
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Approved Status */}
      {isSubmitted && checklist.supervisor_approved && (
        <Card className="border-green-200 bg-green-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-full">
              <ShieldCheck className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-green-800">Approved</h3>
              <p className="text-sm text-green-700">
                Approved by {checklist.supervisor_id}
                {checklist.approved_at && ` on ${formatDateTime(checklist.approved_at)}`}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Request Redo Modal */}
      {showRedoModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => setShowRedoModal(false)}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-amber-600" />
                  Request Redo
                </h2>
                <button
                  onClick={() => setShowRedoModal(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-4">
                <p className="text-sm text-gray-600 mb-4">
                  The checklist will be sent back to the assignee for corrections.
                  Please explain what needs to be redone.
                </p>

                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Redo <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={redoNotes}
                  onChange={(e) => setRedoNotes(e.target.value)}
                  placeholder="Explain what needs to be corrected or redone..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                  autoFocus
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                <Button variant="secondary" onClick={() => setShowRedoModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleRequestRedo}
                  disabled={requestingRedo || !redoNotes.trim()}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {requestingRedo ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Request Redo
                    </>
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
