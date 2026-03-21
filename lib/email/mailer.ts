import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    // External SMTP configured (Brevo, Gmail, SendGrid, etc.)
    const authConfig = process.env.SMTP_USER ? {
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    } : {};

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      ...authConfig,
    });
  } else {
    // No SMTP configured — use Supabase Mailpit (local catch-all, emails viewable at /mail/)
    transporter = nodemailer.createTransport({
      host: '127.0.0.1',
      port: 54325,
      secure: false,
      tls: { rejectUnauthorized: false },
    });
  }

  return transporter;
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transport = getTransporter();
    const from = process.env.SMTP_FROM || `MovaLab <noreply@${process.env.NEXT_PUBLIC_APP_URL?.replace(/https?:\/\//, '') || 'movalab.local'}>`;

    const info = await transport.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    console.warn(`📧 Email sent to ${options.to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
