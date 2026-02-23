import { createClient } from "@/lib/supabase";
import {
  WarehouseTask,
  WarehouseTaskType,
  WarehouseTaskStatus,
  InspectionResultRecord,
  InspectionOverallResult,
  PickListItem,
  InspectionCriterion,
} from "@/types/database";

// ============================================================
// Types
// ============================================================

export interface WarehouseTaskFilters {
  taskType?: WarehouseTaskType;
  status?: WarehouseTaskStatus | WarehouseTaskStatus[];
  assignedTo?: string;
  clientId?: string;
  orderId?: string;
  orderType?: "inbound" | "outbound";
  priority?: number;
}

export interface WarehouseTaskWithRelations extends WarehouseTask {
  product?: { id: string; sku: string; name: string; barcode?: string | null } | null;
  client?: { id: string; company_name: string } | null;
  source_location?: { id: string; name: string } | null;
  source_sublocation?: { id: string; code: string; name: string | null } | null;
  destination_location?: { id: string; name: string } | null;
  destination_sublocation?: { id: string; code: string; name: string | null } | null;
  lpn?: { id: string; lpn_number: string; container_type: string } | null;
  lot?: { id: string; lot_number: string; expiration_date: string | null } | null;
}

export interface CreateWarehouseTaskParams {
  taskType: WarehouseTaskType;
  productId?: string;
  orderId?: string;
  orderType?: "inbound" | "outbound";
  clientId?: string;
  lpnId?: string;
  lotId?: string;
  sourceLocationId?: string;
  sourceSublocationId?: string;
  destinationLocationId?: string;
  destinationSublocationId?: string;
  qtyRequested?: number;
  priority?: number;
  metadata?: Record<string, unknown>;
  notes?: string;
}

export interface TaskCountsByType {
  inspection: { pending: number; in_progress: number };
  putaway: { pending: number; in_progress: number };
  pick: { pending: number; in_progress: number };
}

// ============================================================
// Task CRUD
// ============================================================

const TASK_SELECT = `
  *,
  product:products (id, sku, name, barcode),
  client:clients (id, company_name),
  source_location:locations!warehouse_tasks_source_location_id_fkey (id, name),
  source_sublocation:sublocations!warehouse_tasks_source_sublocation_id_fkey (id, code, name),
  destination_location:locations!warehouse_tasks_destination_location_id_fkey (id, name),
  destination_sublocation:sublocations!warehouse_tasks_destination_sublocation_id_fkey (id, code, name),
  lpn:lpns (id, lpn_number, container_type),
  lot:lots (id, lot_number, expiration_date)
`;

export async function getWarehouseTasks(
  filters?: WarehouseTaskFilters
): Promise<WarehouseTaskWithRelations[]> {
  const supabase = createClient();

  let query = supabase
    .from("warehouse_tasks")
    .select(TASK_SELECT)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });

  if (filters?.taskType) {
    query = query.eq("task_type", filters.taskType);
  }

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query = query.in("status", filters.status);
    } else {
      query = query.eq("status", filters.status);
    }
  }

  if (filters?.assignedTo) {
    query = query.eq("assigned_to", filters.assignedTo);
  }

  if (filters?.clientId) {
    query = query.eq("client_id", filters.clientId);
  }

  if (filters?.orderId) {
    query = query.eq("order_id", filters.orderId);
  }

  if (filters?.orderType) {
    query = query.eq("order_type", filters.orderType);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map(normalizeTaskRelations);
}

export async function getWarehouseTask(
  id: string
): Promise<WarehouseTaskWithRelations | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("warehouse_tasks")
    .select(TASK_SELECT)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }

  return normalizeTaskRelations(data);
}

