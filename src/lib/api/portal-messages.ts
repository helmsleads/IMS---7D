import { createClient } from "@/lib/supabase";

export interface PortalConversation {
  id: string;
  subject: string;
  status: string;
  last_message_at: string | null;
  created_at: string;
  unread_count: number;
  last_message_preview: string | null;
}

export interface PortalMessage {
  id: string;
  sender_type: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

export interface PortalConversationWithMessages extends Omit<PortalConversation, 'unread_count' | 'last_message_preview'> {
  messages: PortalMessage[];
}

export interface PortalAccountManager {
  id: string;
  name: string;
}

function notifyPortalUnreadChanged(detail?: { clearedUnreadCount?: number }) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("portal-messages-unread-changed", { detail }));
  }
}

async function notifyAccountManagerViaApi(params: {
  clientId: string;
  conversationId: string;
  subject: string;
  messagePreview: string;
  isNewConversation?: boolean;
}): Promise<void> {
  try {
    await fetch("/api/portal/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "notify-account-manager",
        ...params,
      }),
    });
  } catch {
    // Non-blocking — email is best-effort
  }
}

export async function getPortalAccountManager(
  clientId: string
): Promise<PortalAccountManager | null> {
  try {
    const response = await fetch(
      `/api/portal/messages?clientId=${encodeURIComponent(clientId)}&mode=account-manager`
    );
    const result = await response.json();
    if (response.ok) {
      return result.accountManager || null;
    }
  } catch {
    // Fall through to direct query
  }

  const supabase = createClient();
  const { data } = await supabase
    .from("clients")
    .select(
      "account_manager_id, account_manager:users!account_manager_id(id, name)"
    )
    .eq("id", clientId)
    .maybeSingle();

  const raw = data?.account_manager;
  const manager = Array.isArray(raw) ? raw[0] : raw;
  if (!data?.account_manager_id || !manager?.name) {
    return null;
  }

  return { id: data.account_manager_id, name: manager.name };
}

async function fetchConversationsViaApi(clientId: string): Promise<PortalConversation[]> {
  const response = await fetch(`/api/portal/messages?clientId=${encodeURIComponent(clientId)}`);
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Failed to fetch conversations");
  }
  return result.conversations || [];
}

async function fetchConversationViaApi(
  clientId: string,
  conversationId: string
): Promise<PortalConversationWithMessages | null> {
  const response = await fetch(
    `/api/portal/messages?clientId=${encodeURIComponent(clientId)}&conversationId=${encodeURIComponent(conversationId)}`
  );
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Failed to fetch conversation");
  }
  return result.conversation || null;
}

export async function getMyConversations(clientId: string): Promise<PortalConversation[]> {
  // Server-first read to avoid client-side RLS/policy filtering issues.
  try {
    return await fetchConversationsViaApi(clientId);
  } catch {
    // Fall back to direct client query when API route is unavailable.
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select(`
      id,
      subject,
      status,
      last_message_at,
      created_at,
      messages (
        id,
        sender_type,
        content,
        read_at,
        created_at
      )
    `)
    .eq("client_id", clientId)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (error) throw new Error(error.message);

  return (data || []).map((conv) => {
    const messages = conv.messages || [];
    const unreadCount = messages.filter(
      (m: any) => m.sender_type === "user" && m.read_at === null
    ).length;
    const sortedMessages = [...messages].sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const lastMessage = sortedMessages[0];
    const lastMessagePreview = lastMessage
      ? lastMessage.content.substring(0, 100) + (lastMessage.content.length > 100 ? "..." : "")
      : null;

    return {
      id: conv.id,
      subject: conv.subject,
      status: conv.status,
      last_message_at: conv.last_message_at,
      created_at: conv.created_at,
      unread_count: unreadCount,
      last_message_preview: lastMessagePreview,
    };
  });
}

export async function getMyConversation(
  clientId: string,
  conversationId: string
): Promise<PortalConversationWithMessages | null> {
  // Server-first read to avoid client-side RLS/policy filtering issues.
  try {
    return await fetchConversationViaApi(clientId, conversationId);
  } catch {
    // Fall back to direct client query when API route is unavailable.
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select(`
      id,
      subject,
      status,
      last_message_at,
      created_at,
      messages (
        id,
        sender_type,
        content,
        read_at,
        created_at
      )
    `)
    .eq("id", conversationId)
    .eq("client_id", clientId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }

  const messages = (data.messages || []).sort(
    (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return {
    id: data.id,
    subject: data.subject,
    status: data.status,
    last_message_at: data.last_message_at,
    created_at: data.created_at,
    messages,
  };
}

/**
 * Mark all unread staff messages in a conversation as read.
 * Call this explicitly when the user is actively viewing the conversation.
 */
export async function markConversationRead(
  clientId: string,
  conversationId: string
): Promise<number> {
  const response = await fetch("/api/portal/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "mark-read",
      clientId,
      conversationId,
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Failed to mark conversation as read");
  }

  const clearedCount = result.clearedCount || 0;
  if (clearedCount > 0) {
    notifyPortalUnreadChanged({ clearedUnreadCount: clearedCount });
  }
  return clearedCount;
}

export async function startConversation(
  clientId: string,
  subject: string,
  message: string
): Promise<PortalConversationWithMessages> {
  try {
    const response = await fetch("/api/portal/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "start",
        clientId,
        subject,
        message,
      }),
    });

    const result = await response.json();
    if (response.ok) {
      return result.conversation;
    }
  } catch {
    // Fall back to direct client write
  }

  const supabase = createClient();

  // Create the conversation
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .insert({
      client_id: clientId,
      subject,
      status: "open",
      last_message_at: new Date().toISOString(),
    })
    .select()
    .single();

  // Fallback to server route if direct write is blocked by RLS
  if (convError) {
    if (convError.message?.toLowerCase().includes("row-level security")) {
      const response = await fetch("/api/portal/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          clientId,
          subject,
          message,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to start conversation");
      }
      return result.conversation;
    }

    throw new Error(convError.message);
  }

  // Create the first message
  const { data: firstMessage, error: msgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      sender_type: "client",
      sender_id: clientId,
      content: message,
    })
    .select()
    .single();

  if (msgError) {
    // Rollback conversation
    await supabase.from("conversations").delete().eq("id", conversation.id);
    throw new Error(msgError.message);
  }

  // Log activity
  await supabase.from("activity_log").insert({
    entity_type: "conversation",
    entity_id: conversation.id,
    action: "created",
    details: {
      client_id: clientId,
      subject,
    },
  });

  void notifyAccountManagerViaApi({
    clientId,
    conversationId: conversation.id,
    subject,
    messagePreview: message,
    isNewConversation: true,
  });

  return {
    id: conversation.id,
    subject: conversation.subject,
    status: conversation.status,
    last_message_at: conversation.last_message_at,
    created_at: conversation.created_at,
    messages: [firstMessage],
  };
}

