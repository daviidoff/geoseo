/**
 * ABOUTME: Resend email client for Next.js API routes
 * ABOUTME: Sends transactional emails via Resend API
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_API_URL = 'https://api.resend.com/emails';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

export interface ResendResponse {
  id?: string;
  error?: { message: string; statusCode: number };
}

export async function sendEmail(options: SendEmailOptions): Promise<ResendResponse> {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured, skipping email send');
    return { error: { message: 'Email service not configured', statusCode: 503 } };
  }

  const { to, subject, html, from, replyTo, tags } = options;

  // Use verified scaile.tech domain for sending emails
  const senderEmail = from || 'HyperNiche AI <noreply@mail.scaile.tech>';

  console.log(`Sending email from: ${senderEmail} to: ${to}`);

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: senderEmail,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        reply_to: replyTo,
        tags,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Resend API error:', errorData);
      return {
        error: {
          message: errorData.message || 'Failed to send email',
          statusCode: response.status,
        },
      };
    }

    const data = await response.json();

    console.log('Email sent successfully:', data.id);
    return { id: data.id };
  } catch (error) {
    console.error('Email send failed:', error);
    return {
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
      },
    };
  }
}
