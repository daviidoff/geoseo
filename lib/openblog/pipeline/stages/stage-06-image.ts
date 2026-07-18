// ABOUTME: Stage 6 - Image metadata and placeholders
// ABOUTME: Simplified version - generates image metadata, skips actual image generation

import { ExecutionContext } from '../core/execution-context'

interface ImageMetadata {
  section: string
  alt_text: string
  caption: string
  prompt?: string
  placeholder_url?: string
}

export class ImageStage {
  async execute(context: ExecutionContext): Promise<ExecutionContext> {
    console.log('[Stage6] Starting Image stage...')

    try {
      const article = context.structured_data

      if (!article) {
        console.log('[Stage6] No article data found, skipping')
        context.parallel_results.images = []
        return context
      }

      // Generate image metadata for main sections
      const images: ImageMetadata[] = []

      // Header image
      if (article.meta_title) {
        images.push({
          section: 'header',
          alt_text: `${article.meta_title} - Hero Image`,
          caption: article.subtitle || '',
          prompt: this.generateImagePrompt('header', article.meta_title, article.Intro),
          placeholder_url: this.getPlaceholderUrl('header', 1200, 630),
        })
      }

      // Section images (for sections with headings)
      const sectionFields = [
        { heading: article.section_01_heading, content: article.section_01_content, index: 1 },
        { heading: article.section_02_heading, content: article.section_02_content, index: 2 },
        { heading: article.section_03_heading, content: article.section_03_content, index: 3 },
        { heading: article.section_04_heading, content: article.section_04_content, index: 4 },
        { heading: article.section_05_heading, content: article.section_05_content, index: 5 },
      ]

      for (const section of sectionFields) {
        if (section.heading && section.content) {
          images.push({
            section: `section_${section.index}`,
            alt_text: `${section.heading} - Illustration`,
            caption: this.generateCaption(section.heading, section.content),
            prompt: this.generateImagePrompt('section', section.heading, section.content),
            placeholder_url: this.getPlaceholderUrl(`section-${section.index}`, 800, 450),
          })
        }
      }

      // Store in context
      context.parallel_results.images = images
      console.log(`[Stage6] Generated metadata for ${images.length} images`)

      console.log('[Stage6] Image stage completed successfully')
      return context
    } catch (error) {
      console.error('[Stage6] Error in Image stage:', error)
      context.parallel_results.images = []
      return context
    }
  }

  /**
   * Generate AI image prompt based on section content
   */
  private generateImagePrompt(type: 'header' | 'section', heading: string, content: string): string {
    // Extract key concepts from content (first 200 chars)
    const snippet = content.substring(0, 200).replace(/<[^>]+>/g, '').trim()

    if (type === 'header') {
      return `Professional hero image for article about "${heading}". Modern, clean, tech-focused. High quality, 16:9 aspect ratio. ${snippet}`
    } else {
      return `Illustrative image for section "${heading}". Professional, informative, visually appealing. Relates to: ${snippet}`
    }
  }

  /**
   * Generate caption from heading and content
   */
  private generateCaption(heading: string, content: string): string {
    // Extract first sentence from content
    const textContent = content.replace(/<[^>]+>/g, '').trim()
    const firstSentence = textContent.split(/[.!?]/)[0]

    if (firstSentence.length > 100) {
      return firstSentence.substring(0, 97) + '...'
    }

    return firstSentence
  }

  /**
   * Get placeholder image URL (for MVP - using placeholder service)
   */
  private getPlaceholderUrl(section: string, width: number, height: number): string {
    // Use a placeholder service (can be replaced with actual image generation later)
    const text = encodeURIComponent(section)
    return `https://via.placeholder.com/${width}x${height}/3B82F6/FFFFFF?text=${text}`
  }
}
