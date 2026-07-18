// ABOUTME: Competitor comparison section - shows pricing vs alternatives
// ABOUTME: Emphasizes "unlimited for $99" vs credit-based competitors

import { Check, X } from "lucide-react";
import Image from "next/image";

const competitors = [
  {
    name: "SurferSEO",
    logo: "https://logo.clearbit.com/surferseo.com",
    priceFor30Articles: "$200+",
    model: "Credits",
    unlimited: false,
    aeoNative: false,
  },
  {
    name: "Frase",
    logo: "https://logo.clearbit.com/frase.io",
    priceFor30Articles: "$150+",
    model: "Credits",
    unlimited: false,
    aeoNative: false,
  },
  {
    name: "Clearscope",
    logo: "https://logo.clearbit.com/clearscope.io",
    priceFor30Articles: "$350+",
    model: "Credits",
    unlimited: false,
    aeoNative: false,
  },
  {
    name: "HyperNiche",
    logo: "/logo.svg",
    priceFor30Articles: "$99",
    model: "Flat",
    unlimited: true,
    aeoNative: true,
    highlight: true,
  },
];

export function ComparisonSection() {
  return (
    <section className="py-16 md:py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center mb-12">
          <h2 className="mb-4 text-2xl font-bold md:text-3xl">
            Simple pricing. Powerful results.
          </h2>
          <p className="text-lg text-muted-foreground">
            Enterprise-grade AEO without enterprise complexity or pricing.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="mx-auto max-w-4xl overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">
                  Tool
                </th>
                <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground">
                  30 articles/mo
                </th>
                <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground">
                  Pricing Model
                </th>
                <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground">
                  Unlimited
                </th>
                <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground">
                  AEO-Native
                </th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((competitor) => (
                <tr
                  key={competitor.name}
                  className={`border-b border-border transition-colors ${
                    competitor.highlight
                      ? "bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <Image
                        src={competitor.logo}
                        alt={`${competitor.name} logo`}
                        width={24}
                        height={24}
                        className="rounded"
                        unoptimized={competitor.logo.startsWith("http")}
                      />
                      <span
                        className={`font-medium ${
                          competitor.highlight ? "text-foreground font-bold" : "text-foreground"
                        }`}
                      >
                        {competitor.name}
                        {competitor.highlight && (
                          <span className="ml-2 text-xs bg-gradient-to-r from-blue-500 to-purple-500 text-white px-2 py-0.5 rounded-full">
                            YOU
                          </span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span
                      className={`font-mono ${
                        competitor.highlight
                          ? "text-green-500 font-bold text-lg"
                          : "text-muted-foreground"
                      }`}
                    >
                      {competitor.priceFor30Articles}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span
                      className={`text-sm px-2 py-1 rounded ${
                        competitor.model === "Flat"
                          ? "bg-green-500/20 text-green-600"
                          : "bg-orange-500/20 text-orange-600"
                      }`}
                    >
                      {competitor.model}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    {competitor.unlimited ? (
                      <Check className="w-5 h-5 text-green-500 mx-auto" />
                    ) : (
                      <X className="w-5 h-5 text-red-400 mx-auto" />
                    )}
                  </td>
                  <td className="py-4 px-4 text-center">
                    {competitor.aeoNative ? (
                      <Check className="w-5 h-5 text-green-500 mx-auto" />
                    ) : (
                      <X className="w-5 h-5 text-red-400 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom message */}
        <div className="mx-auto max-w-2xl text-center mt-8">
          <p className="text-sm text-muted-foreground">
            Generate as much content as you need.{" "}
            <span className="text-foreground font-medium">One simple price.</span>
          </p>
        </div>
      </div>
    </section>
  );
}
