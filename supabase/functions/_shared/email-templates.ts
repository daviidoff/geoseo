/**
 * HyperNiche AI Email Template System
 *
 * A shared design system for all transactional emails.
 * Uses inline CSS for maximum email client compatibility.
 */

// Brand colors
const COLORS = {
  primary: '#8B5CF6',      // Purple
  primaryDark: '#7C3AED',
  secondary: '#6366F1',    // Indigo
  background: '#0F0F14',   // Dark background
  cardBg: '#1A1A24',       // Card background
  text: '#FFFFFF',
  textMuted: '#A1A1AA',
  border: '#27272A',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
};

// Shared styles
const STYLES = {
  container: `
    background-color: ${COLORS.background};
    padding: 40px 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  `,
  card: `
    background-color: ${COLORS.cardBg};
    border-radius: 16px;
    border: 1px solid ${COLORS.border};
    max-width: 600px;
    margin: 0 auto;
    overflow: hidden;
  `,
  header: `
    background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.secondary} 100%);
    padding: 32px;
    text-align: center;
  `,
  logo: `
    font-size: 24px;
    font-weight: bold;
    color: ${COLORS.text};
    margin: 0;
  `,
  body: `
    padding: 32px;
    color: ${COLORS.text};
  `,
  title: `
    font-size: 24px;
    font-weight: 600;
    color: ${COLORS.text};
    margin: 0 0 16px 0;
    line-height: 1.4;
  `,
  text: `
    font-size: 16px;
    line-height: 1.6;
    color: ${COLORS.textMuted};
    margin: 0 0 16px 0;
  `,
  button: `
    display: inline-block;
    background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.secondary} 100%);
    color: ${COLORS.text};
    text-decoration: none;
    padding: 14px 32px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 16px;
    margin: 24px 0;
  `,
  buttonSecondary: `
    display: inline-block;
    background-color: transparent;
    border: 1px solid ${COLORS.border};
    color: ${COLORS.text};
    text-decoration: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: 500;
    font-size: 14px;
  `,
  divider: `
    border: none;
    border-top: 1px solid ${COLORS.border};
    margin: 24px 0;
  `,
  footer: `
    padding: 24px 32px;
    background-color: rgba(0, 0, 0, 0.2);
    text-align: center;
  `,
  footerText: `
    font-size: 12px;
    color: ${COLORS.textMuted};
    margin: 0 0 8px 0;
  `,
  footerLink: `
    color: ${COLORS.primary};
    text-decoration: none;
  `,
  highlight: `
    background-color: rgba(139, 92, 246, 0.1);
    border-left: 3px solid ${COLORS.primary};
    padding: 16px;
    border-radius: 0 8px 8px 0;
    margin: 16px 0;
  `,
  codeBox: `
    background-color: rgba(0, 0, 0, 0.3);
    border: 1px solid ${COLORS.border};
    border-radius: 8px;
    padding: 16px;
    font-family: 'SF Mono', Monaco, 'Courier New', monospace;
    font-size: 14px;
    color: ${COLORS.text};
    text-align: center;
    letter-spacing: 2px;
  `,
  badge: (color: string) => `
    display: inline-block;
    background-color: ${color}20;
    color: ${color};
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
  `,
};

/**
 * Base email layout wrapper
 */
