/**
 * Blog Generation Stage Configurations
 * Based on the actual Python blog-writer pipeline stages
 */

import { ProcessStage } from '@/components/shared/ProcessTracker'

export const BLOG_STAGE_CONFIGURATIONS: Record<string, ProcessStage> = {
  'data_fetch': {
    name: '📊 Data Fetch & Auto-Detection',
    duration: 2, // Very fast stage
    icon: '🔍',
    description: 'Fetching company context and sitemap data..',
    color: 'text-blue-600',
    substeps: ['Input validation', 'Company analysis', 'Sitemap crawling', 'Building context']
  },
  'prompt_construction': {
    name: '✏️ Prompt Construction',
    duration: 1, // Near instant
    icon: '📝',
    description: 'Building optimized AI prompt..',
    color: 'text-green-600',
    substeps: ['Language detection', 'Company integration', 'Keyword optimization', 'Prompt assembly']
  },
  'ai_content': {
    name: '🤖 AI Content Generation', 
    duration: 90, // Longest stage - Gemini 3.5 Pro + Google Search
    icon: '🧠',
    description: 'Gemini: Generating structured content with grounding..',
    color: 'text-purple-600',
    substeps: ['Google Search grounding', 'Content generation', 'JSON validation', 'Quality checks']
  },
  'extraction': {
    name: '🔧 Data Extraction',
    duration: 1,
    icon: '⚙️', 
    description: 'Extracting and validating structured data..',
    color: 'text-orange-600',
    substeps: ['JSON parsing', 'Data validation', 'Structure normalization', 'Content cleanup']
  },
  'quality_refinement': {
    name: '✨ Quality Refinement',
    duration: 240, // Can be very long due to multiple Gemini calls
    icon: '🔄',
    description: 'Gemini: Fixing quality issues..',
    color: 'text-red-600',
    substeps: ['Issue detection', 'Citation fixes', 'Keyword optimization', 'Content polishing']
  },
  'parallel_processing': {
    name: '⚡ Parallel Processing',
    duration: 40, // Citations, internal links, ToC, metadata, FAQ, images
    icon: '🏃‍♂️',
    description: 'Processing citations, images, and metadata..',
    color: 'text-indigo-600', 
    substeps: ['Citations validation', 'Image generation (Imagen 4.0)', 'Table of contents', 'Metadata calculation', 'FAQ processing', 'Internal links']
  },
  'cleanup': {
    name: '🧹 Cleanup & Validation',
    duration: 1,
    icon: '✅',
    description: 'Final validation and cleanup..',
    color: 'text-teal-600',
    substeps: ['Content merging', 'AI phrase removal', 'Citation sanitization', 'Quality scoring']
  },
  'storage': {
    name: '💾 Storage & Assembly',
    duration: 1,
    icon: '📦',
    description: 'Saving final article..',
    color: 'text-gray-600',
    substeps: ['JSON storage', 'HTML generation', 'File writing', 'Completion']
  }
}

// Total expected duration calculation
export const TOTAL_BLOG_DURATION = Object.values(BLOG_STAGE_CONFIGURATIONS)
  .reduce((total, stage) => total + stage.duration, 0) // ~380 seconds = ~6.3 minutes

export const BLOG_LOADING_MESSAGES = [
  '🔍 Analyzing your business context',
  '🧠 Generating AI-optimized content', 
  '🎯 Creating AEO-friendly structure',
  '📸 Generating professional images',
  '✨ Polishing and finalizing',
  '💾 Assembling final article',
]

// Stage mapping from backend log messages to our stage keys
export const BACKEND_STAGE_MAPPING: Record<string, string> = {
  'Stage 0: Data Fetch': 'data_fetch',
  'Stage 1: Simple Prompt Construction': 'prompt_construction', 
  'Stage 2: Gemini Content Generation': 'ai_content',
  'ExtractionStage': 'extraction',
  'Stage 2: Quality Refinement': 'quality_refinement',
  'Starting parallel execution': 'parallel_processing',
  'Stage 4': 'parallel_processing', // Citations
  'Stage 5': 'parallel_processing', // Internal links
  'Stage 6': 'parallel_processing', // ToC  
  'Stage 7': 'parallel_processing', // Metadata
  'Stage 8': 'parallel_processing', // FAQ
  'Stage 9': 'parallel_processing', // Images
  'Stage 10': 'cleanup',
  'Stage 11': 'storage',
  'StorageStage': 'storage'
}