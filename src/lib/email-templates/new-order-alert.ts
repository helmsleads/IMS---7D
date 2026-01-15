interface NewOrderAlertParams {
  order: {
    id: string;
    orderNumber: string;
    createdAt: string;
    shipToAddress: string;
    shipToCity: string;
    shipToState: string;
    shipToPostalCode: string;
    isRush: boolean;
    notes?: string | null;
  };
  client: {
    companyName: string;
    contactName: string;
    email: string;
  };
  items: {
    productName: string;
    sku: string;
    qtyRequested: number;
  }[];
}

export function newOrderAlertEmail({ order, client, items }: NewOrderAlertParams): {
  subject: string;
  html: string;
} {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const totalUnits = items.reduce((sum, item) => sum + item.qtyRequested, 0);

  const itemsHtml = items
    .map(
      (item) => `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">
            ${item.sku}
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">
            ${item.productName}
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; font-size: 14px;">
            ${item.qtyRequested.toLocaleString()}
          </td>
        </tr>
      `
    )
    .join("");

  const rushBanner = order.isRush
    ? `
      <div style="background-color: #fef2f2; border: 2px solid #ef4444; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; text-align: center;">
        <span style="color: #dc2626; font-weight: 700; font-size: 16px;">⚡ RUSH ORDER - Priority Processing Required</span>
      </div>
    `
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Order Alert</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background-color: #1f2937; padding: 24px 32px; border-radius: 12px 12px 0 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 20px; font-weight: bold; color: white;">7 Degrees Co</div>
                    <div style="font-size: 13px; color: #9ca3af; margin-top: 2px;">Internal Alert</div>
                  </td>
                  <td style="text-align: right;">
                    <span style="display: inline-block; background-color: #3b82f6; color: white; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 20px;">
                      NEW ORDER
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="background-color: white; padding: 32px;">

              ${rushBanner}

              <!-- Order Header -->
              <div style="margin-bottom: 24px;">
                <div style="font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Order Number</div>
                <div style="font-size: 28px; font-weight: 700; color: #111827; font-family: monospace;">${order.orderNumber}</div>
                <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">Submitted ${formatDate(order.createdAt)}</div>
              </div>

              <!-- Client Info -->
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <div style="font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Client</div>
                <div style="font-size: 18px; font-weight: 600; color: #111827;">${client.companyName}</div>
                <div style="font-size: 14px; color: #374151; margin-top: 4px;">${client.contactName}</div>
                <div style="font-size: 14px; color: #6b7280;">${client.email}</div>
              </div>

              <!-- Ship To -->
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <div style="font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Ship To</div>
                <div style="font-size: 14px; color: #374151;">
                  <div>${order.shipToAddress}</div>
                  <div>${order.shipToCity}, ${order.shipToState} ${order.shipToPostalCode}</div>
                </div>
              </div>

              <!-- Items Table -->
              <div style="margin-bottom: 24px;">
                <div style="font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Items Requested (${items.length})</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                  <thead>
                    <tr style="background-color: #f9fafb;">
                      <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">SKU</th>
                      <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Product</th>
                      <th style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                  </tbody>
                  <tfoot>
                    <tr style="background-color: #1f2937;">
                      <td colspan="2" style="padding: 12px; font-weight: 600; color: white; font-size: 14px;">Total Units</td>
                      <td style="padding: 12px; text-align: right; font-weight: 700; color: white; font-size: 16px;">${totalUnits.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              ${order.notes ? `
              <!-- Notes -->
              <div style="background-color: #fefce8; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <div style="font-size: 13px; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Client Notes</div>
                <div style="font-size: 14px; color: #713f12;">${order.notes}</div>
              </div>
              ` : ""}

              <!-- CTA Button -->
              <div style="text-align: center; margin-top: 32px;">
                <a href="https://7degrees.co/outbound/${order.id}" style="display: inline-block; background-color: #2563eb; color: white; font-weight: 600; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px;">
                  View Order in System
                </a>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #1f2937; padding: 20px 32px; border-radius: 0 0 12px 12px; text-align: center;">
              <div style="font-size: 12px; color: #9ca3af;">
                This is an automated notification from the 7 Degrees Inventory Management System
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
    subject: `New order request from ${client.companyName}`,
    html,
  };
}
