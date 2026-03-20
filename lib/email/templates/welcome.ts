export function welcomeEmailTemplate(options: {
  userName: string;
  roleName: string;
  loginUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `Welcome to MovaLab, ${options.userName}!`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#1e40af;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">MovaLab</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Welcome, ${options.userName}!</h2>
              <p style="margin:0 0 24px;color:#4b5563;font-size:15px;line-height:1.6;">
                Your account has been created. You've been assigned the <strong>${options.roleName}</strong> role.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${options.loginUrl}" style="display:inline-block;padding:14px 32px;background-color:#1e40af;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:8px;">
                      Log In to MovaLab
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#6b7280;font-size:13px;">When you first log in, you'll see a guided tutorial that covers everything you need to know.</p>
            </td>
          </tr>
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

  const text = `Welcome to MovaLab, ${options.userName}!

Your account has been created with the ${options.roleName} role.

Log in: ${options.loginUrl}

When you first log in, you'll see a guided tutorial.`;

  return { subject, html, text };
}
