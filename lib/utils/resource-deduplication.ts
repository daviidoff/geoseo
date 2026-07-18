/**
 * Resource Deduplication Utilities
 * Prevents creating duplicate resources from the same batch or multiple runs
 *
 * Note: In localStorage mode, deduplication is not functional (no database).
 * All resources are considered unique.
 */

import { logError } from '@/lib/utils/logger'

// Minimal type definitions (resources feature was removed)
type ResourceType = 'lead' | 'keyword' | 'content' | 'campaign'
type ResourceCreate = {
  type: ResourceType
  data: Record<string, unknown>
  source_type: string
  source_name: string
  batch_id: string
  agent_id: string
  tags: string[]
}

/**
 * Extract unique identifier from resource data based on type
 * Returns null if no unique identifier can be extracted
 */
export function extractUniqueIdentifier(
  resourceType: ResourceType,
  resourceData: Record<string, unknown>
): string | null {
  switch (resourceType) {
    case 'lead':
      // Use email as unique identifier for leads
      const email = resourceData.email as string | undefined
      return email ? email.toLowerCase().trim() : null

    case 'keyword':
      // Use keyword text as unique identifier
      const keyword = resourceData.keyword as string | undefined
      return keyword ? keyword.toLowerCase().trim() : null

    case 'content':
      // Use title as unique identifier (less strict, but reasonable)
      // Could also use content hash for stricter deduplication
      const title = resourceData.title as string | undefined
      return title ? title.toLowerCase().trim() : null

    case 'campaign':
      // Use name + type combination as unique identifier
      const name = resourceData.name as string | undefined
      const type = resourceData.type as string | undefined
      if (name && type) {
        return `${name.toLowerCase().trim()}:${type.toLowerCase().trim()}`
      }
      return name ? name.toLowerCase().trim() : null

    default:
      return null
  }
}

/**
 * Filter out duplicate resources before creation
 * Returns resources that don't already exist
 *
 * Note: In localStorage mode, returns all resources as unique (no database to check)
 */
export async function filterDuplicateResources(
  userId: string,
  resourcesToCreate: ResourceCreate[]
): Promise<{
  uniqueResources: ResourceCreate[]
  duplicates: Array<{ resource: ResourceCreate; existingId?: string }>
  stats: {
    total: number
    unique: number
    duplicates: number
  }
}> {
  // In localStorage mode, we can't check for duplicates (no database)
  // Return all resources as unique
  console.log('[DEDUP] Running in localStorage mode - no deduplication (returning all as unique)')

  const stats = {
    total: resourcesToCreate.length,
    unique: resourcesToCreate.length,
    duplicates: 0,
  }

  return {
    uniqueResources: resourcesToCreate,
    duplicates: [],
    stats,
  }
}
