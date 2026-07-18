#!/usr/bin/env node
/**
 * ABOUTME: OpenKeyword CLI tool matching Python version functionality
 * ABOUTME: Command-line interface for keyword generation with all features
 *
 * TypeScript port of openkeywords CLI
 */

import { ResearchEngine } from "./core/researcher";
import { GeminiSerpAnalyzer } from "./analyzers/gemini-serp-analyzer";
import { SemanticDeduplicator } from "./core/deduplicator";
import { CompanyFitScorer } from "./core/scorer";
import { SemanticClusterer } from "./core/clusterer";
import { SERankingClient } from "./clients/seranking-client";
import { IntentDistributor } from "./core/intent-distributor";
import { KeywordExporter } from "./utils/exporter";
import { ConfigValidator } from "./utils/config-validator";

interface CLIOptions {
  companyName: string;
  companyUrl?: string;
  industry: string;
  products?: string[];
  services?: string[];
  targetAudience?: string;
  valuePropositions?: string[];
  competitors?: string[];
  numKeywords?: number;
  language?: string;
  country?: string;
  outputFormat?: "json" | "csv";
  outputPath?: string;
  enableClustering?: boolean;
  enableScoring?: boolean;
  enableGapAnalysis?: boolean;
  intentDistribution?: string; // e.g., "blog", "saas", "ecommerce"
  model?: string;
}

