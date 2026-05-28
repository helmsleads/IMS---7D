import { sendEmail } from "@/lib/api/email";
import { createServiceClient } from "@/lib/supabase-service";

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

/**
 * Email the client's assigned account manager when they send a portal message.
 * Non-blocking for callers — logs failures only.
 */
export async function notifyAccountManagerOfClientMessage(params: {
  clientId: string;
  conversationId: string;
  subject: string;
  messagePreview: string;
  isNewConversation?: boolean;
}): Promise<void> {
  const service = createServiceClient();

  const { data: client, error } = await service
    .from("clients")
    .select(
      `
      company_name,
      account_manager_id,
      account_manager:users!account_manager_id (
        id,
        name,
        email,
        active
      )
    `
    )
    .eq("id", params.clientId)
    .maybeSingle();

  if (error || !client?.account_manager_id) {
    return;
  }

  const raw = client.account_manager;
  const manager = (Array.isArray(raw) ? raw[0] : raw) as {
    id: string;
    name: string;
    email: string | null;
    active: boolean;
  } | null;

  if (!manager?.email || manager.active === false) {
    return;
  }

  const companyName = client.company_name || "A client";
  const preview =
    params.messagePreview.length > 280
      ? `${params.messagePreview.slice(0, 280)}…`
      : params.messagePreview;
  const messagesUrl = `${getAppUrl()}/messages`;
  const actionLabel = params.isNewConversation
    ? "started a new conversation"
    : "sent a new message";

  const html = `
    <p>Hi ${manager.name || "there"},</p>
    <p><strong>${companyName}</strong> ${actionLabel} in the 7 Degrees portal.</p>
    <p><strong>Subject:</strong> ${params.subject}</p>
    <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #0891b2;background:#f8fafc;color:#334155;">
      ${preview.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}
    </blockquote>
    <p><a href="${messagesUrl}" style="color:#0891b2;">Open Messages</a> to reply in the platform.</p>
    <p style="color:#64748b;font-size:12px;">Clients reach you here — no personal phone numbers needed.</p>
  `;

  const result = await sendEmail(
    manager.email,
    `[7 Degrees] ${companyName} messaged you`,
    html
  );

  if (!result.success) {
    console.error(
      "Failed to notify account manager:",
      result.error,
      params.conversationId
    );
  }
}
