/**
 * ABOUTME: Terms of Service page
 * ABOUTME: Legal terms for using GeoSEO
 */

import { Metadata } from 'next'
import { Navbar } from '@/components/landing/sections/navbar'
import { FooterSection } from '@/components/landing/sections/footer'

export const metadata: Metadata = {
  title: 'Terms of Service | GeoSEO',
  description: 'Terms of Service for GeoSEO',
}

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background pt-24 pb-12">
        <div className="container mx-auto max-w-3xl px-4">
          <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>

          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
            <p className="text-muted-foreground">
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing or using GeoSEO (&quot;Service&quot;), you agree to be bound by these Terms of Service.
                If you do not agree to these terms, please do not use the Service.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">2. Description of Service</h2>
              <p className="text-muted-foreground">
                GeoSEO provides AI-powered Answer Engine Optimization (AEO) tools including keyword research,
                content generation, and company analysis. The Service uses third-party AI models to process your requests.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">3. User Accounts</h2>
              <p className="text-muted-foreground">
                You are responsible for maintaining the confidentiality of your account credentials and for all
                activities that occur under your account. You must notify us immediately of any unauthorized use.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">4. Acceptable Use</h2>
              <p className="text-muted-foreground">You agree not to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Use the Service for any unlawful purpose</li>
                <li>Generate content that is harmful, abusive, or violates third-party rights</li>
                <li>Attempt to circumvent usage limits or security measures</li>
                <li>Resell or redistribute the Service without authorization</li>
                <li>Use automated systems to abuse the Service</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">5. Payment and Billing</h2>
              <p className="text-muted-foreground">
                Paid plans are billed monthly in advance. Subscriptions are non-refundable except as required by law.
                We reserve the right to modify pricing with 30 days notice. Usage limits reset monthly with your billing cycle.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">6. Intellectual Property</h2>
              <p className="text-muted-foreground">
                You retain ownership of content you create using the Service. We retain ownership of the Service,
                including all software, designs, and documentation. You grant us a license to use your content
                solely to provide the Service.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">7. Disclaimer of Warranties</h2>
              <p className="text-muted-foreground">
                THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND. We do not guarantee the accuracy,
                completeness, or usefulness of AI-generated content. You are responsible for reviewing and validating
                all outputs before use.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">8. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, we shall not be liable for any indirect, incidental,
                special, or consequential damages arising from your use of the Service. Our total liability
                shall not exceed the amount you paid us in the 12 months preceding the claim.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">9. Termination</h2>
              <p className="text-muted-foreground">
                We may suspend or terminate your access to the Service at any time for violation of these terms.
                You may cancel your account at any time through your account settings.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">10. Changes to Terms</h2>
              <p className="text-muted-foreground">
                We may modify these terms at any time. Continued use of the Service after changes constitutes
                acceptance of the new terms. Material changes will be communicated via email or in-app notification.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">11. Contact</h2>
              <p className="text-muted-foreground">
                For questions about these Terms, please contact us at hello@scaile.tech
              </p>
            </section>
          </div>
        </div>
      </div>
      <FooterSection />
    </>
  )
}
