// ABOUTME: CTA section - final push to get users to sign up
// ABOUTME: Prominent call to action before footer (supports waitlist mode)

"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import Image from "next/image";
import { WaitlistCTA } from "@/components/waitlist/WaitlistCTA";

export function CTASection() {
  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl rounded-lg bg-gradient-to-br from-purple-500/10 via-indigo-500/10 to-blue-500/10 border border-purple-500/20 p-10 text-center">
          <div className="mb-4 flex justify-center">
            <Image
              src="/logo.svg"
              alt="HyperNiche AI"
              width={48}
              height={48}
            />
          </div>
          <h2 className="mb-4 text-2xl font-bold md:text-3xl">
            Ready to rank in AI search?
          </h2>
          <p className="mb-6 text-muted-foreground">
            Set up in 5 minutes. Start free. See results immediately.
          </p>
          <WaitlistCTA
            href="/auth"
            size="lg"
            className="group bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
            source="footer-cta"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Get Started Free
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </WaitlistCTA>
        </div>
      </div>
    </section>
  );
}

