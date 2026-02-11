import { createClient } from "@/lib/supabase";

// Box types matching the 7Degrees rate card
export const BOX_TYPES = [
  { code: "BOX_1_BOTTLE", name: "1 Bottle Box", bottles: 1, price: 5.00 },
  { code: "BOX_2_BOTTLE", name: "2 Bottle Box", bottles: 2, price: 6.00 },
  { code: "BOX_3_BOTTLE", name: "3 Bottle Box", bottles: 3, price: 7.50 },
  { code: "BOX_4_BOTTLE", name: "4 Bottle Box", bottles: 4, price: 9.50 },
  { code: "BOX_6_BOTTLE", name: "6 Bottle Box", bottles: 6, price: 12.00 },
  { code: "BOX_8_BOTTLE", name: "8 Bottle Box", bottles: 8, price: 15.00 },
  { code: "BOX_12_BOTTLE", name: "12 Bottle Box", bottles: 12, price: 20.00 },
  { code: "BOX_6_CAN", name: "6 Can Box", bottles: 6, price: 7.00, isCan: true },
] as const;

// Packing materials from 7Degrees rate card
export const PACKING_MATERIALS = [
  { code: "BROWN_PAPER", name: "Brown Paper", price: 0.705, unit: "sheet" },
  { code: "INSERT", name: "Insert", price: 1.00, unit: "piece" },
] as const;

export type BoxType = typeof BOX_TYPES[number];

export interface BoxUsageRecord {
  id: string;
  box_code: string;
  box_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  created_at: string;
}

/**
 * Record box usage for an outbound order and create billing entry
 */