export async function createWarehouseTask(
  params: CreateWarehouseTaskParams
): Promise<WarehouseTask> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const prefix =
    params.taskType === "inspection"
      ? "INS"
      : params.taskType === "putaway"
      ? "PUT"
      : "PCK";

  const { data: taskNumber, error: rpcError } = await supabase.rpc(
    "generate_task_number",
    { p_prefix: prefix }
  );

  if (rpcError) {
    throw new Error(`Failed to generate task number: ${rpcError.message}`);
  }

  const { data, error } = await supabase
    .from("warehouse_tasks")
    .insert({
      task_number: taskNumber,
      task_type: params.taskType,
      status: "pending",
      priority: params.priority ?? 5,
      client_id: params.clientId || null,
      product_id: params.productId || null,
      lpn_id: params.lpnId || null,
      lot_id: params.lotId || null,
      order_id: params.orderId || null,
      order_type: params.orderType || null,
      source_location_id: params.sourceLocationId || null,
      source_sublocation_id: params.sourceSublocationId || null,
      destination_location_id: params.destinationLocationId || null,
      destination_sublocation_id: params.destinationSublocationId || null,
      qty_requested: params.qtyRequested ?? 0,
      metadata: params.metadata ?? {},
      notes: params.notes || null,
      created_by: user?.id || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateWarehouseTask(
  id: string,
  updates: Partial<WarehouseTask>
): Promise<WarehouseTask> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("warehouse_tasks")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

// ============================================================
// Task Lifecycle
// ============================================================

export async function assignTask(
  taskId: string,
  userId: string
): Promise<WarehouseTask> {
  return updateWarehouseTask(taskId, {
    status: "assigned",
    assigned_to: userId,
    assigned_at: new Date().toISOString(),
  } as Partial<WarehouseTask>);
}

export async function startTask(taskId: string): Promise<WarehouseTask> {
  return updateWarehouseTask(taskId, {
    status: "in_progress",
    started_at: new Date().toISOString(),
  } as Partial<WarehouseTask>);
}

export async function completeTask(
  taskId: string,
  opts?: { qtyCompleted?: number; notes?: string }
): Promise<WarehouseTask> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return updateWarehouseTask(taskId, {
    status: "completed",
    qty_completed: opts?.qtyCompleted ?? 0,
    completed_at: new Date().toISOString(),
    completed_by: user?.id || null,
    notes: opts?.notes || null,
  } as Partial<WarehouseTask>);
}

export async function failTask(
  taskId: string,
  reason: string
): Promise<WarehouseTask> {
  return updateWarehouseTask(taskId, {
    status: "failed",
    notes: reason,
    completed_at: new Date().toISOString(),
  } as Partial<WarehouseTask>);
}

export async function cancelTask(taskId: string): Promise<WarehouseTask> {
  return updateWarehouseTask(taskId, {
    status: "cancelled",
    completed_at: new Date().toISOString(),
  } as Partial<WarehouseTask>);
}

// ============================================================
// Queue Queries
// ============================================================

export async function getMyTasks(
  userId: string
): Promise<WarehouseTaskWithRelations[]> {
  return getWarehouseTasks({
    assignedTo: userId,
    status: ["assigned", "in_progress"],
  });
}

export async function getTaskCountsByType(): Promise<TaskCountsByType> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("warehouse_tasks")
    .select("task_type, status")
    .in("status", ["pending", "assigned", "in_progress"]);

  if (error) {
    throw new Error(error.message);
  }

  const counts: TaskCountsByType = {
    inspection: { pending: 0, in_progress: 0 },
    putaway: { pending: 0, in_progress: 0 },
    pick: { pending: 0, in_progress: 0 },
  };

  for (const row of data || []) {
    const type = row.task_type as WarehouseTaskType;
    if (type in counts) {
      if (row.status === "pending") {
        counts[type].pending++;
      } else if (row.status === "assigned" || row.status === "in_progress") {
        counts[type].in_progress++;
      }
    }
  }

  return counts;
}

export async function getPendingTaskCount(): Promise<number> {
  const supabase = createClient();

  const { count, error } = await supabase
    .from("warehouse_tasks")
    .select("*", { count: "exact", head: true })
    .in("status", ["pending", "assigned"]);

  if (error) return 0;
  return count || 0;
}

// ============================================================
// Inspection
// ============================================================

