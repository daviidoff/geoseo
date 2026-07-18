/**
 * Stage 7: Content Similarity Check
 *
 * TypeScript port of Python stage_07_similarity_check.py
 *
 * Detects content cannibalization by comparing generated article
 * against previously generated articles using character shingles.
 *
 * Features:
 * - Character-level shingling for language-agnostic similarity
 * - Batch session memory (in-memory storage for current session)
 * - Non-blocking: logs warnings but doesn't block publication
 * - Runs in parallel with Stage 6 (Image) to save time
 *
 * Note: This is a simplified version focused on character shingles.
 * The Python version also supports semantic embeddings via Gemini,
 * but that's optional and not critical for MVP.
 *
 * Input:
 *   - ExecutionContext.structured_data (article content)
 *
 * Output:
 *   - ExecutionContext.similarity_report (similarity analysis)
 */

import type { ExecutionContext } from '../core/execution-context'

const logger = console

// Similarity thresholds (matching Python defaults)
const CHAR_SIMILARITY_THRESHOLD = 0.65 // 65% character similarity = too similar
const SHINGLE_SIZE = 5 // 5-character shingles

interface SimilarityReport {
  job_id: string
  similarity_score: number
  is_too_similar: boolean
  similar_articles: Array<{
    job_id: string
    similarity: number
  }>
  check_method: 'character_shingles' | 'hybrid'
  timestamp: string
}

/**
 * In-memory storage for batch similarity checking.
 * Stores article content from current generation session.
 */
class BatchSimilarityMemory {
  private articles: Map<string, string> = new Map()

  add(jobId: string, content: string): void {
    this.articles.set(jobId, content)
  }

  getAll(): Map<string, string> {
    return this.articles
  }

  clear(): void {
    this.articles.clear()
  }

  size(): number {
    return this.articles.size
  }
}

// Global batch memory (shared across all similarity checks in current session)
const batchMemory = new BatchSimilarityMemory()

/**
 * Generate character shingles from text.
 *
 * Shingles are overlapping n-character substrings used for
 * fuzzy text comparison.
 *
 * Example: "hello" with size=3 → ["hel", "ell", "llo"]
 */
function generateShingles(text: string, size: number): Set<string> {
  const shingles = new Set<string>()
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim()

  for (let i = 0; i <= normalized.length - size; i++) {
    shingles.add(normalized.substring(i, i + size))
  }

  return shingles
}

/**
 * Calculate Jaccard similarity between two sets.
 *
 * Jaccard similarity = (intersection / union)
 * Returns value between 0 (no overlap) and 1 (identical)
 */
function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 && set2.size === 0) return 1.0
  if (set1.size === 0 || set2.size === 0) return 0.0

  const intersection = new Set([...set1].filter(x => set2.has(x)))
  const union = new Set([...set1, ...set2])

  return intersection.size / union.size
}

/**
 * Extract article content for similarity comparison.
 *
 * Combines all text fields into single string for analysis.
 */
function extractArticleText(articleData: any): string {
  const parts: string[] = []

  // Add main content fields
  if (articleData.headline) parts.push(articleData.headline)
  if (articleData.intro) parts.push(articleData.intro)
  if (articleData.direct_answer) parts.push(articleData.direct_answer)

  // Add all sections
  for (let i = 1; i <= 9; i++) {
    const titleKey = `section_${String(i).padStart(2, '0')}_title`
    const contentKey = `section_${String(i).padStart(2, '0')}_content`

    if (articleData[titleKey]) parts.push(articleData[titleKey])
    if (articleData[contentKey]) parts.push(articleData[contentKey])
  }

  // Add FAQ
  for (let i = 1; i <= 6; i++) {
    const qKey = `faq_${String(i).padStart(2, '0')}_question`
    const aKey = `faq_${String(i).padStart(2, '0')}_answer`

    if (articleData[qKey]) parts.push(articleData[qKey])
    if (articleData[aKey]) parts.push(articleData[aKey])
  }

  // Add PAA
  for (let i = 1; i <= 4; i++) {
    const qKey = `paa_${String(i).padStart(2, '0')}_question`
    const aKey = `paa_${String(i).padStart(2, '0')}_answer`

    if (articleData[qKey]) parts.push(articleData[qKey])
    if (articleData[aKey]) parts.push(articleData[aKey])
  }

  return parts.join(' ')
}

