import { sendEmail } from "@/lib/api/email";
import { isEmailServiceConfigured } from "@/lib/email";
import { generateAuthEmailLink } from "@/lib/server/auth-email-links";
import { getAppUrlConfigurationError } from "@/lib/server/app-url";
import { findAuthUserIdByEmail } from "@/lib/server/invite-user";

function passwordResetEmailHtml(actionLink: string): string {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h1>Reset your password</h1>
        <p>You requested a password reset for your 7 Degrees account.</p>
        <p style="margin: 24px 0;">
          <a href="${actionLink}" style="display: inline-block; background: #0d9488; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Reset password
          </a>
        </p>
        <p>If you did not request this, you can ignore this email.</p>
        <p>If the button does not work, copy and paste this URL into your browser:</p>
        <p style="word-break: break-all; color: #555;">${actionLink}</p>
      </body>
    </html>
  `;
}

export type PasswordResetEmailResult =
  | { success: true; emailSent: true }
  | { success: true; emailSent: false; message: string }
  | { success: false; error: string };

/**
 * Send a password reset email using our app link (not Supabase's built-in email).
 * Always returns success when the email is unknown to avoid account enumeration.
 */
export async function sendPasswordResetEmail(
  email: string
): Promise<PasswordResetEmailResult> {
  const configError = getAppUrlConfigurationError();
  if (configError) {
    return { success: false, error: configError };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return { success: false, error: "Email is required." };
  }

  const userId = await findAuthUserIdByEmail(normalizedEmail);
  if (!userId) {
    return { success: true, emailSent: true };
  }

  const linkResult = await generateAuthEmailLink(normalizedEmail, ["recovery"]);

  if ("error" in linkResult) {
    console.error("password reset link failed:", linkResult);
    return {
      success: false,
      error: linkResult.error,
    };
  }

  if (!isEmailServiceConfigured()) {
    console.warn(
      "AWS SES not configured — password reset link not emailed:",
      normalizedEmail
    );
    return {
      success: true,
      emailSent: false,
      message: "Email service is not configured.",
    };
  }

  const emailResult = await sendEmail(
    normalizedEmail,
    "Reset your 7 Degrees password",
    passwordResetEmailHtml(linkResult.actionLink)
  );

  if (!emailResult.success) {
    console.error("Password reset email failed:", emailResult.error);
    return {
      success: false,
      error:
        emailResult.error ||
        "Could not send the reset email. Try again later.",
    };
  }

  return { success: true, emailSent: true };
}
