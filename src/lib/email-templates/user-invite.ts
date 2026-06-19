export type InviteEmailUserType = "internal" | "portal";

export interface UserInviteEmailParams {
  firstName: string;
  actionLink: string;
  userType: InviteEmailUserType;
  /** Public app origin for post-setup login hints */
  appUrl?: string;
}

export function userInviteEmail({
  firstName,
  actionLink,
  userType,
  appUrl = "https://7degrees.co",
}: UserInviteEmailParams): { subject: string; html: string } {
  const isPortal = userType === "portal";
  const portalLabel = isPortal
    ? "7 Degrees Client Portal"
    : "7 Degrees Admin Dashboard";
  const portalDescription = isPortal
    ? "View inventory, request shipments, and track orders for your company."
    : "Manage warehouse operations, orders, clients, and fulfillment.";
  const loginPath = isPortal ? "/client-login" : "/login";
  const loginUrl = `${appUrl.replace(/\/$/, "")}${loginPath}`;
  const greeting = firstName ? `Hi ${firstName},` : "Hello,";
  const year = new Date().getFullYear();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're invited to 7 Degrees</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: white;">7 Degrees Co</div>
              <div style="font-size: 14px; color: rgba(255,255,255,0.8); margin-top: 4px;">Inventory Management</div>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="background-color: white; padding: 32px;">

              <!-- Icon -->
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 64px; height: 64px; background-color: #dbeafe; border-radius: 50%; line-height: 64px; font-size: 28px;">
                  ✉
                </div>
              </div>

              <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #111827; text-align: center;">
                You're invited!
              </h1>
              <p style="margin: 0 0 24px 0; color: #6b7280; text-align: center; font-size: 15px; line-height: 1.6;">
                ${greeting} you've been invited to join the ${portalLabel}.
              </p>

              <!-- Access card -->
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <div style="font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                  Your access
                </div>
                <div style="font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 8px;">
                  ${portalLabel}
                </div>
                <div style="font-size: 14px; color: #4b5563; line-height: 1.5;">
                  ${portalDescription}
                </div>
              </div>

              <!-- CTA -->
              <div style="text-align: center; margin-bottom: 28px;">
                <a href="${actionLink}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px;">
                  Create Your Password
                </a>
              </div>

              <!-- Steps -->
              <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-bottom: 24px;">
                <h2 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #111827;">Getting started</h2>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="32" valign="top" style="padding-bottom: 12px;">
                      <div style="width: 24px; height: 24px; background-color: #dbeafe; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 600; color: #2563eb;">1</div>
                    </td>
                    <td style="padding-bottom: 12px; padding-left: 12px;">
                      <div style="font-weight: 500; color: #111827;">Create your password</div>
                      <div style="font-size: 13px; color: #6b7280;">Use the button above — this link is unique to you</div>
                    </td>
                  </tr>
                  <tr>
                    <td width="32" valign="top" style="padding-bottom: 12px;">
                      <div style="width: 24px; height: 24px; background-color: #dbeafe; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 600; color: #2563eb;">2</div>
                    </td>
                    <td style="padding-bottom: 12px; padding-left: 12px;">
                      <div style="font-weight: 500; color: #111827;">Sign in with your email</div>
                      <div style="font-size: 13px; color: #6b7280;">Your login is the address this email was sent to</div>
                    </td>
                  </tr>
                  <tr>
                    <td width="32" valign="top">
                      <div style="width: 24px; height: 24px; background-color: #dbeafe; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 600; color: #2563eb;">3</div>
                    </td>
                    <td style="padding-left: 12px;">
                      <div style="font-weight: 500; color: #111827;">Open the ${isPortal ? "portal" : "dashboard"}</div>
                      <div style="font-size: 13px; color: #6b7280;">After setup, sign in at <a href="${loginUrl}" style="color: #2563eb; text-decoration: none;">${loginUrl.replace(/^https?:\/\//, "")}</a></div>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Note -->
              <div style="background-color: #eff6ff; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <div style="font-size: 13px; color: #1e40af; line-height: 1.5;">
                  <strong>First time?</strong> You don't have a password yet — the button above is how you create one. This invitation link expires for security; if it stops working, ask your administrator to resend the invite.
                </div>
              </div>

              <!-- Fallback link -->
              <div style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
                <div style="font-size: 13px; color: #6b7280; margin-bottom: 8px;">
                  If the button doesn't work, copy and paste this link into your browser:
                </div>
                <div style="font-size: 12px; color: #2563eb; word-break: break-all; line-height: 1.5;">
                  <a href="${actionLink}" style="color: #2563eb; text-decoration: underline;">${actionLink}</a>
                </div>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px; border-radius: 0 0 12px 12px; text-align: center; border-top: 1px solid #e5e7eb;">
              <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">
                Questions? Contact us at support@7degrees.co
              </div>
              <div style="font-size: 12px; color: #9ca3af;">
                © ${year} 7 Degrees Co. All rights reserved.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return {
    subject: "You're invited to 7 Degrees",
    html,
  };
}
