import { createClient } from "@/lib/supabase";
import { Conversation, Message, ConversationStatus, SenderType } from "@/types/database";

export interface ConversationFilters {
  clientId?: string;
  status?: ConversationStatus;
}

export interface ConversationWithMessages extends Omit<Conversation, 'client' | 'messages'> {
  messages: Message[];
  client: {
    id: string;
    company_name: string;
  };
}

export async function getConversations(filters?: ConversationFilters): Promise<ConversationWithMessages[]> {
  const supabase = createClient();

  let query = supabase
    .from("conversations")
    .select(`
      *,
      messages (*),
      client:clients (id, company_name)
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
    const supabase = createClient();

    const { count, error } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .is("read_at", null)
      .eq("sender_type", "client");

    if (error) {
      // Log real database errors
      console.error("Error fetching unread count:", error.message);
      throw new Error(error.message);
    }

    return count || 0;
  } catch (err) {
    // Only silence transient network errors (Failed to fetch, network timeout, etc.)
    const isNetworkError = err instanceof TypeError &&
      (err.message === "Failed to fetch" || err.message.includes("network"));

    if (!isNetworkError) {
      throw err; // Re-throw real errors
    }

    // Silently return 0 for network hiccups - will retry on next poll
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

export async function markAllRead(conversationId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .is("read_at", null);

  if (error) {
    throw new Error(error.message);
  }
}
