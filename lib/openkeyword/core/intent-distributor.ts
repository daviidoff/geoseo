/**
 * ABOUTME: Intent distribution control for keyword generation
 * ABOUTME: Ensures desired % of question/commercial/transactional/etc keywords
 *
 * TypeScript port of openkeywords/intent_distributor.py
 */

export interface IntentDistribution {
  question?: number; // % of question keywords
  commercial?: number; // % of commercial intent
  transactional?: number; // % of transactional
  comparison?: number; // % of comparison
  informational?: number; // % of informational
}

export interface IntentDistributionResult {
  selected_keywords: any[];
  actual_distribution: Record<string, number>;
  target_distribution: IntentDistribution;
  distribution_quality: number; // 0-100 how well we matched target
}

/**
 * Intent distribution controller.
 *
 * Filters and balances keywords to match desired intent distribution.
 * Useful for creating balanced content strategies.
 */
export class IntentDistributor {
  /**
   * Distribute keywords according to target intent percentages
   */
  static distributeByIntent(
    keywords: any[],
    targetCount: number,
    targetDistribution: IntentDistribution
  ): IntentDistributionResult {
    // Normalize distribution to 100%
    const normalized = this.normalizeDistribution(targetDistribution);

    // Group keywords by intent
    const byIntent = new Map<string, any[]>();
    for (const kw of keywords) {
      const intent = kw.intent || "informational";
      if (!byIntent.has(intent)) {
        byIntent.set(intent, []);
      }
      byIntent.get(intent)!.push(kw);
    }

    // Calculate how many keywords needed per intent
    const selected: any[] = [];
    const intentCounts: Record<string, number> = {};

    for (const [intent, percentage] of Object.entries(normalized)) {
      const targetForIntent = Math.round((percentage / 100) * targetCount);
      const available = byIntent.get(intent) || [];

      // Take up to target amount (or all available if less)
      const toTake = Math.min(targetForIntent, available.length);
      const taken = available.slice(0, toTake);

      selected.push(...taken);
      intentCounts[intent] = taken.length;

      console.log(
        `Intent ${intent}: wanted ${targetForIntent}, got ${taken.length} (${available.length} available)`
      );
    }

    // If we don't have enough, fill with any remaining keywords
    if (selected.length < targetCount) {
      const usedKeywords = new Set(selected.map((k) => k.keyword));
      const remaining = keywords.filter((k) => !usedKeywords.has(k.keyword));
      const needed = targetCount - selected.length;
      selected.push(...remaining.slice(0, needed));

      console.log(
        `Added ${Math.min(needed, remaining.length)} filler keywords to reach target`
      );
    }

    // Calculate actual distribution
    const actualDistribution = this.calculateActualDistribution(
      selected.slice(0, targetCount)
    );

    // Calculate quality score (how well we matched target)
    const qualityScore = this.calculateDistributionQuality(
      normalized,
      actualDistribution
    );

    return {
      selected_keywords: selected.slice(0, targetCount),
      actual_distribution: actualDistribution,
      target_distribution: normalized,
      distribution_quality: qualityScore,
    };
  }

  /**
   * Normalize distribution percentages to sum to 100%
   */
  private static normalizeDistribution(
    dist: IntentDistribution
  ): IntentDistribution {
    const sum = Object.values(dist).reduce((a, b) => a + (b || 0), 0);

    if (sum === 0) {
      // Default distribution if none provided
      return {
        question: 30,
        commercial: 25,
        informational: 25,
        comparison: 10,
        transactional: 10,
      };
    }

    if (Math.abs(sum - 100) < 0.01) {
      return dist; // Already normalized
    }

    // Scale to 100%
    const normalized: IntentDistribution = {};
    for (const [intent, value] of Object.entries(dist)) {
      if (value !== undefined) {
        normalized[intent as keyof IntentDistribution] = (value / sum) * 100;
      }
    }

    return normalized;
  }

  /**
   * Calculate actual distribution from selected keywords
   */
  private static calculateActualDistribution(
    keywords: any[]
  ): Record<string, number> {
    const counts: Record<string, number> = {};
    const total = keywords.length;

    for (const kw of keywords) {
      const intent = kw.intent || "informational";
      counts[intent] = (counts[intent] || 0) + 1;
    }

    // Convert to percentages
    const percentages: Record<string, number> = {};
    for (const [intent, count] of Object.entries(counts)) {
      percentages[intent] = (count / total) * 100;
    }

    return percentages;
  }

  /**
   * Calculate how well actual matches target (0-100)
   */
  private static calculateDistributionQuality(
    target: IntentDistribution,
    actual: Record<string, number>
  ): number {
    let totalError = 0;
    let intentCount = 0;

    for (const [intent, targetPercent] of Object.entries(target)) {
      if (targetPercent === undefined) continue;

      const actualPercent = actual[intent] || 0;
      const error = Math.abs(targetPercent - actualPercent);
      totalError += error;
      intentCount++;
    }

    if (intentCount === 0) return 100;

    const avgError = totalError / intentCount;
    const quality = Math.max(0, 100 - avgError);

    return Math.round(quality);
  }

  /**
   * Get recommended distribution based on use case
   */
  static getRecommendedDistribution(useCase: string): IntentDistribution {
    const distributions: Record<string, IntentDistribution> = {
      blog: {
        informational: 50,
        question: 30,
        comparison: 10,
        commercial: 10,
      },
      ecommerce: {
        commercial: 40,
        transactional: 30,
        comparison: 20,
        informational: 10,
      },
      saas: {
        commercial: 30,
        comparison: 25,
        question: 25,
        informational: 15,
        transactional: 5,
      },
      education: {
        question: 40,
        informational: 40,
        comparison: 10,
        commercial: 10,
      },
      news: {
        informational: 70,
        question: 20,
        comparison: 10,
      },
      balanced: {
        question: 30,
        commercial: 25,
        informational: 25,
        comparison: 10,
        transactional: 10,
      },
    };

    return distributions[useCase.toLowerCase()] || distributions.balanced;
  }
}