export async function getInspectionCriteria(
  clientId: string
): Promise<InspectionCriterion[]> {
  const supabase = createClient();

  // Get the client's workflow profile
  const { data: client } = await supabase
    .from("clients")
    .select("workflow_profile_id")
    .eq("id", clientId)
    .single();

  if (!client?.workflow_profile_id) {
    return getDefaultInspectionCriteria();
  }

  const { data: profile } = await supabase
    .from("workflow_profiles")
    .select("inspection_criteria")
    .eq("id", client.workflow_profile_id)
    .single();

  const criteria = profile?.inspection_criteria as InspectionCriterion[] | null;
  if (!criteria || criteria.length === 0) {
    return getDefaultInspectionCriteria();
  }

  return criteria;
}

function getDefaultInspectionCriteria(): InspectionCriterion[] {
  return [
    { id: "visual", label: "Visual inspection - no damage", type: "pass_fail", required: true },
    { id: "qty_match", label: "Quantity matches PO", type: "pass_fail", required: true },
    { id: "label_check", label: "Labels intact and legible", type: "pass_fail", required: false },
  ];
}

export async function submitInspectionResult(
  taskId: string,
  params: {
    results: InspectionResultRecord["results"];
    overallResult: InspectionOverallResult;
    notes?: string;
  }
): Promise<InspectionResultRecord> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get the task
  const task = await getWarehouseTask(taskId);
  if (!task) throw new Error("Task not found");

  // 1. Insert inspection result
  const { data: result, error } = await supabase
    .from("inspection_results")
    .insert({
      task_id: taskId,
      results: params.results,
      overall_result: params.overallResult,
      inspector_notes: params.notes || null,
      inspected_by: user?.id || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // 2. Handle based on result
  if (params.overallResult === "pass") {
    // Release from quarantine
    if (task.product_id && task.source_location_id) {
      await supabase
        .from("inventory")
        .update({ status: "available", status_notes: "Passed inspection" })
        .eq("product_id", task.product_id)
        .eq("location_id", task.source_location_id)
        .eq("status", "quarantine");
    }

    // Auto-create putaway task
    await createPutawayTask({
      productId: task.product_id || undefined,
      orderId: task.order_id || undefined,
      orderType: "inbound",
      clientId: task.client_id || undefined,
      sourceLocationId: task.source_location_id || undefined,
      qtyRequested: task.qty_requested,
      lpnId: task.lpn_id || undefined,
      metadata: { fromInspection: taskId },
    });
  } else if (params.overallResult === "fail") {
    // Report damage if applicable
    if (task.product_id && task.order_id) {
      try {
        const { reportReceivingDamage } = await import("./inbound");
        await reportReceivingDamage(
          task.order_id,
          task.product_id,
          task.qty_requested,
          "inspection_failure",
          params.notes || "Failed inspection"
        );
      } catch (err) {
        console.error("Failed to create damage report:", err);
      }
    }
  }

  // 3. Complete the inspection task
  await completeTask(taskId, {
    qtyCompleted: task.qty_requested,
    notes: `Inspection ${params.overallResult}: ${params.notes || ""}`,
  });

  return result;
}

// ============================================================
// Putaway
// ============================================================

export async function createPutawayTask(params: {
  productId?: string;
  orderId?: string;
  orderType?: "inbound" | "outbound";
  clientId?: string;
  sourceLocationId?: string;
  qtyRequested?: number;
  lpnId?: string;
  metadata?: Record<string, unknown>;
}): Promise<WarehouseTask> {
  // Try to get suggested destination
  let destinationLocationId: string | undefined;
  let destinationSublocationId: string | undefined;

  if (params.productId && params.sourceLocationId) {
    try {
      const { getSuggestedPutAway } = await import("./inventory");
      const suggestion = await getSuggestedPutAway(
        params.productId,
        params.sourceLocationId,
        params.qtyRequested || 1
      );
      if (suggestion?.suggestedSublocationId) {
        destinationLocationId = params.sourceLocationId;
        destinationSublocationId = suggestion.suggestedSublocationId;
      }
    } catch {
      // Non-fatal — putaway task still created without suggestion
    }
  }

  // Determine priority: check if product is perishable
  let priority = 5;
  if (params.productId) {
    const supabase = createClient();
    const { data: product } = await supabase
      .from("products")
      .select("product_type")
      .eq("id", params.productId)
      .single();

    if (product?.product_type === "food" || product?.product_type === "pharma") {
      priority = 8;
    }
  }

  return createWarehouseTask({
    taskType: "putaway",
    productId: params.productId,
    orderId: params.orderId,
    orderType: params.orderType || "inbound",
    clientId: params.clientId,
    sourceLocationId: params.sourceLocationId,
    destinationLocationId,
    destinationSublocationId,
    qtyRequested: params.qtyRequested,
    lpnId: params.lpnId,
    priority,
    metadata: params.metadata ?? {},
  });
}

export async function completePutawayTask(
  taskId: string,
  sublocationId: string
): Promise<void> {
  const task = await getWarehouseTask(taskId);
  if (!task) throw new Error("Task not found");

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If task has an LPN, move the LPN
  if (task.lpn_id && task.source_location_id) {
    try {
      const { moveLPN } = await import("./lpns");
      await moveLPN(task.lpn_id, task.source_location_id, sublocationId);
    } catch (err) {
      console.error("Failed to move LPN:", err);
    }
  }

  // Move inventory to sublocation
  if (task.product_id && task.source_location_id) {
    try {
      const { confirmPutAway } = await import("./inventory");
      await confirmPutAway(task.product_id, task.source_location_id, sublocationId);
    } catch (err) {
      console.error("Failed to confirm putaway:", err);
    }

    // Log inventory transaction
    try {
      const { updateInventoryWithTransaction } = await import("./inventory-transactions");
      await updateInventoryWithTransaction({
        productId: task.product_id,
        locationId: task.source_location_id,
        sublocationId,
        transactionType: "putaway",
        qtyChange: 0, // Putaway doesn't change qty, just assigns sublocation
        referenceType: "warehouse_task",
        referenceId: taskId,
        notes: `Putaway to sublocation`,
        performedBy: user?.id,
      });
    } catch (err) {
      console.error("Failed to log putaway transaction:", err);
    }
  }

  // Complete the task
  await completeTask(taskId, {
    qtyCompleted: task.qty_requested,
    notes: `Put away to sublocation ${sublocationId}`,
  });

  // Update destination on task
  await updateWarehouseTask(taskId, {
    destination_sublocation_id: sublocationId,
  } as Partial<WarehouseTask>);
}

// ============================================================
// Pick List Generation (FEFO)
// ============================================================

export interface PickListItemWithRelations extends PickListItem {
  product?: { id: string; sku: string; name: string; barcode?: string | null } | null;
  lot?: { id: string; lot_number: string; expiration_date: string | null } | null;
  location?: { id: string; name: string } | null;
  sublocation?: { id: string; code: string; name: string | null } | null;
}

export async function generatePickList(
  outboundOrderId: string,
  locationId: string
): Promise<{ task: WarehouseTask; items: PickListItem[] }> {
  const supabase = createClient();

  // 1. Fetch outbound items
  const { data: outboundItems, error: oiError } = await supabase
    .from("outbound_items")
    .select(`
      id,
      product_id,
      qty_requested,
      qty_shipped,
      product:products (id, sku, name, barcode, product_type)
    `)
    .eq("order_id", outboundOrderId)
    .gt("qty_requested", 0);

  if (oiError) throw new Error(oiError.message);
  if (!outboundItems || outboundItems.length === 0) {
    throw new Error("No items to pick for this order");
  }

  // Get order for client_id
  const { data: order } = await supabase
    .from("outbound_orders")
    .select("client_id")
    .eq("id", outboundOrderId)
    .single();

  // 2. Create the pick task
  const task = await createWarehouseTask({
    taskType: "pick",
    orderId: outboundOrderId,
    orderType: "outbound",
    clientId: order?.client_id || undefined,
    sourceLocationId: locationId,
    qtyRequested: outboundItems.reduce((sum, oi) => sum + (oi.qty_requested - (oi.qty_shipped || 0)), 0),
    priority: 6,
    metadata: { itemCount: outboundItems.length },
  });

  // 3. For each outbound item, allocate using FEFO
  const pickItems: PickListItem[] = [];
  let sequenceNumber = 1;

  for (const oi of outboundItems) {
    const qtyNeeded = oi.qty_requested - (oi.qty_shipped || 0);
    if (qtyNeeded <= 0) continue;

    let qtyRemaining = qtyNeeded;

    // a. Try lot inventory first (FEFO ordering)
    const { data: lotInventory } = await supabase
      .from("lot_inventory")
      .select(`
        id,
        lot_id,
        location_id,
        sublocation_id,
        qty_on_hand,
        qty_reserved,
        lot:lots (id, lot_number, expiration_date)
      `)
      .eq("product_id", oi.product_id)
      .eq("location_id", locationId)
      .gt("qty_on_hand", 0)
      .order("lot(expiration_date)", { ascending: true, nullsFirst: false });

    if (lotInventory) {
      for (const li of lotInventory) {
        if (qtyRemaining <= 0) break;
        const available = li.qty_on_hand - (li.qty_reserved || 0);
        if (available <= 0) continue;

        const allocateQty = Math.min(qtyRemaining, available);
        const lot = Array.isArray(li.lot) ? li.lot[0] : li.lot;

        const { data: pickItem, error: piError } = await supabase
          .from("pick_list_items")
          .insert({
            task_id: task.id,
            outbound_item_id: oi.id,
            product_id: oi.product_id,
            lot_id: lot?.id || li.lot_id,
            location_id: locationId,
            sublocation_id: li.sublocation_id,
            qty_allocated: allocateQty,
            sequence_number: sequenceNumber++,
            status: "pending",
          })
          .select()
          .single();

        if (!piError && pickItem) {
          pickItems.push(pickItem);
        }
        qtyRemaining -= allocateQty;
      }
    }

    // b. If still need more, try non-lot inventory
    if (qtyRemaining > 0) {
      const { data: regularInventory } = await supabase
        .from("inventory")
        .select(`
          id,
          product_id,
          location_id,
          sublocation_id,
          qty_on_hand,
          qty_reserved
        `)
        .eq("product_id", oi.product_id)
        .eq("location_id", locationId)
        .gt("qty_on_hand", 0)
        .order("created_at", { ascending: true });

      if (regularInventory) {
        for (const inv of regularInventory) {
          if (qtyRemaining <= 0) break;
          const available = inv.qty_on_hand - (inv.qty_reserved || 0);
          if (available <= 0) continue;

          const allocateQty = Math.min(qtyRemaining, available);

          const { data: pickItem, error: piError } = await supabase
            .from("pick_list_items")
            .insert({
              task_id: task.id,
              outbound_item_id: oi.id,
              product_id: oi.product_id,
              lot_id: null,
              location_id: locationId,
              sublocation_id: inv.sublocation_id,
              qty_allocated: allocateQty,
              sequence_number: sequenceNumber++,
              status: "pending",
            })
            .select()
            .single();

          if (!piError && pickItem) {
            pickItems.push(pickItem);
          }
          qtyRemaining -= allocateQty;
        }
      }
    }
  }

  return { task, items: pickItems };
}

export async function getPickListItems(
  taskId: string
): Promise<PickListItemWithRelations[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("pick_list_items")
    .select(`
      *,
      product:products (id, sku, name, barcode),
      lot:lots (id, lot_number, expiration_date),
      location:locations (id, name),
      sublocation:sublocations (id, code, name)
    `)
    .eq("task_id", taskId)
    .order("sequence_number", { ascending: true });

  if (error) throw new Error(error.message);

  return (data || []).map((item) => ({
    ...item,
    product: Array.isArray(item.product) ? item.product[0] : item.product,
    lot: Array.isArray(item.lot) ? item.lot[0] : item.lot,
    location: Array.isArray(item.location) ? item.location[0] : item.location,
    sublocation: Array.isArray(item.sublocation) ? item.sublocation[0] : item.sublocation,
  }));
}

export async function recordPickItem(
  pickItemId: string,
  qtyPicked: number,
  pickedBy?: string
): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Update the pick list item
  const { data: pickItem, error } = await supabase
    .from("pick_list_items")
    .update({
      qty_picked: qtyPicked,
      status: "picked",
      picked_by: pickedBy || user?.id || null,
      picked_at: new Date().toISOString(),
    })
    .eq("id", pickItemId)
    .select("*, task:warehouse_tasks(id, order_id)")
    .single();

  if (error) throw new Error(error.message);

  // Update outbound item qty_shipped if applicable
  if (pickItem.outbound_item_id) {
    const { data: currentOI } = await supabase
      .from("outbound_items")
      .select("qty_shipped")
      .eq("id", pickItem.outbound_item_id)
      .single();

    if (currentOI) {
      await supabase
        .from("outbound_items")
        .update({ qty_shipped: (currentOI.qty_shipped || 0) + qtyPicked })
        .eq("id", pickItem.outbound_item_id);
    }
  }

  // Deduct inventory
  if (pickItem.product_id && pickItem.location_id) {
    try {
      const { updateInventoryWithTransaction } = await import("./inventory-transactions");
      await updateInventoryWithTransaction({
        productId: pickItem.product_id,
        locationId: pickItem.location_id,
        sublocationId: pickItem.sublocation_id,
        transactionType: "pick",
        qtyChange: -qtyPicked,
        referenceType: "warehouse_task",
        referenceId: pickItem.task_id,
        lotId: pickItem.lot_id,
        notes: `Picked ${qtyPicked} units`,
        performedBy: user?.id,
      });
    } catch (err) {
      console.error("Failed to log pick transaction:", err);
    }
  }

  // Check if all items in task are done
  await checkAndCompletePickTask(pickItem.task_id);
}

