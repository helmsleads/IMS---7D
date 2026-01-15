import { createClient } from "@/lib/supabase";

export interface TransferItem {
  productId: string;
  qtyRequested: number;
}

export interface StockTransfer {
  id: string;
  transfer_number: string;
  from_location_id: string;
  to_location_id: string;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  completed_by: string | null;
}

export interface StockTransferWithDetails extends StockTransfer {
  from_location: {
    id: string;
    name: string;
  };
  to_location: {
    id: string;
    name: string;
  };
  items: {
    id: string;
    product_id: string;
    qty_requested: number;
    qty_transferred: number;
    product: {
      id: string;
      sku: string;
      name: string;
    };
  }[];
}

export async function createTransfer(
  fromLocationId: string,
  toLocationId: string,
  items: TransferItem[],
  notes?: string
): Promise<StockTransfer> {
  const supabase = createClient();

  // Generate transfer number
  const transferNumber = `TRF-${Date.now().toString(36).toUpperCase()}`;

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  // Create the transfer
  const { data: transfer, error: transferError } = await supabase
    .from("stock_transfers")
    .insert({
      transfer_number: transferNumber,
      from_location_id: fromLocationId,
      to_location_id: toLocationId,
      status: "pending",
      notes: notes || null,
      created_by: user?.id || null,
    })
    .select()
    .single();

  if (transferError) {
    throw new Error(transferError.message);
  }

  // Create transfer items
  const transferItems = items.map((item) => ({
    transfer_id: transfer.id,
    product_id: item.productId,
    qty_requested: item.qtyRequested,
    qty_transferred: 0,
  }));

  const { error: itemsError } = await supabase
    .from("stock_transfer_items")
    .insert(transferItems);

  if (itemsError) {
    // Rollback transfer if items fail
    await supabase.from("stock_transfers").delete().eq("id", transfer.id);
    throw new Error(itemsError.message);
  }

  // Log activity
  await supabase.from("activity_log").insert({
    entity_type: "stock_transfer",
    entity_id: transfer.id,
    action: "created",
    details: {
      transfer_number: transferNumber,
      from_location_id: fromLocationId,
      to_location_id: toLocationId,
      item_count: items.length,
    },
  });

  return transfer;
}

export async function getTransfers(): Promise<StockTransferWithDetails[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("stock_transfers")
    .select(`
      *,
      from_location:locations!stock_transfers_from_location_id_fkey (
        id,
        name
      ),
      to_location:locations!stock_transfers_to_location_id_fkey (
        id,
        name
      ),
      items:stock_transfer_items (
        id,
        product_id,
        qty_requested,
        qty_transferred,
        product:products (
          id,
          sku,
          name
        )
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getTransfer(id: string): Promise<StockTransferWithDetails | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("stock_transfers")
    .select(`
      *,
      from_location:locations!stock_transfers_from_location_id_fkey (
        id,
        name
      ),
      to_location:locations!stock_transfers_to_location_id_fkey (
        id,
        name
      ),
      items:stock_transfer_items (
        id,
        product_id,
        qty_requested,
        qty_transferred,
        product:products (
          id,
          sku,
          name
        )
      )
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

export async function completeTransfer(transferId: string): Promise<StockTransferWithDetails> {
  const supabase = createClient();

  // Get the transfer with items
  const transfer = await getTransfer(transferId);
  if (!transfer) {
    throw new Error("Transfer not found");
  }

  if (transfer.status === "completed") {
    throw new Error("Transfer is already completed");
  }

  if (transfer.status === "cancelled") {
    throw new Error("Cannot complete a cancelled transfer");
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  // Update inventory for each item
  for (const item of transfer.items) {
    // Remove from source location
    const { error: removeError } = await supabase.rpc("update_inventory", {
      p_product_id: item.product_id,
      p_location_id: transfer.from_location_id,
      p_qty_change: -item.qty_requested,
    });

    if (removeError) {
      throw new Error(`Failed to remove inventory: ${removeError.message}`);
    }

    // Add to destination location
    const { error: addError } = await supabase.rpc("update_inventory", {
      p_product_id: item.product_id,
      p_location_id: transfer.to_location_id,
      p_qty_change: item.qty_requested,
    });

    if (addError) {
      // Try to rollback the removal
      await supabase.rpc("update_inventory", {
        p_product_id: item.product_id,
        p_location_id: transfer.from_location_id,
        p_qty_change: item.qty_requested,
      });
      throw new Error(`Failed to add inventory: ${addError.message}`);
    }

    // Update transfer item with transferred qty
    await supabase
      .from("stock_transfer_items")
      .update({ qty_transferred: item.qty_requested })
      .eq("id", item.id);
  }

  // Update transfer status
  const { data: updatedTransfer, error: updateError } = await supabase
    .from("stock_transfers")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by: user?.id || null,
    })
    .eq("id", transferId)
    .select()
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  // Log activity
  await supabase.from("activity_log").insert({
    entity_type: "stock_transfer",
    entity_id: transferId,
    action: "completed",
    details: {
      transfer_number: transfer.transfer_number,
      from_location: transfer.from_location.name,
      to_location: transfer.to_location.name,
      items_transferred: transfer.items.length,
    },
  });

  // Return updated transfer with details
  return (await getTransfer(transferId))!;
}

export async function cancelTransfer(transferId: string): Promise<StockTransfer> {
  const supabase = createClient();

  // Get the transfer
  const transfer = await getTransfer(transferId);
  if (!transfer) {
    throw new Error("Transfer not found");
  }

  if (transfer.status === "completed") {
    throw new Error("Cannot cancel a completed transfer");
  }

  if (transfer.status === "cancelled") {
    throw new Error("Transfer is already cancelled");
  }

  // Update transfer status
  const { data: updatedTransfer, error } = await supabase
    .from("stock_transfers")
    .update({ status: "cancelled" })
    .eq("id", transferId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // Log activity
  await supabase.from("activity_log").insert({
    entity_type: "stock_transfer",
    entity_id: transferId,
    action: "cancelled",
    details: {
      transfer_number: transfer.transfer_number,
    },
  });

  return updatedTransfer;
}
