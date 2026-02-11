import { createClient } from "@/lib/supabase";

export interface PortalTemplate {
  id: string;
  name: string;
  description: string | null;
  address_id: string | null;
  created_at: string;
  item_count: number;
  address: {
    id: string;
    label: string | null;
    address_line1: string;
    city: string;
    state: string;
    zip: string;
  } | null;
}

export interface PortalTemplateItem {
  id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  quantity: number;
}

export interface PortalTemplateWithItems extends Omit<PortalTemplate, 'item_count'> {
  items: PortalTemplateItem[];
}

export interface CreateTemplateItem {
  product_id: string;
  quantity: number;
}

export interface CreateTemplateData {
  name: string;
  description?: string | null;
  address_id?: string | null;
}

export async function getMyTemplates(clientId: string): Promise<PortalTemplate[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("order_templates")
    .select(`
      id,
      name,
      description,
      address_id,
      created_at,
      items:order_template_items (id),
      address:client_addresses (id, label, address_line1, city, state, zip)
    `)
    .eq("client_id", clientId)
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    address_id: template.address_id,
    created_at: template.created_at,
    item_count: template.items?.length || 0,
    address: Array.isArray(template.address) ? template.address[0] : template.address,
  }));
}

export async function getMyTemplate(
  clientId: string,
  templateId: string
): Promise<PortalTemplateWithItems | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("order_templates")
    .select(`
      id,
      name,
      description,
      address_id,
      created_at,
      items:order_template_items (
        id,
        product_id,
        quantity,
        product:products (id, sku, name)
      ),
      address:client_addresses (id, label, address_line1, city, state, zip)
    `)
    .eq("id", templateId)
    .eq("client_id", clientId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  const items: PortalTemplateItem[] = (data.items || []).map((item: any) => {
    const product = Array.isArray(item.product) ? item.product[0] : item.product;
    return {
      id: item.id,
      product_id: item.product_id,
      product_sku: product?.sku || "",
      product_name: product?.name || "Unknown",
      quantity: item.quantity,
    };
  });

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    address_id: data.address_id,
    created_at: data.created_at,
    address: Array.isArray(data.address) ? data.address[0] : data.address,
    items,
  };
}

export async function createMyTemplate(
  clientId: string,
  data: CreateTemplateData,
  items: CreateTemplateItem[]
): Promise<PortalTemplateWithItems> {
  const supabase = createClient();

  // Verify address belongs to client if provided
  if (data.address_id) {
    const { data: address, error: addrError } = await supabase
      .from("client_addresses")
      .select("id")
      .eq("id", data.address_id)
      .eq("client_id", clientId)
      .single();

    if (addrError || !address) {
      throw new Error("Invalid address");
    }
  }

  // Create the template
  const { data: template, error: templateError } = await supabase
    .from("order_templates")
    .insert({
      client_id: clientId,
      name: data.name,
      description: data.description || null,
      address_id: data.address_id || null,
    })
    .select()
    .single();

  if (templateError) {
    throw new Error(templateError.message);
  }

  // Create template items
  if (items.length > 0) {
    const templateItems = items.map((item) => ({
      template_id: template.id,
      product_id: item.product_id,
      quantity: item.quantity,
    }));

    const { error: itemsError } = await supabase
      .from("order_template_items")
      .insert(templateItems);

    if (itemsError) {
      // Rollback template
      await supabase.from("order_templates").delete().eq("id", template.id);
      throw new Error(itemsError.message);
    }
  }

  // Fetch and return the complete template
  const result = await getMyTemplate(clientId, template.id);
  if (!result) {
    throw new Error("Failed to retrieve created template");
  }

  return result;
}

export async function updateMyTemplate(
  clientId: string,
  templateId: string,
  data: Partial<CreateTemplateData>
): Promise<PortalTemplateWithItems> {
  const supabase = createClient();

  // Verify ownership
  const { data: existing, error: existError } = await supabase
    .from("order_templates")
    .select("id")
    .eq("id", templateId)
    .eq("client_id", clientId)
    .single();

  if (existError || !existing) {
    throw new Error("Template not found or access denied");
  }

  // Verify address belongs to client if provided
  if (data.address_id) {
    const { data: address, error: addrError } = await supabase
      .from("client_addresses")
      .select("id")
      .eq("id", data.address_id)
      .eq("client_id", clientId)
      .single();

    if (addrError || !address) {
      throw new Error("Invalid address");
    }
  }

  // Update the template
  const { error: updateError } = await supabase
    .from("order_templates")
    .update({
      name: data.name,
      description: data.description,
      address_id: data.address_id,
    })
    .eq("id", templateId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  // Fetch and return the updated template
  const result = await getMyTemplate(clientId, templateId);
  if (!result) {
    throw new Error("Failed to retrieve updated template");
  }

  return result;
}

export async function deleteMyTemplate(
  clientId: string,
  templateId: string
): Promise<void> {
  const supabase = createClient();

  // Verify ownership
  const { data: existing, error: existError } = await supabase
    .from("order_templates")
    .select("id")
    .eq("id", templateId)
    .eq("client_id", clientId)
    .single();

  if (existError || !existing) {
    throw new Error("Template not found or access denied");
  }

  // Delete items first
  const { error: itemsError } = await supabase
    .from("order_template_items")
    .delete()
    .eq("template_id", templateId);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  // Delete template
  const { error } = await supabase
    .from("order_templates")
    .delete()
    .eq("id", templateId);

  if (error) {
    throw new Error(error.message);
  }
}

export interface PortalOrder {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
}

export async function orderFromMyTemplate(
  clientId: string,
  templateId: string
): Promise<PortalOrder> {
  const supabase = createClient();

  // Get the template with items (verify ownership)
  const template = await getMyTemplate(clientId, templateId);
  if (!template) {
    throw new Error("Template not found or access denied");
  }

  if (template.items.length === 0) {
    throw new Error("Cannot create order from empty template");
  }

  // Generate order number
  const year = new Date().getFullYear();
  const prefix = `ORD-${year}-`;

  const { data: lastOrder } = await supabase
    .from("outbound_orders")
    .select("order_number")
    .like("order_number", `${prefix}%`)
    .order("order_number", { ascending: false })
    .limit(1);

  let nextNumber = 1;
  if (lastOrder && lastOrder.length > 0) {
    const lastSequence = parseInt(lastOrder[0].order_number.replace(prefix, ""), 10);
    if (!isNaN(lastSequence)) {
      nextNumber = lastSequence + 1;
    }
  }

  const orderNumber = `${prefix}${nextNumber.toString().padStart(5, "0")}`;

  // Build ship_to_address from template address
  let shipToAddress: string | null = null;
  if (template.address) {
    const addr = template.address;
    shipToAddress = `${addr.address_line1}, ${addr.city}, ${addr.state} ${addr.zip}`;
  }

  // Create the order
  const { data: order, error: orderError } = await supabase
    .from("outbound_orders")
    .insert({
      order_number: orderNumber,
      client_id: clientId,
      status: "pending",
      ship_to_address: shipToAddress,
      requested_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (orderError) {
    throw new Error(orderError.message);
  }

  // Create order items
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
    // Rollback order
    await supabase.from("outbound_orders").delete().eq("id", order.id);
    throw new Error(itemsError.message);
  }

  // Log activity
  await supabase.from("activity_log").insert({
    entity_type: "outbound_order",
    entity_id: order.id,
    action: "created_from_template",
    details: {
      order_number: orderNumber,
      template_id: templateId,
      template_name: template.name,
      client_id: clientId,
      item_count: template.items.length,
    },
  });

  return {
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    created_at: order.created_at,
  };
}