export async function recordBoxUsage(
  orderId: string,
  boxCode: string,
  quantity: number
): Promise<BoxUsageRecord | null> {
  const supabase = createClient();

  // Get the order to find client_id
  const { data: order, error: orderError } = await supabase
    .from("outbound_orders")
    .select("id, client_id, order_number")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    throw new Error("Order not found");
  }

  // Find the box type
  const boxType = BOX_TYPES.find((b) => b.code === boxCode);
  if (!boxType) {
    throw new Error("Invalid box type");
  }

  // Record billable event if client exists
  if (order.client_id) {
    const usageDate = new Date().toISOString().split("T")[0];

    const { data: usageRecord, error: billingError } = await supabase.rpc("record_billable_event", {
      p_client_id: order.client_id,
      p_rate_code: boxCode,
      p_quantity: quantity,
      p_reference_type: "outbound_order",
      p_reference_id: orderId,
      p_usage_date: usageDate,
      p_notes: `Order ${order.order_number} - ${quantity}x ${boxType.name}`,
    });

    if (billingError) {
      console.error("Failed to record box billing:", billingError);
      // Don't throw - still return the box info
    }

    // Return a synthetic record for display
    return {
      id: usageRecord || crypto.randomUUID(),
      box_code: boxCode,
      box_name: boxType.name,
      quantity,
      unit_price: boxType.price,
      total: quantity * boxType.price,
      created_at: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Get box usage records for an order from usage_records
 */
export interface PackingMaterialRecord {
  id: string;
  material_code: string;
  material_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  created_at: string;
}

/**
 * Record packing material usage for an outbound order and create billing entry
 */
export async function recordPackingMaterialUsage(
  orderId: string,
  materialCode: string,
  quantity: number
): Promise<PackingMaterialRecord | null> {
  const supabase = createClient();

  // Get the order to find client_id
  const { data: order, error: orderError } = await supabase
    .from("outbound_orders")
    .select("id, client_id, order_number")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    throw new Error("Order not found");
  }

  // Find the packing material type
  const material = PACKING_MATERIALS.find((m) => m.code === materialCode);
  if (!material) {
    throw new Error("Invalid packing material type");
  }

  // Record billable event if client exists
  if (order.client_id) {
    const usageDate = new Date().toISOString().split("T")[0];

    const { data: usageRecord, error: billingError } = await supabase.rpc("record_billable_event", {
      p_client_id: order.client_id,
      p_rate_code: materialCode,
      p_quantity: quantity,
      p_reference_type: "outbound_order",
      p_reference_id: orderId,
      p_usage_date: usageDate,
      p_notes: `Order ${order.order_number} - ${quantity}x ${material.name}`,
    });

    if (billingError) {
      console.error("Failed to record packing material billing:", billingError);
      // Don't throw - still return the material info
    }

    // Return a synthetic record for display
    return {
      id: usageRecord || crypto.randomUUID(),
      material_code: materialCode,
      material_name: material.name,
      quantity,
      unit_price: material.price,
      total: quantity * material.price,
      created_at: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Get packing material usage records for an order from usage_records
 */
export async function getOrderPackingMaterialUsage(orderId: string): Promise<PackingMaterialRecord[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("usage_records")
    .select("*")
    .eq("reference_type", "outbound_order")
    .eq("reference_id", orderId)
    .in("usage_type", PACKING_MATERIALS.map((m) => m.name));

  if (error) {
    console.error("Failed to fetch packing material usage:", error);
    return [];
  }

  return (data || []).map((record) => ({
    id: record.id,
    material_code: PACKING_MATERIALS.find((m) => m.name === record.usage_type)?.code || "",
    material_name: record.usage_type,
    quantity: record.quantity,
    unit_price: record.unit_price,
    total: record.total,
    created_at: record.created_at,
  }));
}

export async function getOrderBoxUsage(orderId: string): Promise<BoxUsageRecord[]> {
  const supabase = createClient();

  // Get usage records that match box rate codes
  const boxCodes = BOX_TYPES.map((b) => b.code);

  const { data, error } = await supabase
    .from("usage_records")
    .select("*")
    .eq("reference_type", "outbound_order")
    .eq("reference_id", orderId)
    .in("usage_type", BOX_TYPES.map((b) => b.name));

  if (error) {
    console.error("Failed to fetch box usage:", error);
    return [];
  }

  return (data || []).map((record) => ({
    id: record.id,
    box_code: BOX_TYPES.find((b) => b.name === record.usage_type)?.code || "",
    box_name: record.usage_type,
    quantity: record.quantity,
    unit_price: record.unit_price,
    total: record.total,
    created_at: record.created_at,
  }));
}

/**
 * Suggest optimal box combination for a given bottle count
 */
export function suggestBoxes(bottleCount: number, isCans: boolean = false): { code: string; name: string; qty: number; price: number }[] {
  if (bottleCount <= 0) return [];

  const suggestions: { code: string; name: string; qty: number; price: number }[] = [];
  let remaining = bottleCount;

  // Filter boxes by type (cans vs bottles)
  const availableBoxes = BOX_TYPES
    .filter((b) => isCans ? b.isCan : !b.isCan)
    .sort((a, b) => b.bottles - a.bottles); // Largest first

  // Greedy algorithm: use largest boxes first
  for (const box of availableBoxes) {
    if (remaining >= box.bottles) {
      const qty = Math.floor(remaining / box.bottles);
      if (qty > 0) {
        suggestions.push({ code: box.code, name: box.name, qty, price: box.price });
        remaining -= qty * box.bottles;
      }
    }
  }

  // Handle remaining bottles with smallest box
  if (remaining > 0 && availableBoxes.length > 0) {
    const smallestBox = availableBoxes[availableBoxes.length - 1];
    suggestions.push({ code: smallestBox.code, name: smallestBox.name, qty: 1, price: smallestBox.price });
  }

  return suggestions;
}

export interface OrderItemForBoxSuggestion {
  qty: number;
  containerType: 'bottle' | 'can' | 'keg' | 'bag_in_box' | 'other';
}

export interface BoxSuggestionResult {
  bottles: { code: string; name: string; qty: number; price: number }[];
  cans: { code: string; name: string; qty: number; price: number }[];
  totalBottles: number;
  totalCans: number;
  estimatedCost: number;
  hasNonBoxItems: boolean; // kegs, bag_in_box, other don't use standard boxes
}

/**
 * Analyze order items and suggest optimal boxes based on container types
 */
export function suggestBoxesForOrder(items: OrderItemForBoxSuggestion[]): BoxSuggestionResult {
  let totalBottles = 0;
  let totalCans = 0;
  let hasNonBoxItems = false;

  for (const item of items) {
    switch (item.containerType) {
      case 'bottle':
        totalBottles += item.qty;
        break;
      case 'can':
        totalCans += item.qty;
        break;
      case 'keg':
      case 'bag_in_box':
      case 'other':
        hasNonBoxItems = true;
        break;
    }
  }

  const bottleSuggestions = suggestBoxes(totalBottles, false);
  const canSuggestions = suggestBoxes(totalCans, true);

  const estimatedCost =
    bottleSuggestions.reduce((sum, s) => sum + s.qty * s.price, 0) +
    canSuggestions.reduce((sum, s) => sum + s.qty * s.price, 0);

  return {
    bottles: bottleSuggestions,
    cans: canSuggestions,
    totalBottles,
    totalCans,
    estimatedCost,
    hasNonBoxItems,
  };
}

/**
 * Get the container types that a client has in their inventory
 * Used to filter which box options to show in the portal
 */
export async function getClientContainerTypes(clientId: string): Promise<Set<string>> {
  const supabase = createClient();

  // Get all products this client has in inventory
  const { data, error } = await supabase
    .from("inventory")
    .select(`
      product:products (container_type)
    `)
    .eq("client_id", clientId)
    .gt("qty_on_hand", 0);

  if (error) {
    console.error("Failed to fetch client container types:", error);
    return new Set(['bottle']); // Default to bottle if error
  }

  const containerTypes = new Set<string>();
  for (const item of data || []) {
    const product = Array.isArray(item.product) ? item.product[0] : item.product;
    if (product?.container_type) {
      containerTypes.add(product.container_type);
    }
  }

  // If no products found, return empty set
  return containerTypes;
}

/**
 * Get available box types for a client based on their product container types
 */
export async function getAvailableBoxTypesForClient(clientId: string): Promise<typeof BOX_TYPES[number][]> {
  const containerTypes = await getClientContainerTypes(clientId);

  // If client has no products, return empty (or you could return all)
  if (containerTypes.size === 0) {
    return [];
  }

  // Filter box types based on container types
  return BOX_TYPES.filter((box) => {
    if (box.isCan) {
      return containerTypes.has('can');
    } else {
      return containerTypes.has('bottle');
    }
  });
}

/**
 * Automatically assign and bill boxes for an outbound order based on products being shipped.
 * This is the "smart" auto-assignment that looks at what's being shipped and picks optimal boxes.
 */
export async function autoAssignBoxesForOrder(orderId: string): Promise<{
  success: boolean;
  boxesAssigned: { code: string; name: string; qty: number; total: number }[];
  totalCost: number;
  error?: string;
}> {
  const supabase = createClient();

  try {
    // 1. Get the order with items and their products (including container_type)
    const { data: order, error: orderError } = await supabase
      .from("outbound_orders")
      .select(`
        id,
        client_id,
        order_number,
        requires_repack,
        items:outbound_items (
          id,
          qty_requested,
          qty_shipped,
          product_id
        )
      `)
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return { success: false, boxesAssigned: [], totalCost: 0, error: "Order not found" };
    }

    // Skip box assignment if repack not required (shipping in original packaging)
    if (order.requires_repack === false) {
      return { success: true, boxesAssigned: [], totalCost: 0, error: "No repack required - shipping in original packaging" };
    }

    if (!order.client_id) {
      return { success: false, boxesAssigned: [], totalCost: 0, error: "Order has no client" };
    }

    // 2. Get container types for all products in this order
    const productIds = order.items.map((item: any) => item.product_id);
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, container_type")
      .in("id", productIds);

    if (productsError) {
      return { success: false, boxesAssigned: [], totalCost: 0, error: "Failed to fetch products" };
    }

    // 3. Map product IDs to container types
    const containerTypeMap = new Map<string, string>(
      (products || []).map((p) => [p.id, p.container_type || "bottle"])
    );

    // 4. Calculate totals by container type
    let totalBottles = 0;
    let totalCans = 0;

    for (const item of order.items) {
      const containerType = containerTypeMap.get(item.product_id) || "bottle";
      const qty = item.qty_shipped > 0 ? item.qty_shipped : item.qty_requested;

      switch (containerType) {
        case "bottle":
          totalBottles += qty;
          break;
        case "can":
          totalCans += qty;
          break;
        // kegs, bag_in_box, other don't use standard boxes
      }
    }

    // 5. Calculate optimal boxes
    const bottleSuggestions = suggestBoxes(totalBottles, false);
    const canSuggestions = suggestBoxes(totalCans, true);
    const allSuggestions = [...bottleSuggestions, ...canSuggestions];

    if (allSuggestions.length === 0) {
      return { success: true, boxesAssigned: [], totalCost: 0 }; // No boxes needed (maybe all kegs?)
    }

    // 6. Check if boxes have already been assigned to this order
    const { data: existingUsage } = await supabase
      .from("usage_records")
      .select("id")
      .eq("reference_type", "outbound_order")
      .eq("reference_id", orderId)
      .in("usage_type", BOX_TYPES.map((b) => b.name))
      .limit(1);

    if (existingUsage && existingUsage.length > 0) {
      return { success: false, boxesAssigned: [], totalCost: 0, error: "Boxes already assigned to this order" };
    }

    // 7. Record each box type as a billable event
    const boxesAssigned: { code: string; name: string; qty: number; total: number }[] = [];
    let totalCost = 0;

    for (const suggestion of allSuggestions) {
      const usageDate = new Date().toISOString().split("T")[0];

      const { error: billingError } = await supabase.rpc("record_billable_event", {
        p_client_id: order.client_id,
        p_rate_code: suggestion.code,
        p_quantity: suggestion.qty,
        p_reference_type: "outbound_order",
        p_reference_id: orderId,
        p_usage_date: usageDate,
        p_notes: `Order ${order.order_number} - Auto-assigned: ${suggestion.qty}x ${suggestion.name}`,
      });

      if (billingError) {
        console.error("Failed to record box billing:", billingError);
        // Continue with other boxes even if one fails
      }

      const boxTotal = suggestion.qty * suggestion.price;
      boxesAssigned.push({
        code: suggestion.code,
        name: suggestion.name,
        qty: suggestion.qty,
        total: boxTotal,
      });
      totalCost += boxTotal;
    }

    // 8. Log activity
    await supabase.from("activity_log").insert({
      entity_type: "outbound_order",
      entity_id: orderId,
      action: "boxes_auto_assigned",
      details: {
        total_bottles: totalBottles,
        total_cans: totalCans,
        boxes_assigned: boxesAssigned,
        total_cost: totalCost,
      },
    });

    return { success: true, boxesAssigned, totalCost };
  } catch (err) {
    console.error("Auto-assign boxes error:", err);
    return { success: false, boxesAssigned: [], totalCost: 0, error: (err as Error).message };
  }
}
