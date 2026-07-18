/**
 * Send Subscription Email Edge Function
 *
 * Handles all subscription-related email notifications:
 * - subscription_created: New subscription activated
 * - subscription_updated: Plan changed (upgrade/downgrade)
 * - subscription_cancelled: Subscription cancelled
 * - payment_failed: Payment processing failed
 * - invoice_paid: Invoice payment confirmation
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail } from '../_shared/resend.ts';
import {
  subscriptionCreatedTemplate,
  subscriptionUpdatedTemplate,
  subscriptionCancelledTemplate,
  paymentFailedTemplate,
  invoiceEmailTemplate,
} from '../_shared/email-templates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type EmailType =
  | 'subscription_created'
  | 'subscription_updated'
  | 'subscription_cancelled'
  | 'payment_failed'
  | 'invoice_paid';

interface SubscriptionEmailPayload {
  email_type: EmailType;
  user_email: string;
  user_id: string;
  data: {
    // For subscription_created
    plan_name?: string;
    amount?: string;
    billing_cycle?: 'monthly' | 'yearly';
    next_billing_date?: string;

    // For subscription_updated
    old_plan?: string;
    new_plan?: string;
    effective_date?: string;

    // For subscription_cancelled
    end_date?: string;

    // For payment_failed
    last_four_digits?: string;
    retry_date?: string;

    // For invoice_paid
    invoice_number?: string;
    billing_period?: string;
  };
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: SubscriptionEmailPayload = await req.json();
    const { email_type, user_email, user_id, data } = payload;

    console.log(`Processing ${email_type} email for: ${user_email}`);

    const siteUrl = Deno.env.get('SITE_URL') || 'https://hyperniche.ai';
    const dashboardUrl = `${siteUrl}/profile`;
    const billingUrl = `${siteUrl}/profile#billing`;

    let html: string;
    let subject: string;

    switch (email_type) {
      case 'subscription_created':
        subject = `Welcome to ${data.plan_name || 'Pro'}! Your subscription is active`;
        html = subscriptionCreatedTemplate({
          planName: data.plan_name || 'Pro',
          amount: data.amount || '$29',
          billingCycle: data.billing_cycle || 'monthly',
          nextBillingDate: formatDate(data.next_billing_date),
          dashboardUrl,
        });
        break;

      case 'subscription_updated':
        subject = `Your subscription has been updated`;
        html = subscriptionUpdatedTemplate({
          oldPlan: data.old_plan || 'Previous Plan',
          newPlan: data.new_plan || 'New Plan',
          amount: data.amount || '$29/mo',
          effectiveDate: formatDate(data.effective_date),
          dashboardUrl,
        });
        break;

      case 'subscription_cancelled':
        subject = `Your subscription has been cancelled`;
        html = subscriptionCancelledTemplate({
          planName: data.plan_name || 'Pro',
          endDate: formatDate(data.end_date),
          reactivateUrl: billingUrl,
        });
        break;

      case 'payment_failed':
        subject = `Action required: Payment failed`;
        html = paymentFailedTemplate({
          amount: data.amount || '$29',
          lastFourDigits: data.last_four_digits || '****',
          retryDate: formatDate(data.retry_date),
          updatePaymentUrl: billingUrl,
        });
        break;

      case 'invoice_paid':
        subject = `Invoice #${data.invoice_number || '000'} - Payment received`;
        html = invoiceEmailTemplate({
          invoiceNumber: data.invoice_number || '000',
          amount: data.amount || '$29',
          planName: data.plan_name || 'Pro',
          billingPeriod: data.billing_period || 'Current period',
          invoiceUrl: `${siteUrl}/invoices/${data.invoice_number}`,
        });
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown email type: ${email_type}` }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
    }

    // Send email via Resend
    const result = await sendEmail({
      to: user_email,
      subject,
      html,
      tags: [
        { name: 'email_type', value: email_type },
        { name: 'user_id', value: user_id },
      ],
    });

    if (result.error) {
      console.error(`Failed to send ${email_type} email:`, result.error);
      return new Response(
        JSON.stringify({ error: result.error.message }),
        {
          status: result.error.statusCode || 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`${email_type} email sent successfully: ${result.id}`);

    return new Response(
      JSON.stringify({ success: true, emailId: result.id, emailType: email_type }),
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
