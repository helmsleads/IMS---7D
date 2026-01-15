interface LowStockItem {
  sku: string;
  productName: string;
  currentQty: number;
  reorderPoint: number;
  locationName?: string;
}

interface LowStockAlertParams {
  items: LowStockItem[];
}

export function lowStockAlertEmail({ items }: LowStockAlertParams): {
  subject: string;
  html: string;
} {
  const criticalItems = items.filter((item) => item.currentQty === 0);
  const lowItems = items.filter((item) => item.currentQty > 0);

  const renderItem = (item: LowStockItem, isCritical: boolean) => {
    const percentage = item.reorderPoint > 0
      ? Math.round((item.currentQty / item.reorderPoint) * 100)
      : 0;

    const barColor = isCritical ? "#ef4444" : "#f59e0b";
    const barWidth = Math.min(percentage, 100);

    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <div style="font-weight: 600; color: #111827; font-size: 14px;">${item.productName}</div>
          <div style="font-size: 13px; color: #6b7280; font-family: monospace;">${item.sku}</div>
          ${item.locationName ? `<div style="font-size: 12px; color: #9ca3af;">${item.locationName}</div>` : ""}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; width: 100px;">
          <div style="font-size: 20px; font-weight: 700; color: ${isCritical ? "#dc2626" : "#d97706"};">${item.currentQty.toLocaleString()}</div>
          <div style="font-size: 11px; color: #6b7280;">current</div>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; width: 100px;">
          <div style="font-size: 16px; font-weight: 500; color: #374151;">${item.reorderPoint.toLocaleString()}</div>
          <div style="font-size: 11px; color: #6b7280;">reorder at</div>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; width: 120px;">
          <div style="background-color: #e5e7eb; border-radius: 4px; height: 8px; overflow: hidden;">
            <div style="background-color: ${barColor}; height: 100%; width: ${barWidth}%;"></div>
          </div>
          <div style="font-size: 11px; color: #6b7280; text-align: center; margin-top: 4px;">${percentage}%</div>
        </td>
      </tr>
    `;
  };

  const criticalHtml = criticalItems.length > 0
    ? `
      <div style="margin-bottom: 24px;">
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px 8px 0 0; padding: 12px 16px;">
          <span style="color: #dc2626; font-weight: 700; font-size: 14px;">🚨 OUT OF STOCK (${criticalItems.length})</span>
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #fecaca; border-top: none; border-radius: 0 0 8px 8px; overflow: hidden;">
          <tbody>
            ${criticalItems.map((item) => renderItem(item, true)).join("")}
          </tbody>
        </table>
      </div>
    `
    : "";

  const lowHtml = lowItems.length > 0
    ? `
      <div style="margin-bottom: 24px;">
        <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px 8px 0 0; padding: 12px 16px;">
          <span style="color: #b45309; font-weight: 700; font-size: 14px;">⚠️ LOW STOCK (${lowItems.length})</span>
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #fde68a; border-top: none; border-radius: 0 0 8px 8px; overflow: hidden;">
          <tbody>
            ${lowItems.map((item) => renderItem(item, false)).join("")}
          </tbody>
        </table>
      </div>
    `
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Low Stock Alert</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="650" cellspacing="0" cellpadding="0" style="max-width: 650px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background-color: #1f2937; padding: 24px 32px; border-radius: 12px 12px 0 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 20px; font-weight: bold; color: white;">7 Degrees Co</div>
                    <div style="font-size: 13px; color: #9ca3af; margin-top: 2px;">Inventory Alert</div>
                  </td>
                  <td style="text-align: right;">
                    <span style="display: inline-block; background-color: #f59e0b; color: #1f2937; font-size: 12px; font-weight: 700; padding: 6px 12px; border-radius: 20px;">
                      LOW STOCK
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="background-color: white; padding: 32px;">

              <!-- Summary -->
              <div style="text-align: center; margin-bottom: 32px;">
                <div style="font-size: 48px; font-weight: 700; color: #111827;">${items.length}</div>
                <div style="font-size: 16px; color: #6b7280;">item${items.length !== 1 ? "s" : ""} need${items.length === 1 ? "s" : ""} attention</div>
              </div>

              <!-- Stats Row -->
              <div style="display: flex; margin-bottom: 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="50%" style="text-align: center; padding: 16px; background-color: #fef2f2; border-radius: 8px 0 0 8px;">
                      <div style="font-size: 28px; font-weight: 700; color: #dc2626;">${criticalItems.length}</div>
                      <div style="font-size: 13px; color: #991b1b;">Out of Stock</div>
                    </td>
                    <td width="50%" style="text-align: center; padding: 16px; background-color: #fffbeb; border-radius: 0 8px 8px 0;">
                      <div style="font-size: 28px; font-weight: 700; color: #d97706;">${lowItems.length}</div>
                      <div style="font-size: 13px; color: #92400e;">Low Stock</div>
                    </td>
                  </tr>
                </table>
              </div>

              ${criticalHtml}
              ${lowHtml}

              <!-- CTA Button -->
              <div style="text-align: center; margin-top: 32px;">
                <a href="https://7degrees.co/reports/low-stock" style="display: inline-block; background-color: #2563eb; color: white; font-weight: 600; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px;">
                  View Full Report
                </a>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #1f2937; padding: 20px 32px; border-radius: 0 0 12px 12px; text-align: center;">
              <div style="font-size: 12px; color: #9ca3af;">
                This alert was generated automatically based on your reorder point settings
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
    subject: `Low Stock Alert - ${items.length} item${items.length !== 1 ? "s" : ""} need attention`,
    html,
  };
}
