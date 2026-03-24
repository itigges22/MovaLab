export function clientInvitationEmailHtml(params: {
  accountName: string;
  inviteUrl: string;
  expiresInDays: number;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Client Portal Invitation</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#1e40af;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">MovaLab</h1>
              <p style="margin:4px 0 0;color:#93c5fd;font-size:14px;">Client Portal</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">You're Invited</h2>
              <p style="margin:0 0 24px;color:#4b5563;font-size:15px;line-height:1.6;">
                <strong>${params.accountName}</strong> has invited you to their client portal on MovaLab. You'll be able to:
              </p>
              <ul style="color:#4b5563;font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 24px;">
                <li>Track your project progress in real-time</li>
                <li>Approve or request revisions on deliverables</li>
                <li>Provide feedback to the team</li>
              </ul>
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${params.inviteUrl}" style="display:inline-block;padding:14px 32px;background-color:#1e40af;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:8px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">This invitation expires in <strong>${params.expiresInDays} days</strong>.</p>
              <p style="margin:0;color:#6b7280;font-size:13px;">If you didn't expect this invitation, you can safely ignore this email.</p>
              <!-- Link fallback -->
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">If the button doesn't work, copy and paste this link:<br>
                <a href="${params.inviteUrl}" style="color:#1e40af;word-break:break-all;">${params.inviteUrl}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                Sent by MovaLab &mdash; Professional Service Automation
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function clientInvitationEmailText(params: {
  accountName: string;
  inviteUrl: string;
  expiresInDays: number;
}): string {
  return `You're invited to ${params.accountName}'s client portal on MovaLab.

Accept your invitation: ${params.inviteUrl}

This invitation expires in ${params.expiresInDays} days.`;
}
