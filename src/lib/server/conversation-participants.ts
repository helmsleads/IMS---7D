import { createServiceClient } from "@/lib/supabase-service";
import { sendEmail } from "@/lib/api/email";

export type ParticipantRole = "account_manager" | "warehouse_manager";

export interface ConversationParticipantRow {
  id: string;
  conversation_id: string;
  user_id: string;
  participant_role: ParticipantRole;
  added_by: string | null;
  added_at: string;
  user?: { id: string; name: string; email: string | null; role: string };
}

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

/**
 * Add the client's account manager to the thread when a client starts a conversation.
 */
export async function ensureAccountManagerParticipant(
  conversationId: string,
  clientId: string
): Promise<void> {
  const service = createServiceClient();

  const { data: client } = await service
    .from("clients")
    .select("account_manager_id")
    .eq("id", clientId)
    .maybeSingle();

  if (!client?.account_manager_id) return;

  const { data: existing } = await service
    .from("conversation_participants")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("user_id", client.account_manager_id)
    .maybeSingle();

  if (existing) return;

  await service.from("conversation_participants").insert({
    conversation_id: conversationId,
    user_id: client.account_manager_id,
    participant_role: "account_manager",
    added_by: null,
  });
}

export async function insertSystemMessage(
  conversationId: string,
  content: string,
  actorUserId: string
): Promise<void> {
  const service = createServiceClient();
  const now = new Date().toISOString();

  await service.from("messages").insert({
    conversation_id: conversationId,
    sender_type: "user",
    sender_id: actorUserId,
    content,
  });

  await service
    .from("conversations")
    .update({ last_message_at: now })
    .eq("id", conversationId);
}

export async function canAddWarehouseManager(
  conversationId: string,
  callerUserId: string,
  callerRole: string
): Promise<{ allowed: boolean; clientId?: string; accountManagerId?: string | null }> {
  const service = createServiceClient();

  const { data: conversation } = await service
    .from("conversations")
    .select("id, client_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation) return { allowed: false };

  const { data: client } = await service
    .from("clients")
    .select("account_manager_id")
    .eq("id", conversation.client_id)
    .maybeSingle();

  if (callerRole === "admin") {
    return {
      allowed: true,
      clientId: conversation.client_id,
      accountManagerId: client?.account_manager_id,
    };
  }

  if (client?.account_manager_id === callerUserId) {
    return {
      allowed: true,
      clientId: conversation.client_id,
      accountManagerId: client.account_manager_id,
    };
  }

  return { allowed: false, clientId: conversation.client_id };
}

export async function addWarehouseManagerParticipant(params: {
  conversationId: string;
  warehouseUserId: string;
  addedByUserId: string;
  addedByName: string;
}): Promise<
  | { success: true; participant: ConversationParticipantRow }
  | { success: false; error: string }
> {
  const service = createServiceClient();

  const { data: targetUser } = await service
    .from("users")
    .select("id, name, email, role, active")
    .eq("id", params.warehouseUserId)
    .maybeSingle();

  if (!targetUser || targetUser.active === false) {
    return { success: false, error: "Warehouse manager not found or inactive." };
  }

  if (targetUser.role !== "warehouse") {
    return {
      success: false,
      error: "Selected user must have the warehouse role.",
    };
  }

  const { data: existing } = await service
    .from("conversation_participants")
    .select("id")
    .eq("conversation_id", params.conversationId)
    .eq("user_id", params.warehouseUserId)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      error: "This warehouse manager is already on the conversation.",
    };
  }

  const { data: participant, error: insertError } = await service
    .from("conversation_participants")
    .insert({
      conversation_id: params.conversationId,
      user_id: params.warehouseUserId,
      participant_role: "warehouse_manager",
      added_by: params.addedByUserId,
    })
    .select(
      `
      id,
      conversation_id,
      user_id,
      participant_role,
      added_by,
      added_at,
      user:users!conversation_participants_user_id_fkey (id, name, email, role)
    `
    )
    .single();

  if (insertError || !participant) {
    return {
      success: false,
      error: insertError?.message || "Failed to add participant",
    };
  }

  const systemText = `${params.addedByName} added ${targetUser.name} (Warehouse) to this conversation.`;
  await insertSystemMessage(
    params.conversationId,
    systemText,
    params.addedByUserId
  );

  const { data: conv } = await service
    .from("conversations")
    .select("subject, client:clients (company_name)")
    .eq("id", params.conversationId)
    .single();

  const clientName =
    (Array.isArray(conv?.client) ? conv.client[0] : conv?.client)?.company_name ||
    "A client";

  if (targetUser.email && process.env.RESEND_API_KEY) {
    const messagesUrl = `${getAppUrl()}/messages`;
    const html = `
      <p>Hi ${targetUser.name},</p>
      <p><strong>${params.addedByName}</strong> added you to a conversation with <strong>${clientName}</strong>.</p>
      <p><strong>Subject:</strong> ${conv?.subject || "Conversation"}</p>
      <p><a href="${messagesUrl}">Open Messages</a> to view and reply.</p>
    `;
    void sendEmail(
      targetUser.email,
      `[7 Degrees] You've been added to a client conversation`,
      html
    );
  }

  const rawUser = participant.user as
    | { id: string; name: string; email: string | null; role: string }
    | { id: string; name: string; email: string | null; role: string }[]
    | null;
  const user = Array.isArray(rawUser) ? rawUser[0] : rawUser;

  return {
    success: true,
    participant: {
      id: participant.id,
      conversation_id: participant.conversation_id,
      user_id: participant.user_id,
      participant_role: participant.participant_role as ParticipantRole,
      added_by: participant.added_by,
      added_at: participant.added_at,
      user: user || undefined,
    },
  };
}

export async function listParticipants(
  conversationId: string
): Promise<ConversationParticipantRow[]> {
  const service = createServiceClient();

  const { data, error } = await service
    .from("conversation_participants")
    .select(
      `
      id,
      conversation_id,
      user_id,
      participant_role,
      added_by,
      added_at,
      user:users!conversation_participants_user_id_fkey (id, name, email, role)
    `
    )
    .eq("conversation_id", conversationId)
    .order("added_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data || []).map((row) => {
    const rawUser = row.user as
      | { id: string; name: string; email: string | null; role: string }
      | { id: string; name: string; email: string | null; role: string }[]
      | null;
    const user = Array.isArray(rawUser) ? rawUser[0] : rawUser;
    return {
      id: row.id,
      conversation_id: row.conversation_id,
      user_id: row.user_id,
      participant_role: row.participant_role as ParticipantRole,
      added_by: row.added_by,
      added_at: row.added_at,
      user: user || undefined,
    };
  });
}
