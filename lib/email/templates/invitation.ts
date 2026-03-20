export function invitationEmailTemplate(options: {
  recipientName: string;
  inviterName: string;
  roleName: string;
  departmentName?: string;
  acceptUrl: string;
  expiresIn: string;
}): { subject: string; html: string; text: string } {
  const subject = `You've been invited to join MovaLab`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MovaLab Invitation</title>
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
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">You're invited!</h2>
              <p style="margin:0 0 24px;color:#4b5563;font-size:15px;line-height:1.6;">
                <strong>${options.inviterName}</strong> has invited you to join their team on MovaLab as a <strong>${options.roleName}</strong>${options.departmentName ? ` in the <strong>${options.departmentName}</strong> department` : ''}.
              </p>
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${options.acceptUrl}" style="display:inline-block;padding:14px 32px;background-color:#1e40af;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:8px;">
                      Accept Invitation & Create Account
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">This invitation expires in <strong>${options.expiresIn}</strong>.</p>
              <p style="margin:0;color:#6b7280;font-size:13px;">If you didn't expect this invitation, you can safely ignore this email.</p>
              <!-- Link fallback -->
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">If the button doesn't work, copy and paste this link:<br>
                <a href="${options.acceptUrl}" style="color:#1e40af;word-break:break-all;">${options.acceptUrl}</a>
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

  const text = `You're invited to MovaLab!

${options.inviterName} has invited you to join as ${options.roleName}${options.departmentName ? ` in ${options.departmentName}` : ''}.

Accept your invitation: ${options.acceptUrl}

This invitation expires in ${options.expiresIn}.`;

  return { subject, html, text };
}
