import { createClient } from "@/lib/supabase";
import { ChecklistTemplate, ChecklistCompletion, ChecklistFrequency } from "@/types/database";

export interface GetChecklistTemplatesOptions {
  frequency?: ChecklistFrequency;
  includeInactive?: boolean;
}

export async function getChecklistTemplates(
  options?: GetChecklistTemplatesOptions
): Promise<ChecklistTemplate[]> {
  const supabase = createClient();

  let query = supabase
    .from("checklist_templates")
    .select("*")
    .order("is_active", { ascending: false })
    .order("name");

  // Only filter by active if not including inactive
  if (!options?.includeInactive) {
    query = query.eq("is_active", true);
  }

  if (options?.frequency) {
    query = query.eq("frequency", options.frequency);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getChecklistTemplate(
  id: string
): Promise<ChecklistTemplate | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("checklist_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  return data;
}

export async function createChecklistTemplate(
  template: Partial<ChecklistTemplate>
): Promise<ChecklistTemplate> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("checklist_templates")
    .insert({
      ...template,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateChecklistTemplate(
  id: string,
  template: Partial<ChecklistTemplate>
): Promise<ChecklistTemplate> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("checklist_templates")
    .update(template)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteChecklistTemplate(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("checklist_templates")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export interface ChecklistCompletionFilters {
  templateId?: string;
  locationId?: string;
  completedBy?: string;
  startDate?: string;
  endDate?: string;
  approved?: boolean;
}

export interface ChecklistCompletionWithTemplate extends ChecklistCompletion {
  template: {
    id: string;
    name: string;
    description: string | null;
    frequency: ChecklistFrequency;
    items: unknown[];
  };
  location: {
    id: string;
    name: string;
  } | null;
}

export async function getChecklistCompletions(
  filters?: ChecklistCompletionFilters
): Promise<ChecklistCompletionWithTemplate[]> {
  const supabase = createClient();

  let query = supabase
    .from("checklist_completions")
    .select(`
      *,
      template:checklist_templates (id, name, description, frequency, items),
      location:locations (id, name)
    `)
    .order("completed_at", { ascending: false });

  if (filters?.templateId) {
    query = query.eq("template_id", filters.templateId);
  }

  if (filters?.locationId) {
    query = query.eq("location_id", filters.locationId);
  }

  if (filters?.completedBy) {
    query = query.eq("completed_by", filters.completedBy);
  }

  if (filters?.startDate) {
    query = query.gte("completed_at", filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte("completed_at", filters.endDate);
  }

  if (filters?.approved !== undefined) {
    query = query.eq("supervisor_approved", filters.approved);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getChecklistCompletion(
  id: string
): Promise<ChecklistCompletionWithTemplate | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("checklist_completions")
    .select(`
      *,
      template:checklist_templates (id, name, description, frequency, items),
      location:locations (id, name)
    `)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  return data;
}

export async function startChecklist(
  templateId: string,
  locationId?: string | null
): Promise<ChecklistCompletion> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("checklist_completions")
    .insert({
      template_id: templateId,
      location_id: locationId ?? null,
      completed_items: [],
      supervisor_approved: false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function completeChecklistItem(
  completionId: string,
  itemId: string
): Promise<ChecklistCompletion> {
  const supabase = createClient();

  // Get current completion
  const { data: completion, error: fetchError } = await supabase
    .from("checklist_completions")
    .select("completed_items")
    .eq("id", completionId)
    .single();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  // Add item to completed_items if not already there
  const completedItems = completion.completed_items as unknown[] || [];
  if (!completedItems.includes(itemId)) {
    completedItems.push(itemId);
  }

  const { data, error } = await supabase
    .from("checklist_completions")
    .update({ completed_items: completedItems })
    .eq("id", completionId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function submitChecklist(
  id: string,
  completedBy: string
): Promise<ChecklistCompletion> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("checklist_completions")
    .update({
      completed_by: completedBy,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function approveChecklist(
  id: string,
  supervisorId: string
): Promise<ChecklistCompletion> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("checklist_completions")
    .update({
      supervisor_approved: true,
      supervisor_id: supervisorId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function requestRedoChecklist(
  id: string,
  supervisorId: string,
  redoNotes: string
): Promise<ChecklistCompletion> {
  const supabase = createClient();

  // Reset the checklist for redo - clear completion but keep items progress
  const { data, error } = await supabase
    .from("checklist_completions")
    .update({
      completed_at: null,
      completed_by: null,
      supervisor_approved: false,
      supervisor_id: supervisorId,
      approved_at: null,
      notes: redoNotes ? `[REDO REQUESTED] ${redoNotes}` : "[REDO REQUESTED]",
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateChecklistNotes(
  id: string,
  notes: string
): Promise<ChecklistCompletion> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("checklist_completions")
    .update({ notes })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getTodaysChecklists(
  locationId?: string
): Promise<ChecklistTemplate[]> {
  const supabase = createClient();

  const today = new Date();
  const dayOfWeek = today.getDay();
  const dayOfMonth = today.getDate();

  // Get active templates
  let query = supabase
    .from("checklist_templates")
    .select("*")
    .eq("is_active", true);

  const { data: templates, error: templatesError } = await query;

  if (templatesError) {
    throw new Error(templatesError.message);
  }

  // Filter by frequency
  const dueTemplates = (templates || []).filter((template) => {
    switch (template.frequency) {
      case "daily":
        return true;
      case "weekly":
        return dayOfWeek === 1; // Monday
      case "monthly":
        return dayOfMonth === 1; // First of month
      case "as_needed":
        return false; // Not automatically due
      default:
        return false;
    }
  });

  // If locationId provided, check which haven't been completed today
  if (locationId) {
    const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString();

    const { data: completions } = await supabase
      .from("checklist_completions")
      .select("template_id")
      .eq("location_id", locationId)
      .gte("completed_at", todayStart)
      .lte("completed_at", todayEnd);

    const completedTemplateIds = new Set(
      (completions || []).map((c) => c.template_id)
    );

    return dueTemplates.filter((t) => !completedTemplateIds.has(t.id));
  }

  return dueTemplates;
}

export interface TodayChecklist {
  id: string;
  template: {
    id: string;
    name: string;
    description: string | null;
    frequency: ChecklistFrequency;
    items: unknown[];
  };
  completion: ChecklistCompletion | null;
  location: {
    id: string;
    name: string;
  } | null;
  status: "pending" | "in_progress" | "completed";
  completedItems: number;
  totalItems: number;
  isOverdue: boolean;
}

export async function getTodaysChecklistsWithStatus(
  locationId?: string
): Promise<TodayChecklist[]> {
  const supabase = createClient();

  const today = new Date();
  const dayOfWeek = today.getDay();
  const dayOfMonth = today.getDate();
  const currentHour = today.getHours();

  // Get the start and end of today
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  // Get active templates
  const { data: templates, error: templatesError } = await supabase
    .from("checklist_templates")
    .select("*")
    .eq("is_active", true);

  if (templatesError) {
    throw new Error(templatesError.message);
  }

  // Filter templates that are due today
  const dueTemplates = (templates || []).filter((template) => {
    switch (template.frequency) {
      case "daily":
        return true;
      case "weekly":
        return dayOfWeek === 1; // Monday
      case "monthly":
        return dayOfMonth === 1; // First of month
      case "as_needed":
        return false;
      default:
        return false;
    }
  });

  // Get today's completions for these templates
  let completionsQuery = supabase
    .from("checklist_completions")
    .select(`
      *,
      location:locations (id, name)
    `)
    .in("template_id", dueTemplates.map((t) => t.id))
    .gte("created_at", todayStart.toISOString())
    .lte("created_at", todayEnd.toISOString());

  if (locationId) {
    completionsQuery = completionsQuery.eq("location_id", locationId);
  }

  const { data: completions, error: completionsError } = await completionsQuery;

  if (completionsError) {
    throw new Error(completionsError.message);
  }

  // Create a map of template_id to completion
  const completionMap = new Map<string, (ChecklistCompletion & { location: { id: string; name: string } | null })>();
  for (const completion of completions || []) {
    // Use the most recent completion if multiple exist
    const existing = completionMap.get(completion.template_id);
    if (!existing || new Date(completion.created_at) > new Date(existing.created_at)) {
      completionMap.set(completion.template_id, completion);
    }
  }

  // Build the result
  const result: TodayChecklist[] = dueTemplates.map((template) => {
    const completion = completionMap.get(template.id);
    const templateItems = Array.isArray(template.items) ? template.items : [];
    const completedItems = completion?.completed_items
      ? (Array.isArray(completion.completed_items) ? completion.completed_items.length : 0)
      : 0;
    const totalItems = templateItems.length;

    // Determine status
    let status: "pending" | "in_progress" | "completed" = "pending";
    if (completion) {
      if (completion.completed_at) {
        status = "completed";
      } else {
        status = "in_progress";
      }
    }

    // Determine if overdue
    // Daily checklists are overdue if it's past noon and not started
    // Weekly/monthly are overdue if it's past 5pm and not started
    let isOverdue = false;
    if (status === "pending") {
      if (template.frequency === "daily" && currentHour >= 12) {
        isOverdue = true;
      } else if ((template.frequency === "weekly" || template.frequency === "monthly") && currentHour >= 17) {
        isOverdue = true;
      }
    }

    return {
      id: completion?.id || `pending-${template.id}`,
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        frequency: template.frequency,
        items: templateItems,
      },
      completion: completion || null,
      location: completion?.location || null,
      status,
      completedItems,
      totalItems,
      isOverdue,
    };
  });

  // Sort: overdue first, then in_progress, then pending, then completed
  result.sort((a, b) => {
    // Overdue items first
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;

    // Then by status priority
    const statusOrder = { in_progress: 0, pending: 1, completed: 2 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  return result;
}

export async function getOverdueChecklists(): Promise<ChecklistTemplate[]> {
  const supabase = createClient();

  // Get daily templates that weren't completed yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStart = new Date(yesterday.setHours(0, 0, 0, 0)).toISOString();
  const yesterdayEnd = new Date(yesterday.setHours(23, 59, 59, 999)).toISOString();

  const { data: dailyTemplates, error: templatesError } = await supabase
    .from("checklist_templates")
    .select("*")
    .eq("is_active", true)
    .eq("frequency", "daily");

  if (templatesError) {
    throw new Error(templatesError.message);
  }

  // Get completions from yesterday
  const { data: completions, error: completionsError } = await supabase
    .from("checklist_completions")
    .select("template_id")
    .gte("completed_at", yesterdayStart)
    .lte("completed_at", yesterdayEnd);

  if (completionsError) {
    throw new Error(completionsError.message);
  }

  const completedTemplateIds = new Set(
    (completions || []).map((c) => c.template_id)
  );

  return (dailyTemplates || []).filter((t) => !completedTemplateIds.has(t.id));
}

export async function getPendingChecklistsCount(): Promise<number> {
  try {
    const supabase = createClient();

    const today = new Date();
  const dayOfWeek = today.getDay();
  const dayOfMonth = today.getDate();

  // Get the start and end of today
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  // Get active templates
  const { data: templates, error: templatesError } = await supabase
    .from("checklist_templates")
    .select("id, frequency")
    .eq("is_active", true);

  if (templatesError) {
    throw new Error(templatesError.message);
  }

  // Filter templates that are due today
  const dueTemplates = (templates || []).filter((template) => {
    switch (template.frequency) {
      case "daily":
        return true;
      case "weekly":
        return dayOfWeek === 1; // Monday
      case "monthly":
        return dayOfMonth === 1; // First of month
      default:
        return false;
    }
  });

  if (dueTemplates.length === 0) return 0;

  // Get today's completed checklists
  const { data: completedChecklists, error: completionsError } = await supabase
    .from("checklist_completions")
    .select("template_id")
    .in("template_id", dueTemplates.map((t) => t.id))
    .gte("created_at", todayStart.toISOString())
    .lte("created_at", todayEnd.toISOString())
    .not("completed_at", "is", null);

  if (completionsError) {
    throw new Error(completionsError.message);
  }

  const completedTemplateIds = new Set(
    (completedChecklists || []).map((c) => c.template_id)
  );

  // Count templates that haven't been completed today
    const pendingCount = dueTemplates.filter((t) => !completedTemplateIds.has(t.id)).length;

    return pendingCount;
  } catch {
    // Table may not exist yet - return 0 silently
    return 0;
  }
}
