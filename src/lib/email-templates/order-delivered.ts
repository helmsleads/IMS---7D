interface OrderDeliveredParams {
  order: {
    orderNumber: string;
    deliveredAt: string;
  };
  client: {
    companyName: string;
    contactName: string;
  };
}

export function orderDeliveredEmail({ order, client }: OrderDeliveredParams): {
  subject: string;
  html: string;
} {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Delivered</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: white;">7 Degrees Co</div>
              <div style="font-size: 14px; color: rgba(255,255,255,0.8); margin-top: 4px;">Inventory Management</div>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="background-color: white; padding: 32px;">

              <!-- Success Icon -->
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 64px; height: 64px; background-color: #d1fae5; border-radius: 50%; line-height: 64px; font-size: 32px;">
                  ✓
                </div>
              </div>

              <!-- Greeting -->
              <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #111827; text-align: center;">
                Order Delivered
              </h1>
              <p style="margin: 0 0 24px 0; color: #6b7280; text-align: center;">
                Hi ${client.contactName}, your order has been delivered.
              </p>

              <!-- Delivery Confirmation -->
              <div style="background-color: #ecfdf5; border-radius: 8px; padding: 20px; margin-bottom: 24px; text-align: center;">
                <div style="font-size: 13px; color: #047857; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Order Number</div>
                <div style="font-size: 20px; font-weight: 600; color: #065f46; font-family: monospace; margin-bottom: 12px;">${order.orderNumber}</div>
                <div style="font-size: 14px; color: #059669;">
                  Delivered on ${formatDate(order.deliveredAt)}
                </div>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center;">
                <a href="https://7degrees.co/portal/orders" style="display: inline-block; background-color: #059669; color: white; font-weight: 500; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px;">
                  View in Portal
                </a>
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
                © ${new Date().getFullYear()} 7 Degrees Co. All rights reserved.
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
    subject: `Your order ${order.orderNumber} was delivered`,
    html,
  };
}
