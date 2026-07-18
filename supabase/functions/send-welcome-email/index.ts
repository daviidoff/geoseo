/**
 * Send Welcome Email Edge Function
 *
 * Triggered when a user confirms their email (via database trigger or webhook).
 * Sends a branded welcome email via Resend.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail } from '../_shared/resend.ts';
import { welcomeEmailTemplate } from '../_shared/email-templates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WelcomeEmailPayload {
  type: 'INSERT' | 'UPDATE';
  table: string;
  record: {
    id: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
    email_confirmed_at?: string;
  };
  old_record?: {
    email_confirmed_at?: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: WelcomeEmailPayload = await req.json();
    const { record, old_record, type } = payload;

    // Only send welcome email when email_confirmed_at changes from null to a value
    // This prevents sending on every profile update
    if (type === 'UPDATE') {
      const wasUnconfirmed = !old_record?.email_confirmed_at;
      const isNowConfirmed = !!record.email_confirmed_at;

      if (!wasUnconfirmed || !isNowConfirmed) {
        console.log('Skipping welcome email - not a confirmation event');
        return new Response(
          JSON.stringify({ skipped: true, reason: 'Not a confirmation event' }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    console.log(`Processing welcome email for: ${record.email}`);

    const siteUrl = Deno.env.get('SITE_URL') || 'https://hyperniche.ai';
    const loginUrl = `${siteUrl}/context`;

    // Generate email HTML
    const html = welcomeEmailTemplate({
      userName: record.full_name?.split(' ')[0], // First name only
      loginUrl,
    });

    // Send email via Resend
    const result = await sendEmail({
      to: record.email,
      subject: 'Welcome to HyperNiche AI! 🚀',
      html,
      tags: [
        { name: 'email_type', value: 'welcome' },
        { name: 'user_id', value: record.id },
      ],
    });

    if (result.error) {
      console.error('Failed to send welcome email:', result.error);
      return new Response(
        JSON.stringify({ error: result.error.message }),
        {
          status: result.error.statusCode || 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Welcome email sent successfully: ${result.id}`);

    return new Response(
      JSON.stringify({ success: true, emailId: result.id }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
