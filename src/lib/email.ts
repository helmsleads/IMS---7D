import { SESv2Client } from "@aws-sdk/client-sesv2";

let sesClient: SESv2Client | null = null;

export function getSesRegion(): string | undefined {
  return (
    process.env.AWS_REGION?.trim() ||
    process.env.SES_REGION?.trim() ||
    process.env.AWS_DEFAULT_REGION?.trim()
  );
}

/** True when SES region is configured (credentials use the AWS SDK default chain). */
export function isEmailServiceConfigured(): boolean {
  return !!getSesRegion();
}

export function getEmailFromAddress(): string {
  return (
    process.env.SES_FROM_EMAIL?.trim() ||
    "Helmsman Imports <invites@helmsmanimports.com>"
  );
}

export function getSesClient(): SESv2Client {
  if (!sesClient) {
    const region = getSesRegion();
    if (!region) {
      throw new Error("AWS_REGION (or SES_REGION) is not configured");
    }
    sesClient = new SESv2Client({ region });
  }
  return sesClient;
}
