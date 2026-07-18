/**
 * Send Waitlist Confirmation Email Edge Function
 *
 * Triggered when a user signs up for the waitlist.
 * Sends a branded confirmation email via Resend.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail } from '../_shared/resend.ts';
import { waitlistConfirmationTemplate } from '../_shared/email-templates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WaitlistEmailPayload {
  email: string;
  name?: string;
  source?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: WaitlistEmailPayload = await req.json();
    const { email, name, source } = payload;

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Processing waitlist email for: ${email}`);

    // Generate email HTML
    const html = waitlistConfirmationTemplate({
      name: name?.split(' ')[0], // First name only
      email,
    });

    // Send email via Resend
    const result = await sendEmail({
      to: email,
      subject: "You're on the HyperNiche AI waitlist!",
      html,
      replyTo: 'hello@hyperniche.ai',
      tags: [
        { name: 'email_type', value: 'waitlist' },
        { name: 'source', value: source || 'landing' },
      ],
    });

    if (result.error) {
      console.error('Failed to send waitlist email:', result.error);
      return new Response(
        JSON.stringify({ error: result.error.message }),
        {
          status: result.error.statusCode || 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Waitlist email sent successfully: ${result.id}`);

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
