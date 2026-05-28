import { NextRequest, NextResponse } from "next/server";
import { User } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-service";
import { notifyAccountManagerOfClientMessage } from "@/lib/server/notify-account-manager-message";

type PortalAction = "start" | "send" | "mark-read" | "notify-account-manager";

async function getAuthUser(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

async function getPortalIdentityIds(authUser: User): Promise<string[]> {
  const service = createServiceClient();
  const ids = new Set<string>([authUser.id]);

  // Primary mapping: profile id often equals auth user id
  const { data: directProfile } = await service
    .from("user_profiles")
    .select("id")
    .eq("id", authUser.id)
    .maybeSingle();
  if (directProfile?.id) ids.add(directProfile.id);

  // Compatibility mapping: some environments map client_users.user_id via profile email
  if (authUser.email) {
    const { data: emailProfile } = await service
      .from("user_profiles")
      .select("id")
      .ilike("email", authUser.email)
      .maybeSingle();
    if (emailProfile?.id) ids.add(emailProfile.id);
  }

  return Array.from(ids);
}

async function canAccessClient(authUser: User, clientId: string): Promise<boolean> {
  const service = createServiceClient();
  const identityIds = await getPortalIdentityIds(authUser);

  const { data: accessRows } = await service
    .from("client_users")
    .select("client_id")
    .in("user_id", identityIds);

  if ((accessRows || []).some((row) => row.client_id === clientId)) {
    return true;
  }

  // Legacy portal mapping
  const { data: legacyClient } = await service
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .in("auth_id", identityIds);

  return !!legacyClient && legacyClient.length > 0;
}

async function getAccessibleClientIds(authUser: User): Promise<string[]> {
  const service = createServiceClient();
  const identityIds = await getPortalIdentityIds(authUser);

  const { data: accessRows } = await service
    .from("client_users")
    .select("client_id")
    .in("user_id", identityIds);

  const ids = new Set((accessRows || []).map((row) => row.client_id));

  const { data: legacyClients } = await service
    .from("clients")
    .select("id")
    .in("auth_id", identityIds);

  for (const row of legacyClients || []) {
    ids.add(row.id);
  }

  return Array.from(ids);
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const action = body?.action as PortalAction;

    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 });
    }

    const service = createServiceClient();

    if (action === "start") {
      const clientId = (body?.clientId || "").trim();
      const subject = (body?.subject || "").trim();
      const message = (body?.message || "").trim();

      if (!clientId || !subject || !message) {
        return NextResponse.json(
          { error: "clientId, subject and message are required" },
          { status: 400 }
        );
      }

      const authorized = await canAccessClient(authUser, clientId);
      if (!authorized) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      const now = new Date().toISOString();

      const { data: conversation, error: convError } = await service
        .from("conversations")
        .insert({
          client_id: clientId,
          subject,
          status: "open",
          last_message_at: now,
        })
        .select()
        .single();

      if (convError || !conversation) {
        return NextResponse.json(
          { error: convError?.message || "Failed to create conversation" },
          { status: 500 }
        );
      }

      const { data: firstMessage, error: msgError } = await service
        .from("messages")
        .insert({
          conversation_id: conversation.id,
          sender_type: "client",
          sender_id: clientId,
          content: message,
        })
        .select()
        .single();

      if (msgError || !firstMessage) {
        await service.from("conversations").delete().eq("id", conversation.id);
        return NextResponse.json(
          { error: msgError?.message || "Failed to create first message" },
          { status: 500 }
        );
      }

      await service.from("activity_log").insert({
        entity_type: "conversation",
        entity_id: conversation.id,
        action: "created",
        details: {
          client_id: clientId,
          subject,
        },
      });

      void notifyAccountManagerOfClientMessage({
        clientId,
        conversationId: conversation.id,
        subject,
        messagePreview: message,
        isNewConversation: true,
      });

      return NextResponse.json({
        conversation: {
          id: conversation.id,
          subject: conversation.subject,
          status: conversation.status,
          last_message_at: conversation.last_message_at,
          created_at: conversation.created_at,
          messages: [firstMessage],
        },
      });
    }

    if (action === "send") {
      const conversationId = (body?.conversationId || "").trim();
      const content = (body?.content || "").trim();

      if (!conversationId || !content) {
        return NextResponse.json(
          { error: "conversationId and content are required" },
          { status: 400 }
        );
      }

      const accessibleClientIds = await getAccessibleClientIds(authUser);
      if (accessibleClientIds.length === 0) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      const { data: conversation, error: convError } = await service
        .from("conversations")
        .select("id, status, client_id")
        .eq("id", conversationId)
        .maybeSingle();

      if (convError || !conversation) {
        return NextResponse.json(
          { error: "Conversation not found or access denied" },
          { status: 404 }
        );
      }

      if (!accessibleClientIds.includes(conversation.client_id)) {
        return NextResponse.json(
          { error: "Conversation not found or access denied" },
          { status: 404 }
        );
      }

      if (conversation.status === "closed") {
        return NextResponse.json(
          { error: "Cannot send message to a closed conversation" },
          { status: 400 }
        );
      }

      const senderClientId = conversation.client_id;
      const { data: message, error: msgError } = await service
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_type: "client",
          sender_id: senderClientId,
          content,
        })
        .select()
        .single();

      if (msgError || !message) {
        return NextResponse.json(
          { error: msgError?.message || "Failed to send message" },
          { status: 500 }
        );
      }

      await service
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId);

      await service.from("activity_log").insert({
        entity_type: "message",
        entity_id: message.id,
        action: "created",
        details: {
          conversation_id: conversationId,
          sender_type: "client",
          sender_id: senderClientId,
        },
      });

      const { data: convMeta } = await service
        .from("conversations")
        .select("subject")
        .eq("id", conversationId)
        .single();

      void notifyAccountManagerOfClientMessage({
        clientId: senderClientId,
        conversationId,
        subject: convMeta?.subject || "Conversation",
        messagePreview: content,
      });

      return NextResponse.json({ message });
    }

    if (action === "notify-account-manager") {
      const clientId = (body?.clientId || "").trim();
      const conversationId = (body?.conversationId || "").trim();
      const subject = (body?.subject || "Conversation").trim();
      const messagePreview = (body?.messagePreview || "").trim();

      if (!clientId || !conversationId || !messagePreview) {
        return NextResponse.json(
          { error: "clientId, conversationId and messagePreview are required" },
          { status: 400 }
        );
      }

      const authorized = await canAccessClient(authUser, clientId);
      if (!authorized) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      await notifyAccountManagerOfClientMessage({
        clientId,
        conversationId,
        subject,
        messagePreview,
        isNewConversation: !!body?.isNewConversation,
      });

      return NextResponse.json({ success: true });
    }

    if (action === "mark-read") {
      const conversationId = (body?.conversationId || "").trim();
      if (!conversationId) {
        return NextResponse.json(
          { error: "conversationId is required" },
          { status: 400 }
        );
      }

      const accessibleClientIds = await getAccessibleClientIds(authUser);
      if (accessibleClientIds.length === 0) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      const { data: conversation, error: convError } = await service
        .from("conversations")
        .select("id, client_id")
        .eq("id", conversationId)
        .maybeSingle();

      if (convError || !conversation) {
        return NextResponse.json(
          { error: "Conversation not found or access denied" },
          { status: 404 }
        );
      }

      if (!accessibleClientIds.includes(conversation.client_id)) {
        return NextResponse.json(
          { error: "Conversation not found or access denied" },
          { status: 404 }
        );
      }

      const readAt = new Date().toISOString();
      const { data: updatedRows, error: updateError } = await service
        .from("messages")
        .update({ read_at: readAt })
        .eq("conversation_id", conversationId)
        .eq("sender_type", "user")
        .is("read_at", null)
        .select("id");

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        clearedCount: updatedRows?.length || 0,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = (searchParams.get("clientId") || "").trim();
    const conversationId = (searchParams.get("conversationId") || "").trim();
    const mode = (searchParams.get("mode") || "").trim();

    if (!clientId) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    const authorized = await canAccessClient(authUser, clientId);
    if (!authorized) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const service = createServiceClient();

    if (mode === "account-manager") {
      const { data: clientRow, error: clientError } = await service
        .from("clients")
        .select(
          `
          account_manager_id,
          account_manager:users!account_manager_id (id, name)
        `
        )
        .eq("id", clientId)
        .maybeSingle();

      if (clientError) {
        return NextResponse.json({ error: clientError.message }, { status: 500 });
      }

      const raw = clientRow?.account_manager;
      const manager = Array.isArray(raw) ? raw[0] : raw;
      return NextResponse.json({
        accountManager:
          clientRow?.account_manager_id && manager?.name
            ? { id: clientRow.account_manager_id, name: manager.name }
            : null,
      });
    }

    if (mode === "unread") {
      const { data: conversations, error: convError } = await service
        .from("conversations")
        .select("id")
        .eq("client_id", clientId);

      if (convError) {
        return NextResponse.json({ error: convError.message }, { status: 500 });
      }

      const conversationIds = (conversations || []).map((c) => c.id);
      if (conversationIds.length === 0) {
        return NextResponse.json({ count: 0 });
      }

      const { count, error } = await service
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", conversationIds)
        .eq("sender_type", "user")
        .is("read_at", null);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ count: count || 0 });
    }

    if (conversationId) {
      const { data, error } = await service
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
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!data) {
        return NextResponse.json({ conversation: null });
      }

      const messages = (data.messages || []).sort(
        (a: any, b: any) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      return NextResponse.json({
        conversation: {
          id: data.id,
          subject: data.subject,
          status: data.status,
          last_message_at: data.last_message_at,
          created_at: data.created_at,
          messages,
        },
      });
    }

    const { data, error } = await service
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const conversations = (data || []).map((conv: any) => {
      const messages = conv.messages || [];
      const unreadCount = messages.filter(
        (m: any) => m.sender_type === "user" && m.read_at === null
      ).length;
      const sortedMessages = [...messages].sort(
        (a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const lastMessage = sortedMessages[0];
      const lastMessagePreview = lastMessage
        ? lastMessage.content.substring(0, 100) +
          (lastMessage.content.length > 100 ? "..." : "")
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

    return NextResponse.json({ conversations });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
