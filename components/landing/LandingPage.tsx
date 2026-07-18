// ABOUTME: Main landing page component for AEO Visibility
// ABOUTME: Composes all landing sections in order with navbar

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar } from "./sections/navbar";
import { HeroSection } from "./sections/hero";
import { ComparisonSection } from "./sections/comparison";
import { FeaturesSection } from "./sections/features";
import { HowItWorksSection } from "./sections/how-it-works";
import { UseCasesSection } from "./sections/use-cases";
import { FAQSection } from "./sections/faq";
import { CTASection } from "./sections/cta";
import { FooterSection } from "./sections/footer";
import { AppPreviewSection } from "./sections/app-preview";
import { AIPlatformsStrip, TrustedByStrip } from "./sections/logo-strip";
import { WaitlistModal } from "@/components/waitlist/WaitlistModal";

export function LandingPage() {
  const searchParams = useSearchParams();
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);

  // Auto-open waitlist modal if ?waitlist=true is in URL (from auth redirect)
  useEffect(() => {
    if (searchParams.get("waitlist") === "true") {
      setIsWaitlistModalOpen(true);
      // Clean up URL
      window.history.replaceState({}, "", "/");
    }
  }, [searchParams]);

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <AIPlatformsStrip />
      <AppPreviewSection />
      <TrustedByStrip />
      <ComparisonSection />
      <HowItWorksSection />
      <FeaturesSection />
      <UseCasesSection />
      <FAQSection />
      <CTASection />
      <FooterSection />

      {/* Waitlist modal triggered by URL param */}
      <WaitlistModal
        isOpen={isWaitlistModalOpen}
        onClose={() => setIsWaitlistModalOpen(false)}
        source="auth-redirect"
      />
    </main>
  );
}