class OpenKeywordCLI {
  /**
   * Main generate command
   */
  static async generate(options: CLIOptions): Promise<void> {
    console.log("\n🚀 OpenKeyword - AI-Powered Keyword Research\n");

    // Validate config
    if (!ConfigValidator.quickCheck()) {
      console.error("❌ GEMINI_API_KEY not set!");
      console.error("Set it in .env.local or export GEMINI_API_KEY=your_key");
      process.exit(1);
    }

    const apiKey = process.env.GEMINI_API_KEY!;

    const {
      companyName,
      companyUrl,
      industry,
      products = [],
      services = [],
      targetAudience,
      valuePropositions = [],
      competitors = [],
      numKeywords = 30,
      language = "English",
      country = "United States",
      outputFormat = "json",
      outputPath,
      enableClustering = true,
      enableScoring = true,
      enableGapAnalysis = false,
      intentDistribution,
      model,
    } = options;

    console.log(`Company: ${companyName}`);
    console.log(`Industry: ${industry}`);
    console.log(`Target: ${numKeywords} keywords`);
    console.log(`Language: ${language}, Country: ${country}\n`);

    const startTime = Date.now();

    try {
      // Initialize engines
      const researcher = new ResearchEngine({ apiKey, model });
      const serpAnalyzer = new GeminiSerpAnalyzer({ geminiApiKey: apiKey, model });
      const deduplicator = new SemanticDeduplicator({ apiKey, model });
      const scorer = enableScoring
        ? new CompanyFitScorer({ apiKey, model })
        : null;
      const clusterer = enableClustering
        ? new SemanticClusterer({ apiKey, model })
        : null;
      const seRanking = enableGapAnalysis
        ? new SERankingClient()
        : null;

      // Phase 1: Research
      console.log("📚 Phase 1: Deep Research...");
      const researchStart = Date.now();
      const researchKeywords = await researcher.discoverKeywords({
        companyName,
        industry,
        products,
        services,
        language,
        targetCount: Math.min(20, Math.max(10, Math.floor(numKeywords * 0.4))),
      });
      const researchDuration = (Date.now() - researchStart) / 1000;
      console.log(
        `   ✅ Found ${researchKeywords.length} keywords (${researchDuration.toFixed(1)}s)\n`
      );

      // Phase 2: SERP Analysis
      console.log("🔍 Phase 2: SERP Analysis...");
      const serpStart = Date.now();
      const [serpAnalysesDict, bonusKeywords] =
        await serpAnalyzer.analyzeKeywords(
          researchKeywords.slice(0, 20).map((k) => k.keyword),
          true
        );
      const serpDuration = (Date.now() - serpStart) / 1000;
      console.log(
        `   ✅ Analyzed ${Object.keys(serpAnalysesDict).length} keywords, found ${bonusKeywords.length} bonus (${serpDuration.toFixed(1)}s)\n`
      );

      // Phase 3: Deduplication
      console.log("🔄 Phase 3: Semantic Deduplication...");
      const dedupStart = Date.now();
      const allRawKeywords = [
        ...researchKeywords.map((k) => k.keyword),
        ...bonusKeywords,
      ];
      const dedupResult = await deduplicator.deduplicateKeywords(allRawKeywords);
      const dedupDuration = (Date.now() - dedupStart) / 1000;
      console.log(
        `   ✅ ${dedupResult.final_count} unique (${dedupResult.dedup_rate.toFixed(1)}% removed, ${dedupDuration.toFixed(1)}s)\n`
      );

      // Merge with SERP data
      const dedupSet = new Set(dedupResult.unique_keywords);
      let enrichedKeywords = researchKeywords
        .filter((kw) => dedupSet.has(kw.keyword))
        .map((kw) => {
          const serpData = serpAnalysesDict[kw.keyword];
          if (serpData) {
            return {
              ...kw,
              aeo_opportunity: serpData.features.aeo_opportunity,
              has_featured_snippet: serpData.features.has_featured_snippet,
              has_paa: serpData.features.has_paa,
              serp_analyzed: true,
            };
          }
          return kw;
        });

      // Apply intent distribution if specified
      if (intentDistribution) {
        console.log(`🎯 Applying ${intentDistribution} intent distribution...`);
        const targetDist =
          IntentDistributor.getRecommendedDistribution(intentDistribution);
        const distResult = IntentDistributor.distributeByIntent(
          enrichedKeywords,
          numKeywords,
          targetDist
        );
        enrichedKeywords = distResult.selected_keywords;
        console.log(
          `   ✅ Distribution quality: ${distResult.distribution_quality}/100\n`
        );
      }

      // Limit to target count
      const limitedKeywords = enrichedKeywords.slice(0, numKeywords);

      // Phase 4: Company-Fit Scoring (optional)
      let scoredKeywords = limitedKeywords;
      if (scorer) {
        console.log("💯 Phase 4: Company-Fit Scoring...");
        const scoringStart = Date.now();
        const scoringContext = {
          companyName,
          industry,
          products,
          services,
          targetAudience,
          valuePropositions,
          competitors,
        };
        const scores = await scorer.scoreKeywords(
          limitedKeywords.map((k) => k.keyword),
          scoringContext
        );
        const scoringDuration = (Date.now() - scoringStart) / 1000;

        const scoringMap = new Map(scores.map((s) => [s.keyword, s]));
        scoredKeywords = limitedKeywords.map((kw) => ({
          ...kw,
          company_fit_score: scoringMap.get(kw.keyword)?.company_fit_score || 50,
          recommended_priority:
            scoringMap.get(kw.keyword)?.recommended_priority || "medium",
        }));

        const avgScore =
          scores.reduce((sum, k) => sum + k.company_fit_score, 0) / scores.length;
        console.log(
          `   ✅ Avg company fit: ${avgScore.toFixed(1)}/100 (${scoringDuration.toFixed(1)}s)\n`
        );
      }

      // Phase 5: Semantic Clustering (optional)
      let clusteringResult = null;
      if (clusterer) {
        console.log("📊 Phase 5: Semantic Clustering...");
        const clusteringStart = Date.now();
        clusteringResult = await clusterer.clusterKeywords(
          scoredKeywords.map((k) => k.keyword),
          {
            name: companyName,
            industry,
            products,
            services,
          }
        );
        const clusteringDuration = (Date.now() - clusteringStart) / 1000;
        console.log(
          `   ✅ ${clusteringResult.total_clusters} clusters (quality: ${clusteringResult.clustering_quality_score}/100, ${clusteringDuration.toFixed(1)}s)\n`
        );
      }

      // Phase 6: Gap Analysis (optional)
      let gapAnalysis = null;
      if (seRanking && seRanking.isConfigured() && companyUrl && competitors.length > 0) {
        console.log("🔬 Phase 6: Competitor Gap Analysis...");
        const gapStart = Date.now();
        gapAnalysis = await seRanking.analyzeKeywordGap(
          companyUrl,
          competitors,
          country.toLowerCase().substring(0, 2),
          50
        );
        const gapDuration = (Date.now() - gapStart) / 1000;
        console.log(
          `   ✅ ${gapAnalysis.total_gap_opportunities} gap opportunities (${gapDuration.toFixed(1)}s)\n`
        );
      }

      const totalTime = (Date.now() - startTime) / 1000;

      // Prepare output
      const output = {
        keywords: scoredKeywords,
        clusters: clusteringResult?.clusters || [],
        deduplication: dedupResult,
        gap_analysis: gapAnalysis,
        statistics: {
          avg_company_fit_score: scorer
            ? (scoredKeywords.reduce((sum, k) => sum + ((k as any).company_fit_score || 0), 0) /
                scoredKeywords.length).toFixed(1)
            : null,
          clustering_quality_score: clusteringResult?.clustering_quality_score,
          total_clusters: clusteringResult?.total_clusters,
        },
        metadata: {
          company_name: companyName,
          company_url: companyUrl,
          total_keywords: scoredKeywords.length,
          generation_time: totalTime,
          language,
          country,
          model: model || "gemini-3-flash-preview",
        },
      };

      // Export
      console.log(`💾 Exporting to ${outputFormat.toUpperCase()}...`);
      const exportResult = await KeywordExporter.export(output, {
        format: outputFormat,
        outputPath,
        includeMetadata: true,
        includeClusters: true,
        includeDeduplication: true,
      });

      if (exportResult.success) {
        console.log(`   ✅ Exported to ${exportResult.filePath}\n`);
      } else {
        console.error(`   ❌ Export failed: ${exportResult.error}\n`);
      }

      console.log("✨ Generation complete!");
      console.log(`   Total time: ${totalTime.toFixed(1)}s`);
      console.log(`   Keywords: ${scoredKeywords.length}`);
      if (clusteringResult) {
        console.log(`   Clusters: ${clusteringResult.total_clusters}`);
      }
      console.log();
    } catch (error) {
      console.error("\n❌ Error:", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * Config check command
   */
  static async check(): Promise<void> {
    console.log("\n🔍 Checking OpenKeyword configuration...\n");

    const result = await ConfigValidator.validate();
    ConfigValidator.printResults(result);

    process.exit(result.valid ? 0 : 1);
  }
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "check") {
    OpenKeywordCLI.check();
  } else if (command === "generate") {
    // Parse arguments (simplified - in production use commander or yargs)
    const options: CLIOptions = {
      companyName: args[args.indexOf("--company") + 1] || "Unknown",
      industry: args[args.indexOf("--industry") + 1] || "Technology",
      numKeywords: parseInt(args[args.indexOf("--num-keywords") + 1] || "30"),
      outputFormat: (args[args.indexOf("--format") + 1] || "json") as "json" | "csv",
    };

    OpenKeywordCLI.generate(options);
  } else {
    console.log("OpenKeyword CLI");
    console.log("\nUsage:");
    console.log("  openkeyword check                   Check configuration");
    console.log("  openkeyword generate [options]      Generate keywords");
    console.log("\nOptions:");
    console.log("  --company <name>         Company name (required)");
    console.log("  --industry <name>        Industry (required)");
    console.log("  --num-keywords <n>       Number of keywords (default: 30)");
    console.log("  --format <json|csv>      Output format (default: json)");
    console.log("  --output <path>          Output file path");
  }
}

export { OpenKeywordCLI };
