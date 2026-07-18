/**
 * ABOUTME: Email template system for HyperNiche AI
 * ABOUTME: Environment-agnostic templates compatible with both Next.js and Edge Functions
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
};

/**
 * Base email layout wrapper
 */
function emailLayout(content: string, preheader?: string): string {
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
            <h1 style="${STYLES.logo}">HyperNiche AI</h1>
          </div>

          <!-- Body -->
          <div style="${STYLES.body}">
            ${content}
          </div>

          <!-- Footer -->
          <div style="${STYLES.footer}">
            <p style="${STYLES.footerText}">
              &copy; ${new Date().getFullYear()} HyperNiche AI by SCAILE. All rights reserved.
            </p>
            <p style="${STYLES.footerText}">
              <a href="https://hyperniche.ai/privacy" style="${STYLES.footerLink}">Privacy Policy</a>
              &nbsp;&middot;&nbsp;
              <a href="https://hyperniche.ai/terms" style="${STYLES.footerLink}">Terms of Service</a>
              &nbsp;&middot;&nbsp;
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

export { emailLayout, COLORS, STYLES };
