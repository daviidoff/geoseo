// ABOUTME: Differentiation section - Why GeoSEO vs alternatives
// ABOUTME: Addresses "why not just use ChatGPT/SEO tools?"

const comparisons = [
  {
    alternative: "Generic SEO Tools",
    problem: "Focus on broad keywords everyone targets",
    solution: "GeoSEO finds ultra-specific keywords from real user discussions (Reddit, Quora, forums)",
    icon: "🎯",
  },
  {
    alternative: "ChatGPT Directly",
    problem: "Generic content, no AEO optimization, no keyword research",
    solution: "10-stage pipeline creates AEO-optimized content with 70-85+ scores, structured data, and citation optimization",
    icon: "✨",
  },
  {
    alternative: "Hiring Copywriters",
    problem: "Expensive, slow, and often lack AEO expertise",
    solution: "Generate 50 targeted keywords and blogs in minutes, not weeks. Built specifically for AI search engines.",
    icon: "⚡",
  },
];

export function DifferentiationSection() {
  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center mb-12">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            Why GeoSEO?
          </h2>
          <p className="text-lg text-muted-foreground">
            Built specifically for focused positioning and AEO, not generic SEO
          </p>
        </div>

        <div className="mx-auto max-w-5xl space-y-6">
          {comparisons.map((comparison, index) => (
            <div
              key={index}
              className="rounded-lg border border-border bg-card p-6 md:p-8"
            >
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-shrink-0">
                  <div className="text-4xl">{comparison.icon}</div>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">
                    vs {comparison.alternative}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <span className="text-red-500 mt-1">✗</span>
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">Problem:</span>{" "}
                        {comparison.problem}
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-500 mt-1">✓</span>
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">Our solution:</span>{" "}
                        {comparison.solution}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