export async function recordShortPick(
  pickItemId: string,
  qtyShort: number,
  reason?: string
): Promise<void> {
  const supabase = createClient();

  const { data: pickItem, error } = await supabase
    .from("pick_list_items")
    .update({
      qty_short: qtyShort,
      status: "short",
      notes: reason || "Short pick",
    })
    .eq("id", pickItemId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Log activity
  await supabase.from("activity_log").insert({
    entity_type: "pick_list_item",
    entity_id: pickItemId,
    action: "short_pick",
    details: { qty_short: qtyShort, reason },
  });

  // Check if all items are accounted for
  await checkAndCompletePickTask(pickItem.task_id);
}

async function checkAndCompletePickTask(taskId: string): Promise<void> {
  const supabase = createClient();

  const { data: items } = await supabase
    .from("pick_list_items")
    .select("status, qty_allocated, qty_picked, qty_short")
    .eq("task_id", taskId);

  if (!items) return;

  const allDone = items.every(
    (item) => item.status === "picked" || item.status === "short" || item.status === "skipped"
  );

  if (allDone) {
    const totalPicked = items.reduce((sum, item) => sum + (item.qty_picked || 0), 0);
    await completeTask(taskId, {
      qtyCompleted: totalPicked,
      notes: `Pick complete. ${totalPicked} units picked, ${items.filter((i) => i.status === "short").length} short picks`,
    });
  }
}

// ============================================================
// Helpers
// ============================================================

function normalizeTaskRelations(data: Record<string, unknown>): WarehouseTaskWithRelations {
  return {
    ...data,
    product: Array.isArray(data.product) ? data.product[0] : data.product,
    client: Array.isArray(data.client) ? data.client[0] : data.client,
    source_location: Array.isArray(data.source_location) ? data.source_location[0] : data.source_location,
    source_sublocation: Array.isArray(data.source_sublocation) ? data.source_sublocation[0] : data.source_sublocation,
    destination_location: Array.isArray(data.destination_location) ? data.destination_location[0] : data.destination_location,
    destination_sublocation: Array.isArray(data.destination_sublocation) ? data.destination_sublocation[0] : data.destination_sublocation,
    lpn: Array.isArray(data.lpn) ? data.lpn[0] : data.lpn,
    lot: Array.isArray(data.lot) ? data.lot[0] : data.lot,
  } as WarehouseTaskWithRelations;
}
