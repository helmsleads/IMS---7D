import { createClient } from "@/lib/supabase";
import { OrderTemplate, OrderTemplateItem, OutboundOrder } from "@/types/database";

export interface OrderTemplateWithItems extends Omit<OrderTemplate, 'items' | 'address'> {
  items: OrderTemplateItemWithProduct[];
  address: {
    id: string;
    label: string | null;
    address_line1: string;
    city: string;
    state: string;
    zip: string;
  } | null;
}

export interface OrderTemplateItemWithProduct extends OrderTemplateItem {
  product: {
    id: string;
    sku: string;
    name: string;
  };
}

export async function getOrderTemplates(clientId: string): Promise<OrderTemplateWithItems[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("order_templates")
    .select(`
      *,
      items:order_template_items (
        *,
        product:products (id, sku, name)
      ),
      address:client_addresses (id, label, address_line1, city, state, zip)
    `)
    .eq("client_id", clientId)
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getOrderTemplate(id: string): Promise<OrderTemplateWithItems | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("order_templates")
    .select(`
      *,
      items:order_template_items (
        *,
        product:products (id, sku, name)
      ),
      address:client_addresses (id, label, address_line1, city, state, zip)
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

export async function createOrderTemplate(
  template: Partial<OrderTemplate>,
  items: Partial<OrderTemplateItem>[]
): Promise<OrderTemplate> {
  const supabase = createClient();

  // Create the template
  const { data: templateRecord, error: templateError } = await supabase
    .from("order_templates")
    .insert(template)
    .select()
    .single();

  if (templateError) {
    throw new Error(templateError.message);
  }

  // Create template items
  if (items.length > 0) {
    const templateItems = items.map((item) => ({
      ...item,
      template_id: templateRecord.id,
    }));

    const { error: itemsError } = await supabase
      .from("order_template_items")
      .insert(templateItems);

    if (itemsError) {
      throw new Error(itemsError.message);
    }
  }

  return templateRecord;
}

export async function updateOrderTemplate(
  id: string,
  template: Partial<OrderTemplate>
): Promise<OrderTemplate> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("order_templates")
    .update(template)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteOrderTemplate(id: string): Promise<void> {
  const supabase = createClient();

  // Delete items first
  const { error: itemsError } = await supabase
    .from("order_template_items")
    .delete()
    .eq("template_id", id);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  // Delete template
  const { error } = await supabase
    .from("order_templates")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export interface OrderOverrides {
  ship_to_address?: string;
  notes?: string;
}

export async function createOrderFromTemplate(
  templateId: string,
  overrides?: OrderOverrides
): Promise<OutboundOrder> {
  const supabase = createClient();

  // Get the template with items
  const template = await getOrderTemplate(templateId);

  if (!template) {
    throw new Error("Template not found");
  }

  // Generate order number
  const year = new Date().getFullYear();
  const prefix = `ORD-${year}-`;

  const { data: lastOrder, error: lastOrderError } = await supabase
    .from("outbound_orders")
    .select("order_number")
    .like("order_number", `${prefix}%`)
    .order("order_number", { ascending: false })
    .limit(1);

  if (lastOrderError) {
    throw new Error(lastOrderError.message);
  }

  let nextNumber = 1;
  if (lastOrder && lastOrder.length > 0) {
    const lastSequence = parseInt(lastOrder[0].order_number.replace(prefix, ""), 10);
    if (!isNaN(lastSequence)) {
      nextNumber = lastSequence + 1;
    }
  }

  const orderNumber = `${prefix}${nextNumber.toString().padStart(5, "0")}`;

  // Build ship_to_address from template address
  let shipToAddress = overrides?.ship_to_address;
  if (!shipToAddress && template.address) {
    const addr = template.address;
    shipToAddress = `${addr.address_line1}, ${addr.city}, ${addr.state} ${addr.zip}`;
  }

  // Create the order
  const { data: order, error: orderError } = await supabase
    .from("outbound_orders")
    .insert({
      order_number: orderNumber,
      client_id: template.client_id,
      status: "pending",
      ship_to_address: shipToAddress,
      notes: overrides?.notes || null,
    })
    .select()
    .single();

  if (orderError) {
    throw new Error(orderError.message);
  }

  // Create order items from template items
  if (template.items.length > 0) {
    const orderItems = template.items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      qty_requested: item.quantity,
      qty_shipped: 0,
      unit_price: 0,
    }));

    const { error: itemsError } = await supabase
      .from("outbound_items")
      .insert(orderItems);

    if (itemsError) {
      throw new Error(itemsError.message);
    }
  }

  return order;
}
