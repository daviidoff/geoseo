/**
 * Utility: Transform batch results into resources
 * Creates resources from batch_results based on agent type
 *
 * Note: In localStorage mode, this is a no-op (no database to store resources)
 */

import { logError } from '@/lib/utils/logger'

// Minimal type definition for resource creation (resources feature was removed)
type ResourceCreate = {
  type: 'lead' | 'keyword' | 'content' | 'campaign'
  data: Record<string, unknown>
  source_type: string
  source_name: string
  batch_id: string
  agent_id: string
  tags: string[]
}

/**
 * Map agent_id to resource type
 */
function getResourceTypeFromAgent(agentId: string | null): 'lead' | 'keyword' | 'content' | 'campaign' | null {
  if (!agentId) return null

  // Map agent IDs to resource types
  // Note: Agent IDs must match agent_definitions.id values exactly (from migration seed)
  const agentTypeMap: Record<string, 'lead' | 'keyword' | 'content' | 'campaign'> = {
    'bulk': 'content', // Bulk Agent
    'lead_crawler': 'lead', // Lead Crawler
    'lead_enricher': 'lead', // Lead Enricher
    'seo_content_writer': 'content', // SEO Content Writer
    'outbound_copywriter': 'content', // Outbound Copywriter
    'campaign_setup': 'campaign', // Campaign Setup
    // Analytics agents don't create resources:
    // 'seo_analytics', 'campaign_analytics', 'market_analytics'
  }

  return agentTypeMap[agentId] || null
}

/**
 * Transform batch result to resource data based on agent type
 */
function transformResultToResourceData(
  agentId: string | null,
  inputData: string,
  outputData: string
): Record<string, unknown> | null {
  if (!agentId) return null

  try {
    const input = inputData ? JSON.parse(inputData) : {}
    const output = outputData ? (outputData.startsWith('{') ? JSON.parse(outputData) : outputData) : {}

    switch (agentId) {
      case 'bulk':
        // Bulk agent creates content from CSV processing
        return {
          title: output.title || output.name || 'Generated Content',
          content: typeof output === 'string' ? output : output.content || output.output || JSON.stringify(output),
          content_type: 'generated',
          word_count: typeof output === 'string' ? output.split(/\s+/).length : 0,
          ...output,
        }

      case 'lead_crawler':
      case 'lead_enricher':
        // Lead crawler/enricher creates lead resources
        return {
          email: output.email || input.email,
          name: output.name || input.name,
          company: output.company || input.company,
          title: output.title || input.title,
          linkedin_url: output.linkedin_url || output.linkedIn,
          phone: output.phone,
          website: output.website,
          ...output,
        }

      case 'seo_content_writer':
        // SEO content writer creates content
        return {
          title: output.title || 'SEO Content',
          content: output.content || output.text || JSON.stringify(output),
          content_type: 'seo',
          seo_score: output.seo_score,
          keyword_density: output.keyword_density,
          word_count: output.word_count || (output.content ? output.content.split(/\s+/).length : 0),
          ...output,
        }

      case 'outbound_copywriter':
        // Outbound copywriter creates content (emails)
        return {
          title: output.title || output.subject || 'Outbound Email',
          content: output.content || output.body || output.text || JSON.stringify(output),
          content_type: 'email',
          word_count: output.word_count || (output.content ? output.content.split(/\s+/).length : 0),
          ...output,
        }

      case 'campaign_setup':
        // Campaign setup creates campaigns
        return {
          name: output.name || output.campaign_name || 'Campaign',
          status: output.status || 'draft',
          type: output.type || output.campaign_type || 'email',
          target_lead_ids: output.target_lead_ids || [],
          content_ids: output.content_ids || [],
          metrics: output.metrics || {},
          ...output,
        }

      default:
        // Default: try to extract common fields
        return {
          ...output,
          ...input,
        }
    }
  } catch (error) {
    console.error('Error transforming result to resource data:', error)
    return {
      raw_output: outputData,
      raw_input: inputData,
    }
  }
}

/**
 * Create resources from batch results
 * Called after batch completion
 *
 * Note: In localStorage mode, this is a no-op (no database to store resources)
 */
export async function createResourcesFromBatch(batchId: string): Promise<void> {
  console.log(`[RESOURCES] Running in localStorage mode - skipping resource creation for batch ${batchId}`)
  // In localStorage mode, we don't have a database to store resources
  // This function is a no-op
  return
}
