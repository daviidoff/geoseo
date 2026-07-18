/**
 * Unified Auth Email Handler
 *
 * Handles all Supabase Auth email events:
 * - signup: Email confirmation
 * - recovery: Password reset
 * - magiclink: Magic link login
 * - email_change: Email change confirmation
 *
 * Called by Supabase Auth hook.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail } from '../_shared/resend.ts';
import {
  confirmEmailTemplate,
  passwordResetTemplate,
  magicLinkTemplate,
} from '../_shared/email-templates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Verify the request is from Supabase Auth
// For HTTPS hooks, Supabase sends the secret in the x-supabase-signature header
// or as part of the webhook payload verification
async function verifyAuthHook(req: Request): Promise<boolean> {
  const hookSecret = Deno.env.get('AUTH_HOOK_SECRET');
  
  // Log all headers for debugging
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = key.toLowerCase().includes('secret') || key.toLowerCase().includes('auth') 
      ? 'present (hidden)' 
      : value.substring(0, 50);
  });
  console.log('Request headers:', JSON.stringify(headers));

  // Check various auth header formats
  const authHeader = req.headers.get('authorization');
  const webhookSecret = req.headers.get('x-webhook-secret');
  const supabaseSignature = req.headers.get('x-supabase-signature');
  
  // Method 1: Bearer token in Authorization header
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    if (hookSecret && token === hookSecret) {
      console.log('Auth verified via Authorization header');
      return true;
    }
    // Accept long tokens (service role keys)
    if (token.length > 100) {
      console.log('Auth verified via service role token length');
      return true;
    }
  }

  // Method 2: x-webhook-secret header
  if (webhookSecret && hookSecret && webhookSecret === hookSecret) {
    console.log('Auth verified via x-webhook-secret header');
    return true;
  }

  // Method 3: Supabase signature header exists (Supabase is calling us)
  if (supabaseSignature) {
    console.log('Auth verified via x-supabase-signature presence');
    return true;
  }

  // Method 4: Check if request comes from Supabase (user-agent or other indicators)
  const userAgent = req.headers.get('user-agent') || '';
  if (userAgent.includes('Supabase') || userAgent.includes('GoTrue')) {
    console.log('Auth verified via user-agent');
    return true;
  }

  // For initial setup/debugging: allow if hook secret not configured
  if (!hookSecret) {
    console.warn('AUTH_HOOK_SECRET not configured - allowing request for testing');
    return true;
  }

  console.error('Auth verification failed - no valid auth method found');
  return false;
}

interface AuthEmailPayload {
  user: {
    id: string;
    email: string;
    email_confirmed_at: string | null;
    user_metadata: {
      full_name?: string;
      name?: string;
    };
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: 'signup' | 'recovery' | 'magiclink' | 'email_change';
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Verify request origin
  if (!(await verifyAuthHook(req))) {
    console.error('Unauthorized request to send-auth-email');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const payload: AuthEmailPayload = await req.json();
    console.log('Received payload:', JSON.stringify(payload, null, 2));
    
    const { user, email_data } = payload;
    const emailType = email_data.email_action_type;

    console.log(`Processing ${emailType} email for: ${user.email}`);
    
    // Check if Resend API key is configured
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.error('RESEND_API_KEY is not configured!');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('RESEND_API_KEY is configured');

    const siteUrl = email_data.site_url || Deno.env.get('SITE_URL') || 'https://hyperniche.ai';

    let html: string;
    let subject: string;

    switch (emailType) {
      case 'signup':
      case 'email_change': {
        const confirmUrl = `${siteUrl}/auth/callback?token_hash=${email_data.token_hash}&type=${emailType === 'signup' ? 'signup' : 'email_change'}&next=/context`;
        subject = emailType === 'signup'
          ? 'Confirm your HyperNiche AI account'
          : 'Confirm your new email address';
        html = confirmEmailTemplate({ confirmUrl, email: user.email });
        break;
      }

      case 'recovery': {
        const resetUrl = `${siteUrl}/auth/callback?token_hash=${email_data.token_hash}&type=recovery&next=/auth/reset-password`;
        subject = 'Reset your HyperNiche AI password';
        html = passwordResetTemplate({ resetUrl, email: user.email });
        break;
      }

      case 'magiclink': {
        const magicLinkUrl = `${siteUrl}/auth/callback?token_hash=${email_data.token_hash}&type=magiclink&next=/context`;
        subject = 'Sign in to HyperNiche AI';
        html = magicLinkTemplate({ magicLinkUrl, email: user.email, expiresIn: '1 hour' });
        break;
      }

      default:
        console.error(`Unknown email type: ${emailType}`);
        return new Response(
          JSON.stringify({ error: `Unknown email type: ${emailType}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Send email via Resend
    const result = await sendEmail({
      to: user.email,
      subject,
      html,
      tags: [
        { name: 'email_type', value: emailType },
        { name: 'user_id', value: user.id },
      ],
    });

    if (result.error) {
      console.error(`Failed to send ${emailType} email:`, result.error);
      return new Response(
        JSON.stringify({ error: result.error.message }),
        { status: result.error.statusCode || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`${emailType} email sent successfully: ${result.id}`);

    return new Response(
      JSON.stringify({ success: true, emailId: result.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing auth email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
