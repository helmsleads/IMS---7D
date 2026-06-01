import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-service";
import type { ConversationStatus } from "@/types/database";

const VALID_STATUSES: ConversationStatus[] = ["open", "closed", "archived"];

async function getAuthenticatedInternalUser(request: NextRequest) {
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

  if (error || !user) return null;

  const service = createServiceClient();
  const { data: internalUser } = await service
    .from("users")
    .select("id, auth_id, active")
    .or(`id.eq.${user.id},auth_id.eq.${user.id}`)
    .maybeSingle();

  if (!internalUser || internalUser.active === false) return null;
  return { authUser: user, internalUser };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedInternalUser(request);
    if (!auth) {
      return NextResponse.json({ error: "Internal access required" }, { status: 403 });
    }

    const body = await request.json();
    const action = body?.action;

    if (action === "update-status") {
      const conversationId = (body?.conversationId || "").trim();
      const status = body?.status as ConversationStatus | undefined;

      if (!conversationId || !status) {
        return NextResponse.json(
          { error: "conversationId and status are required" },
          { status: 400 }
        );
      }

      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }

      const service = createServiceClient();
      const { data: conversation, error: updateError } = await service
        .from("conversations")
        .update({ status })
        .eq("id", conversationId)
        .select()
        .single();

      if (updateError || !conversation) {
        return NextResponse.json(
          { error: updateError?.message || "Failed to update conversation" },
          { status: 500 }
        );
      }

      return NextResponse.json({ conversation });
    }

    if (action === "mark-read") {
      const conversationId = (body?.conversationId || "").trim();
      if (!conversationId) {
        return NextResponse.json(
          { error: "conversationId is required" },
          { status: 400 }
        );
      }

      const service = createServiceClient();
      const { data: conversation, error: convError } = await service
        .from("conversations")
        .select("id")
        .eq("id", conversationId)
        .maybeSingle();

      if (convError || !conversation) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }

      const readAt = new Date().toISOString();
      const { data: updatedRows, error: updateError } = await service
        .from("messages")
        .update({ read_at: readAt })
        .eq("conversation_id", conversationId)
        .eq("sender_type", "client")
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

    const conversationId = (body?.conversationId || "").trim();
    const content = (body?.content || "").trim();
    const senderType = body?.senderType;

    if (!conversationId || !content || !senderType) {
      return NextResponse.json(
        { error: "conversationId, content and senderType are required" },
        { status: 400 }
      );
    }

    const service = createServiceClient();

    const { data: conversation, error: convError } = await service
      .from("conversations")
      .select("id, status")
      .eq("id", conversationId)
      .maybeSingle();

    if (convError || !conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (conversation.status === "closed") {
      return NextResponse.json(
        { error: "Cannot send message to a closed conversation" },
        { status: 400 }
      );
    }

    const senderId = auth.internalUser.id;
    const { data: message, error: messageError } = await service
      .from("messages")
      .insert({
        conversation_id: conversationId,
        content,
        sender_type: senderType,
        sender_id: senderId,
      })
      .select()
      .single();

    if (messageError || !message) {
      return NextResponse.json(
        { error: messageError?.message || "Failed to send message" },
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
        sender_type: senderType,
        sender_id: senderId,
      },
    });

    return NextResponse.json({ message });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedInternalUser(request);
    if (!auth) {
      return NextResponse.json({ error: "Internal access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");
    if (mode !== "unread") {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    const service = createServiceClient();
    const { count, error } = await service
      .from("messages")
      .select("id", { count: "exact", head: true })
      .is("read_at", null)
      .eq("sender_type", "client");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ count: count || 0 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
