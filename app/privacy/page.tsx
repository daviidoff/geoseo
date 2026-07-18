/**
 * ABOUTME: Privacy Policy page
 * ABOUTME: Privacy practices for GeoSEO
 */

import { Metadata } from 'next'
import { Navbar } from '@/components/landing/sections/navbar'
import { FooterSection } from '@/components/landing/sections/footer'

export const metadata: Metadata = {
  title: 'Privacy Policy | GeoSEO',
  description: 'Privacy Policy for GeoSEO',
}

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background pt-24 pb-12">
        <div className="container mx-auto max-w-3xl px-4">
          <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>

          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
            <p className="text-muted-foreground">
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">1. Introduction</h2>
              <p className="text-muted-foreground">
                GeoSEO (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is committed to protecting your privacy.
                This Privacy Policy explains how we collect, use, and share information about you when you use our Service.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">2. Information We Collect</h2>

              <h3 className="text-lg font-medium">Information You Provide</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Account information (email, name, organization)</li>
                <li>Content you create or upload (keywords, prompts, context files)</li>
                <li>Payment information (processed securely by Stripe)</li>
                <li>Communications with us</li>
              </ul>

              <h3 className="text-lg font-medium mt-4">Information Collected Automatically</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Usage data (features used, actions taken)</li>
                <li>Device information (browser type, operating system)</li>
                <li>Log data (IP address, access times, pages viewed)</li>
                <li>Cookies and similar technologies</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">3. How We Use Your Information</h2>
              <p className="text-muted-foreground">We use your information to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Provide, maintain, and improve the Service</li>
                <li>Process transactions and send related information</li>
                <li>Send technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Monitor and analyze usage patterns</li>
                <li>Detect and prevent fraud and abuse</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">4. AI Processing</h2>
              <p className="text-muted-foreground">
                Your prompts and content are sent to third-party AI providers (Google Gemini) to generate responses.
                We do not use your content to train AI models. AI providers may retain data according to their own policies.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">5. Information Sharing</h2>
              <p className="text-muted-foreground">We may share your information with:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>Service Providers:</strong> Companies that help us operate (hosting, payments, analytics)</li>
                <li><strong>AI Providers:</strong> To process your requests (Google)</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect rights</li>
                <li><strong>Business Transfers:</strong> In connection with a merger or acquisition</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                We do not sell your personal information.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">6. Data Retention</h2>
              <p className="text-muted-foreground">
                We retain your information for as long as your account is active or as needed to provide the Service.
                You can request deletion of your account and associated data at any time.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">7. Security</h2>
              <p className="text-muted-foreground">
                We implement appropriate technical and organizational measures to protect your information.
                However, no method of transmission over the Internet is 100% secure.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">8. Your Rights</h2>
              <p className="text-muted-foreground">Depending on your location, you may have the right to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Access your personal information</li>
                <li>Correct inaccurate information</li>
                <li>Delete your information</li>
                <li>Export your data</li>
                <li>Opt out of marketing communications</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">9. Cookies</h2>
              <p className="text-muted-foreground">
                We use cookies and similar technologies for authentication, preferences, and analytics.
                You can control cookies through your browser settings, but some features may not work properly without them.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">10. Children&apos;s Privacy</h2>
              <p className="text-muted-foreground">
                The Service is not intended for children under 13. We do not knowingly collect information
                from children under 13.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">11. International Transfers</h2>
              <p className="text-muted-foreground">
                Your information may be transferred to and processed in countries other than your own.
                We ensure appropriate safeguards are in place for such transfers.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">12. Changes to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this Privacy Policy from time to time. We will notify you of material changes
                via email or in-app notification.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">13. Contact Us</h2>
              <p className="text-muted-foreground">
                For questions about this Privacy Policy, please contact us at hello@scaile.tech
              </p>
            </section>
          </div>
        </div>
      </div>
      <FooterSection />
    </>
  )
}