/**
 * Check similarity against all articles in batch memory.
 */
function checkSimilarity(jobId: string, articleText: string): SimilarityReport {
  const currentShingles = generateShingles(articleText, SHINGLE_SIZE)
  const similarArticles: Array<{ job_id: string; similarity: number }> = []
  let maxSimilarity = 0

  // Compare against all articles in batch memory
  for (const [otherJobId, otherText] of batchMemory.getAll()) {
    if (otherJobId === jobId) continue // Skip self

    const otherShingles = generateShingles(otherText, SHINGLE_SIZE)
    const similarity = jaccardSimilarity(currentShingles, otherShingles)

    if (similarity > 0.1) {
      // Only track if > 10% similar
      similarArticles.push({
        job_id: otherJobId,
        similarity: Math.round(similarity * 100) / 100,
      })
    }

    maxSimilarity = Math.max(maxSimilarity, similarity)
  }

  // Sort by similarity (descending)
  similarArticles.sort((a, b) => b.similarity - a.similarity)

  const isTooSimilar = maxSimilarity >= CHAR_SIMILARITY_THRESHOLD

  return {
    job_id: jobId,
    similarity_score: Math.round(maxSimilarity * 100) / 100,
    is_too_similar: isTooSimilar,
    similar_articles: similarArticles.slice(0, 5), // Top 5 most similar
    check_method: 'character_shingles',
    timestamp: new Date().toISOString(),
  }
}

/**
 * Stage 7: Content Similarity Check
 *
 * Non-blocking similarity detection.
 * Logs warnings if content is too similar to previous articles.
 */
export class SimilarityCheckStage {
  async execute(context: ExecutionContext): Promise<ExecutionContext> {
    logger.log('[Stage7] Starting Content Similarity Check')

    // Validate input
    if (!context.structured_data) {
      logger.log('[Stage7] No structured_data available, skipping similarity check')
      return context
    }

    try {
      // Extract article text
      const articleText = extractArticleText(context.structured_data)

      if (!articleText || articleText.length < 100) {
        logger.log('[Stage7] Article text too short for similarity check, skipping')
        return context
      }

      // Check similarity
      const report = checkSimilarity(context.job_id, articleText)

      // Store in batch memory for future comparisons
      batchMemory.add(context.job_id, articleText)

      // Log results
      logger.log(`[Stage7] Similarity check complete:`)
      logger.log(`[Stage7]   - Method: ${report.check_method}`)
      logger.log(`[Stage7]   - Max similarity: ${(report.similarity_score * 100).toFixed(1)}%`)
      logger.log(`[Stage7]   - Compared against: ${batchMemory.size() - 1} articles`)

      if (report.is_too_similar) {
        logger.log(
          `[Stage7] ⚠️  WARNING: Content similarity (${(report.similarity_score * 100).toFixed(1)}%) ` +
            `exceeds threshold (${(CHAR_SIMILARITY_THRESHOLD * 100).toFixed(1)}%)`
        )
        logger.log('[Stage7]   Similar articles:')
        report.similar_articles.forEach(({ job_id, similarity }) => {
          logger.log(`[Stage7]     - ${job_id}: ${(similarity * 100).toFixed(1)}%`)
        })
      } else {
        logger.log('[Stage7] ✅ Content is unique (similarity below threshold)')
      }

      // Store report in context
      context.similarity_report = report

      logger.log('[Stage7] ✅ Similarity check stage completed')
    } catch (error) {
      // Non-blocking: log error but don't fail the pipeline
      logger.error('[Stage7] ❌ Similarity check failed:', error)
      logger.log('[Stage7] Continuing pipeline (non-blocking stage)')
    }

    return context
  }
}

/**
 * Clear batch memory (useful for testing or starting new batch session)
 */
export function clearBatchMemory(): void {
  batchMemory.clear()
  logger.log('[Stage7] Batch memory cleared')
}

/**
 * Get batch memory stats
 */
export function getBatchMemoryStats(): { size: number; job_ids: string[] } {
  return {
    size: batchMemory.size(),
    job_ids: Array.from(batchMemory.getAll().keys()),
  }
}
