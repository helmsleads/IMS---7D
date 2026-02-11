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

export async function getMyConversations(clientId: string): Promise<PortalConversation[]> {
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

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((conv) => {
    const messages = conv.messages || [];

    // Count unread messages from users (not from client)
    const unreadCount = messages.filter(
      (m: any) => m.sender_type === "user" && m.read_at === null
    ).length;

    // Get last message preview
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
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  // Sort messages by created_at ascending
  const messages = (data.messages || []).sort(
    (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Mark unread messages from users as read
  const unreadIds = messages
    .filter((m: any) => m.sender_type === "user" && m.read_at === null)
    .map((m: any) => m.id);

  if (unreadIds.length > 0) {
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds);
  }

  return {
    id: data.id,
    subject: data.subject,
    status: data.status,
    last_message_at: data.last_message_at,
    created_at: data.created_at,
    messages,
  };
}

export async function startConversation(
  clientId: string,
  subject: string,
  message: string
): Promise<PortalConversationWithMessages> {
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

  if (convError) {
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
  content: string
): Promise<PortalMessage> {
  const supabase = createClient();

  // Verify client owns this conversation
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("id, status")
    .eq("id", conversationId)
    .eq("client_id", clientId)
    .single();

  if (convError) {
    if (convError.code === "PGRST116") {
      throw new Error("Conversation not found or access denied");
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

  if (msgError) {
    throw new Error(msgError.message);
  }

  // Update conversation last_message_at
  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  return message;
}

export async function getMyUnreadCount(clientId: string): Promise<number> {
  const supabase = createClient();

  // Get all conversations for this client
  const { data: conversations, error: convError } = await supabase
    .from("conversations")
    .select("id")
    .eq("client_id", clientId);

  if (convError) {
    throw new Error(convError.message);
  }

  if (!conversations || conversations.length === 0) {
    return 0;
  }

  const conversationIds = conversations.map((c) => c.id);

  // Count unread messages from users in client's conversations
  const { count, error: countError } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .in("conversation_id", conversationIds)
    .eq("sender_type", "user")
    .is("read_at", null);

  if (countError) {
    throw new Error(countError.message);
  }

  return count || 0;
}
