import { createClient } from "@/lib/supabase";
import { Conversation, Message, ConversationStatus, SenderType } from "@/types/database";

function notifyInternalUnreadChanged(detail?: {
  clearedUnreadCount?: number;
  conversationId?: string;
}) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("internal-messages-unread-changed", { detail }));
  }
}

export interface ConversationFilters {
  clientId?: string;
  status?: ConversationStatus;
}

export interface ConversationWithMessages extends Omit<Conversation, 'client' | 'messages'> {
  messages: Message[];
  client: {
    id: string;
    company_name: string;
    account_manager_id?: string | null;
    account_manager?: { id: string; name: string } | null;
  };
}

export async function getConversations(filters?: ConversationFilters): Promise<ConversationWithMessages[]> {
  const supabase = createClient();

  let query = supabase
    .from("conversations")
    .select(`
      *,
      messages (*),
      client:clients (
        id,
        company_name,
        account_manager_id,
        account_manager:users!account_manager_id (id, name)
      )
    `)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (filters?.clientId) {
    query = query.eq("client_id", filters.clientId);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getConversation(id: string): Promise<ConversationWithMessages | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("conversations")
    .select(`
      *,
      messages (*),
      client:clients (id, company_name)
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

export async function createConversation(
  clientId: string,
  subject: string
): Promise<Conversation> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      client_id: clientId,
      subject,
      status: "open",
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateConversation(
  id: string,
  conversation: Partial<Conversation>
): Promise<Conversation> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("conversations")
    .update(conversation)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function closeConversation(id: string): Promise<Conversation> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("conversations")
    .update({ status: "closed" })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getUnreadCount(): Promise<number> {
  try {
    // Server fallback first to avoid client-side RLS returning stale 0.
    try {
      const response = await fetch("/api/internal/messages?mode=unread");
      const result = await response.json();
      if (response.ok) {
        return result.count || 0;
      }
    } catch {
      // Ignore and continue to direct query fallback.
    }

    const supabase = createClient();

    const { count, error } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .is("read_at", null)
      .eq("sender_type", "client");

    if (error) {
      const isTransient =
        error.message === "Failed to fetch" ||
        error.message.includes("network") ||
        error.message.includes("aborted");

      if (isTransient) {
        return 0;
      }

      // Log real database errors
      console.error("Error fetching unread count:", error.message);
      throw new Error(error.message);
    }

    return count || 0;
  } catch (err) {
    // Silence transient errors (network, abort from unmount/navigation)
    const isTransient =
      (err instanceof Error && (err.message === "Failed to fetch" || err.message.includes("network") || err.message.includes("aborted"))) ||
      (err instanceof DOMException && err.name === "AbortError");

    if (!isTransient) {
      throw err; // Re-throw real errors
    }

    return 0;
  }
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function sendMessage(
  conversationId: string,
  content: string,
  senderType: SenderType,
  senderId: string
): Promise<Message> {
  const supabase = createClient();

  // Verify conversation is open before sending
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("status")
    .eq("id", conversationId)
    .single();

  if (convError) {
    throw new Error(convError.message);
  }

  if (conversation.status === "closed") {
    throw new Error("Cannot send message to a closed conversation");
  }

  // Create the message
  const { data: message, error: messageError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      content,
      sender_type: senderType,
      sender_id: senderId,
    })
    .select()
    .single();

  if (messageError) {
    if (messageError.message?.toLowerCase().includes("row-level security")) {
      const response = await fetch("/api/internal/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          content,
          senderType,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to send message");
      }
      notifyInternalUnreadChanged();

      return result.message;
    }
    throw new Error(messageError.message);
  }

  // Update conversation last_message_at
  const { error: updateError } = await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  // Log activity
  await supabase.from("activity_log").insert({
    entity_type: "message",
    entity_id: message.id,
    action: "created",
    details: {
      conversation_id: conversationId,
      sender_type: senderType,
      sender_id: senderId,
    },
  });

  notifyInternalUnreadChanged();
  return message;
}

export async function markMessageRead(id: string): Promise<Message> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function markAllRead(conversationId: string): Promise<number> {
  const response = await fetch("/api/internal/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "mark-read",
      conversationId,
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Failed to mark messages read");
  }

  const clearedCount = result.clearedCount || 0;
  notifyInternalUnreadChanged({ clearedUnreadCount: clearedCount, conversationId });
  return clearedCount;
}