export function emailLayout(content: string, preheader?: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>HyperNiche AI</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; ${STYLES.container}">
  ${preheader ? `<div style="display: none; max-height: 0; overflow: hidden;">${preheader}</div>` : ''}
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
    <tr>
      <td style="padding: 20px;">
        <div style="${STYLES.card}">
          <!-- Header -->
          <div style="${STYLES.header}">
            <h1 style="${STYLES.logo}">✨ HyperNiche AI</h1>
          </div>

          <!-- Body -->
          <div style="${STYLES.body}">
            ${content}
          </div>

          <!-- Footer -->
          <div style="${STYLES.footer}">
            <p style="${STYLES.footerText}">
              © ${new Date().getFullYear()} HyperNiche AI by SCAILE. All rights reserved.
            </p>
            <p style="${STYLES.footerText}">
              <a href="https://hyperniche.ai/privacy" style="${STYLES.footerLink}">Privacy Policy</a>
              &nbsp;·&nbsp;
              <a href="https://hyperniche.ai/terms" style="${STYLES.footerLink}">Terms of Service</a>
              &nbsp;·&nbsp;
              <a href="https://hyperniche.ai" style="${STYLES.footerLink}">Visit Website</a>
            </p>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Confirmation Email Template
 */
export function confirmEmailTemplate(data: {
  confirmUrl: string;
  email: string;
}): string {
  const content = `
    <h2 style="${STYLES.title}">Confirm your email address</h2>
    <p style="${STYLES.text}">
      Thanks for signing up for HyperNiche AI! Please confirm your email address to get started with AI-powered Answer Engine Optimization.
    </p>

    <div style="text-align: center;">
      <a href="${data.confirmUrl}" style="${STYLES.button}">
        Confirm Email Address
      </a>
    </div>

    <p style="${STYLES.text}">
      Or copy and paste this link into your browser:
    </p>
    <div style="${STYLES.codeBox}">
      ${data.confirmUrl}
    </div>

    <hr style="${STYLES.divider}">

    <p style="${STYLES.text}; font-size: 14px;">
      If you didn't create an account with HyperNiche AI, you can safely ignore this email.
    </p>
  `;

  return emailLayout(content, 'Confirm your email to start using HyperNiche AI');
}

/**
 * Welcome Email Template
 */
export function welcomeEmailTemplate(data: {
  userName?: string;
  loginUrl: string;
}): string {
  const greeting = data.userName ? `Hey ${data.userName}` : 'Welcome';

  const content = `
    <h2 style="${STYLES.title}">${greeting}, welcome to HyperNiche AI! 🎉</h2>
    <p style="${STYLES.text}">
      You're all set to start optimizing your brand's visibility in AI search engines like ChatGPT, Perplexity, Claude, and Gemini.
    </p>

    <div style="${STYLES.highlight}">
      <p style="margin: 0; color: ${COLORS.text}; font-weight: 500;">
        Here's what you can do with HyperNiche AI:
      </p>
    </div>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td style="padding: 12px 0;">
          <strong style="color: ${COLORS.text};">🎯 Context Analysis</strong>
          <p style="${STYLES.text}; margin: 4px 0 0 0; font-size: 14px;">
            Extract company context and EEAT signals from any website
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 0;">
          <strong style="color: ${COLORS.text};">🔑 Keyword Generation</strong>
          <p style="${STYLES.text}; margin: 4px 0 0 0; font-size: 14px;">
            Generate strategic keywords optimized for AI visibility
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 0;">
          <strong style="color: ${COLORS.text};">📝 Blog Generation</strong>
          <p style="${STYLES.text}; margin: 4px 0 0 0; font-size: 14px;">
            Create AEO-optimized content that AI engines love
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 0;">
          <strong style="color: ${COLORS.text};">📊 Analytics</strong>
          <p style="${STYLES.text}; margin: 4px 0 0 0; font-size: 14px;">
            Track your brand's mentions across AI platforms
          </p>
        </td>
      </tr>
    </table>

    <div style="text-align: center;">
      <a href="${data.loginUrl}" style="${STYLES.button}">
        Get Started Now
      </a>
    </div>

    <hr style="${STYLES.divider}">

    <p style="${STYLES.text}; font-size: 14px;">
      Need help? Reply to this email or check out our documentation at
      <a href="https://hyperniche.ai/docs" style="color: ${COLORS.primary};">hyperniche.ai/docs</a>
    </p>
  `;

  return emailLayout(content, 'Welcome to HyperNiche AI - Start optimizing for AI search engines');
}

/**
 * Password Reset Email Template
 */
export function passwordResetTemplate(data: {
  resetUrl: string;
  email: string;
}): string {
  const content = `
    <h2 style="${STYLES.title}">Reset your password</h2>
    <p style="${STYLES.text}">
      We received a request to reset your password for your HyperNiche AI account associated with <strong style="color: ${COLORS.text};">${data.email}</strong>.
    </p>

    <div style="text-align: center;">
      <a href="${data.resetUrl}" style="${STYLES.button}">
        Reset Password
      </a>
    </div>

    <p style="${STYLES.text}">
      This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
    </p>

    <hr style="${STYLES.divider}">

    <p style="${STYLES.text}; font-size: 14px;">
      For security, this request was received from your account. If you did not make this request, please secure your account immediately.
    </p>
  `;

  return emailLayout(content, 'Reset your HyperNiche AI password');
}

/**
 * Subscription Created Email Template
 */
export function subscriptionCreatedTemplate(data: {
  planName: string;
  amount: string;
  billingCycle: 'monthly' | 'yearly';
  nextBillingDate: string;
  dashboardUrl: string;
}): string {
  const content = `
    <h2 style="${STYLES.title}">Welcome to ${data.planName}! 🚀</h2>
    <p style="${STYLES.text}">
      Thank you for subscribing to HyperNiche AI. Your subscription is now active and you have full access to all ${data.planName} features.
    </p>

    <div style="${STYLES.highlight}">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td style="padding: 8px 0;">
            <span style="color: ${COLORS.textMuted};">Plan:</span>
            <strong style="color: ${COLORS.text}; float: right;">${data.planName}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <span style="color: ${COLORS.textMuted};">Amount:</span>
            <strong style="color: ${COLORS.text}; float: right;">${data.amount}/${data.billingCycle === 'monthly' ? 'mo' : 'yr'}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <span style="color: ${COLORS.textMuted};">Next billing date:</span>
            <strong style="color: ${COLORS.text}; float: right;">${data.nextBillingDate}</strong>
          </td>
        </tr>
      </table>
    </div>

    <div style="text-align: center;">
      <a href="${data.dashboardUrl}" style="${STYLES.button}">
        Go to Dashboard
      </a>
    </div>

    <hr style="${STYLES.divider}">

    <p style="${STYLES.text}; font-size: 14px;">
      You can manage your subscription anytime from your account settings. If you have any questions, just reply to this email.
    </p>
  `;

  return emailLayout(content, `Your ${data.planName} subscription is now active`);
}

/**
 * Subscription Updated Email Template
 */
export function subscriptionUpdatedTemplate(data: {
  oldPlan: string;
  newPlan: string;
  amount: string;
  effectiveDate: string;
  dashboardUrl: string;
}): string {
  const isUpgrade = data.newPlan.toLowerCase().includes('pro') ||
                    data.newPlan.toLowerCase().includes('business');

  const content = `
    <h2 style="${STYLES.title}">Subscription ${isUpgrade ? 'Upgraded' : 'Updated'} ✨</h2>
    <p style="${STYLES.text}">
      Your HyperNiche AI subscription has been ${isUpgrade ? 'upgraded' : 'changed'} from <strong style="color: ${COLORS.text};">${data.oldPlan}</strong> to <strong style="color: ${COLORS.text};">${data.newPlan}</strong>.
    </p>

    <div style="${STYLES.highlight}">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td style="padding: 8px 0;">
            <span style="color: ${COLORS.textMuted};">Previous plan:</span>
            <span style="color: ${COLORS.text}; float: right; text-decoration: line-through;">${data.oldPlan}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <span style="color: ${COLORS.textMuted};">New plan:</span>
            <strong style="color: ${COLORS.primary}; float: right;">${data.newPlan}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <span style="color: ${COLORS.textMuted};">New amount:</span>
            <strong style="color: ${COLORS.text}; float: right;">${data.amount}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <span style="color: ${COLORS.textMuted};">Effective:</span>
            <strong style="color: ${COLORS.text}; float: right;">${data.effectiveDate}</strong>
          </td>
        </tr>
      </table>
    </div>

    <div style="text-align: center;">
      <a href="${data.dashboardUrl}" style="${STYLES.button}">
        View New Features
      </a>
    </div>
  `;

  return emailLayout(content, `Your subscription has been updated to ${data.newPlan}`);
}

/**
 * Subscription Cancelled Email Template
 */
export function subscriptionCancelledTemplate(data: {
  planName: string;
  endDate: string;
  reactivateUrl: string;
}): string {
  const content = `
    <h2 style="${STYLES.title}">We're sorry to see you go 😢</h2>
    <p style="${STYLES.text}">
      Your <strong style="color: ${COLORS.text};">${data.planName}</strong> subscription has been cancelled. You'll continue to have access until <strong style="color: ${COLORS.text};">${data.endDate}</strong>.
    </p>

    <div style="${STYLES.highlight}">
      <p style="margin: 0; color: ${COLORS.text};">
        <strong>What happens next?</strong>
      </p>
      <ul style="margin: 12px 0 0 0; padding-left: 20px; color: ${COLORS.textMuted};">
        <li style="margin: 8px 0;">Your data will be preserved for 30 days</li>
        <li style="margin: 8px 0;">You can reactivate anytime before ${data.endDate}</li>
        <li style="margin: 8px 0;">After that, you'll be moved to our free tier</li>
      </ul>
    </div>

    <p style="${STYLES.text}">
      Changed your mind? You can reactivate your subscription at any time.
    </p>

    <div style="text-align: center;">
      <a href="${data.reactivateUrl}" style="${STYLES.button}">
        Reactivate Subscription
      </a>
    </div>

    <hr style="${STYLES.divider}">

    <p style="${STYLES.text}; font-size: 14px;">
      We'd love to hear your feedback on why you cancelled. Reply to this email and let us know how we can improve.
    </p>
  `;

  return emailLayout(content, `Your ${data.planName} subscription has been cancelled`);
}

/**
 * Payment Failed Email Template
 */
export function paymentFailedTemplate(data: {
  amount: string;
  lastFourDigits: string;
  retryDate: string;
  updatePaymentUrl: string;
}): string {
  const content = `
    <h2 style="${STYLES.title}">Payment Failed ⚠️</h2>
    <p style="${STYLES.text}">
      We were unable to process your payment of <strong style="color: ${COLORS.text};">${data.amount}</strong> for your HyperNiche AI subscription.
    </p>

    <div style="${STYLES.highlight}; border-left-color: ${COLORS.warning}; background-color: rgba(245, 158, 11, 0.1);">
      <p style="margin: 0; color: ${COLORS.text};">
        <strong>Payment details:</strong>
      </p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 12px;">
        <tr>
          <td style="padding: 4px 0;">
            <span style="color: ${COLORS.textMuted};">Card ending in:</span>
            <strong style="color: ${COLORS.text}; float: right;">****${data.lastFourDigits}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 4px 0;">
            <span style="color: ${COLORS.textMuted};">Amount:</span>
            <strong style="color: ${COLORS.text}; float: right;">${data.amount}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 4px 0;">
            <span style="color: ${COLORS.textMuted};">Next retry:</span>
            <strong style="color: ${COLORS.text}; float: right;">${data.retryDate}</strong>
          </td>
        </tr>
      </table>
    </div>

    <p style="${STYLES.text}">
      Please update your payment method to avoid any service interruption.
    </p>

    <div style="text-align: center;">
      <a href="${data.updatePaymentUrl}" style="${STYLES.button}">
        Update Payment Method
      </a>
    </div>
  `;

  return emailLayout(content, 'Action required: Update your payment method');
}

/**
 * Invoice Email Template
 */
export function invoiceEmailTemplate(data: {
  invoiceNumber: string;
  amount: string;
  planName: string;
  billingPeriod: string;
  invoiceUrl: string;
}): string {
  const content = `
    <h2 style="${STYLES.title}">Invoice #${data.invoiceNumber}</h2>
    <p style="${STYLES.text}">
      Thank you for your payment! Here's your invoice for HyperNiche AI.
    </p>

    <div style="${STYLES.highlight}">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td style="padding: 8px 0;">
            <span style="color: ${COLORS.textMuted};">Invoice number:</span>
            <strong style="color: ${COLORS.text}; float: right;">#${data.invoiceNumber}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <span style="color: ${COLORS.textMuted};">Plan:</span>
            <strong style="color: ${COLORS.text}; float: right;">${data.planName}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <span style="color: ${COLORS.textMuted};">Period:</span>
            <strong style="color: ${COLORS.text}; float: right;">${data.billingPeriod}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 16px 0 8px 0; border-top: 1px solid ${COLORS.border};">
            <span style="color: ${COLORS.textMuted};">Total paid:</span>
            <strong style="color: ${COLORS.success}; float: right; font-size: 18px;">${data.amount}</strong>
          </td>
        </tr>
      </table>
    </div>

    <div style="text-align: center;">
      <a href="${data.invoiceUrl}" style="${STYLES.button}">
        View Invoice
      </a>
    </div>
  `;

  return emailLayout(content, `Invoice #${data.invoiceNumber} for HyperNiche AI`);
}

/**
 * Magic Link Email Template
 */
export function magicLinkTemplate(data: {
  magicLinkUrl: string;
  email: string;
  expiresIn: string;
}): string {
  const content = `
    <h2 style="${STYLES.title}">Sign in to HyperNiche AI</h2>
    <p style="${STYLES.text}">
      Click the button below to sign in to your account. This link will expire in ${data.expiresIn}.
    </p>

    <div style="text-align: center;">
      <a href="${data.magicLinkUrl}" style="${STYLES.button}">
        Sign In
      </a>
    </div>

    <p style="${STYLES.text}">
      Or copy and paste this link into your browser:
    </p>
    <div style="${STYLES.codeBox}; word-break: break-all;">
      ${data.magicLinkUrl}
    </div>

    <hr style="${STYLES.divider}">

    <p style="${STYLES.text}; font-size: 14px;">
      If you didn't request this link, you can safely ignore this email. Someone may have typed your email address by mistake.
    </p>
  `;

  return emailLayout(content, 'Your sign-in link for HyperNiche AI');
}

/**
 * Waitlist Confirmation Email Template
 */
export function waitlistConfirmationTemplate(data: {
  name?: string;
  email: string;
}): string {
  const greeting = data.name ? `Hey ${data.name}` : 'Hey there';

  const content = `
    <h2 style="${STYLES.title}">${greeting}, you're on the list! 🎉</h2>
    <p style="${STYLES.text}">
      Thanks for joining the HyperNiche AI waitlist. We're building the future of AI-powered content optimization, and you'll be among the first to experience it.
    </p>

    <div style="${STYLES.highlight}">
      <p style="margin: 0; color: ${COLORS.text}; font-weight: 500;">
        What happens next?
      </p>
      <ul style="margin: 12px 0 0 0; padding-left: 20px; color: ${COLORS.textMuted};">
        <li style="margin: 8px 0;">We'll notify you as soon as early access opens</li>
        <li style="margin: 8px 0;">You'll get exclusive founding member benefits</li>
        <li style="margin: 8px 0;">Be the first to optimize for AI search engines</li>
      </ul>
    </div>

    <p style="${STYLES.text}">
      <strong style="color: ${COLORS.text};">HyperNiche AI helps you:</strong>
    </p>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 16px 0;">
      <tr>
        <td style="padding: 8px 0;">
          <strong style="color: ${COLORS.text};">🎯 Get discovered by AI</strong>
          <p style="${STYLES.text}; margin: 4px 0 0 0; font-size: 14px;">
            Optimize content for ChatGPT, Perplexity, Claude, and Gemini
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 0;">
          <strong style="color: ${COLORS.text};">🔑 Find the right keywords</strong>
          <p style="${STYLES.text}; margin: 4px 0 0 0; font-size: 14px;">
            Generate AEO-optimized keywords with intent analysis
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 0;">
          <strong style="color: ${COLORS.text};">📝 Create winning content</strong>
          <p style="${STYLES.text}; margin: 4px 0 0 0; font-size: 14px;">
            8-stage blog pipeline for content that AI recommends
          </p>
        </td>
      </tr>
    </table>

    <div style="text-align: center;">
      <a href="https://hyperniche.ai" style="${STYLES.button}">
        Learn More
      </a>
    </div>

    <hr style="${STYLES.divider}">

    <p style="${STYLES.text}; font-size: 14px;">
      Questions? Just reply to this email. We'd love to hear from you!
    </p>
  `;

  return emailLayout(content, "You're on the HyperNiche AI waitlist!");
}