export async function sendPortalMessage(
  conversationId: string,
  clientId: string,
  content: string,
  conversationSubject?: string
): Promise<PortalMessage> {
  try {
    const response = await fetch("/api/portal/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send",
        clientId,
        conversationId,
        content,
      }),
    });

    const result = await response.json();
    if (response.ok) {
      notifyPortalUnreadChanged();
      return result.message;
    }
  } catch {
    // Fall back to direct client write
  }

  const supabase = createClient();
  const fallbackToApi = async (): Promise<PortalMessage> => {
    const response = await fetch("/api/portal/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send",
        clientId,
        conversationId,
        content,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Failed to send message");
    }
    notifyPortalUnreadChanged();
    return result.message;
  };

  // Verify client owns this conversation
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("id, status")
    .eq("id", conversationId)
    .eq("client_id", clientId)
    .single();

  if (convError) {
    if (convError.code === "PGRST116") {
      return fallbackToApi();
    }
    if (convError.message?.toLowerCase().includes("row-level security")) {
      return fallbackToApi();
    }
    throw new Error(convError.message);
  }

  if (conversation.status === "closed") {
    throw new Error("Cannot send message to a closed conversation");
  }

  // Create the message
  const { data: message, error: msgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_type: "client",
      sender_id: clientId,
      content,
    })
    .select()
    .single();

  // Fallback to server route if direct write is blocked by RLS
  if (msgError) {
    if (msgError.message?.toLowerCase().includes("row-level security")) {
      return fallbackToApi();
    }

    throw new Error(msgError.message);
  }

  // Update conversation last_message_at
  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  // Once client sends from an open thread, any prior staff unread should be marked read.
  await markConversationRead(clientId, conversationId).catch(() => {});
  notifyPortalUnreadChanged();

  // Log activity
  await supabase.from("activity_log").insert({
    entity_type: "message",
    entity_id: message.id,
    action: "created",
    details: {
      conversation_id: conversationId,
      sender_type: "client",
      sender_id: clientId,
    },
  });

  void notifyAccountManagerViaApi({
    clientId,
    conversationId,
    subject: conversationSubject || "Conversation",
    messagePreview: content,
  });

  return message;
}

export async function getMyUnreadCount(clientId: string): Promise<number> {
  // Server fallback first to avoid client-side RLS returning stale 0.
  try {
    const response = await fetch(
      `/api/portal/messages?clientId=${encodeURIComponent(clientId)}&mode=unread`
    );
    const result = await response.json();
    if (response.ok) {
      return result.count || 0;
    }
  } catch {
    // Ignore and continue to direct query fallback.
  }

  const supabase = createClient();

  // Resolve the client's conversation IDs first, then count unread staff messages.
  // This avoids fragile joined-count behavior with head/count queries.
  const { data: conversations, error: convError } = await supabase
    .from("conversations")
    .select("id")
    .eq("client_id", clientId);

  if (convError) {
    // Do not crash portal header/widgets when unread count can't be fetched.
    // Return 0 for transient/network/auth policy issues.
    const isTransient =
      convError.message === "Failed to fetch" ||
      convError.message.toLowerCase().includes("network") ||
      convError.message.toLowerCase().includes("aborted");
    if (!isTransient) {
      console.error("Error fetching conversations for unread count:", convError);
    }
    return 0;
  }

  const conversationIds = (conversations || []).map((c) => c.id);
  if (conversationIds.length === 0) {
    return 0;
  }

  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .in("conversation_id", conversationIds)
    .eq("sender_type", "user")
    .is("read_at", null);

  if (error) {
    const isTransient =
      error.message === "Failed to fetch" ||
      error.message.toLowerCase().includes("network") ||
      error.message.toLowerCase().includes("aborted");
    if (!isTransient) {
      console.error("Error fetching unread message count:", error);
    }
    return 0;
  }

  return count || 0;
}
