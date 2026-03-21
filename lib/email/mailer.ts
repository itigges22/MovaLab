/**
 * Email sending service
 *
 * Supports two modes:
 * 1. Resend HTTP API (recommended for VPS — no SMTP ports needed)
 *    Set RESEND_API_KEY in .env.local
 * 2. Fallback: Supabase Mailpit (local catch-all, viewable at /mail/)
 */

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY || process.env.SMTP_PASS;

  if (resendKey && resendKey.startsWith('re_')) {
    // Use Resend HTTP API (works even when SMTP ports are blocked)
    return sendViaResend(resendKey, options);
  }

  // Fallback: Supabase Mailpit (local email testing)
  return sendViaMailpit(options);
}

async function sendViaResend(
  apiKey: string,
  options: { to: string; subject: string; html: string; text?: string }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const from = process.env.SMTP_FROM || 'MovaLab <onboarding@resend.dev>';

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      return { success: false, error: data.message || `HTTP ${res.status}` };
    }

    console.warn(`📧 Email sent to ${options.to} via Resend: ${data.id}`);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Failed to send email via Resend:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function sendViaMailpit(
  options: { to: string; subject: string; html: string; text?: string }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Dynamic import to avoid bundling nodemailer when using Resend
    const nodemailer = await import('nodemailer');

    const transporter = nodemailer.default.createTransport({
      host: '127.0.0.1',
      port: 54325,
      secure: false,
      tls: { rejectUnauthorized: false },
    });

    const from = process.env.SMTP_FROM || 'MovaLab <noreply@movalab.local>';

    const info = await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    console.warn(`📧 Email sent to ${options.to} via Mailpit: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send email via Mailpit:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
