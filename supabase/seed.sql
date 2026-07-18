-- HyperNiche AI - Seed Data
-- Run this after migrations to set up initial data

-- ============================================
-- SYSTEM AGENT DEFINITIONS
-- (Commented out - agent_definitions table not in current schema)
-- ============================================

/*
INSERT INTO agent_definitions (id, name, slug, description, type, model, system_prompt, config, is_active, is_public)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'Keyword Generator',
    'keyword-generator',
    'Generate SEO-optimized keywords based on seed topics',
    'system',
    'gemini-1.5-flash',
    'You are an SEO expert. Generate relevant, high-value keywords based on the given seed keyword or topic. Focus on search intent, competition level, and commercial value.',
    '{"maxKeywords": 50, "includeMetrics": true}',
    true,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Blog Writer',
    'blog-writer',
    'Generate SEO-optimized blog content',
    'system',
    'gemini-1.5-pro',
    'You are a professional content writer. Create engaging, SEO-optimized blog posts that provide value to readers while incorporating target keywords naturally.',
    '{"defaultLength": "1500", "tone": "professional"}',
    true,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'Content Analyzer',
    'content-analyzer',
    'Analyze content for SEO and readability',
    'system',
    'gemini-1.5-flash',
    'You are an SEO analyst. Analyze the given content for keyword optimization, readability, structure, and overall SEO effectiveness. Provide actionable recommendations.',
    '{"checkReadability": true, "checkSEO": true}',
    true,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'Competitor Analyzer',
    'competitor-analyzer',
    'Analyze competitor content and strategies',
    'system',
    'gemini-1.5-pro',
    'You are a competitive intelligence analyst. Analyze competitor content, identify their strategies, and provide insights for differentiation.',
    '{"depth": "comprehensive"}',
    true,
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  system_prompt = EXCLUDED.system_prompt,
  config = EXCLUDED.config,
  updated_at = NOW();
*/

-- ============================================
-- SAMPLE SAVED PROMPTS (for demo)
-- ============================================

-- These will be created per-user when they sign up, not as seed data
-- Keeping this section as a template for future use

-- ============================================
-- NOTES
-- ============================================
--
-- This seed file creates system-level data only.
-- User-specific data is created when users sign up.
--
-- To run this seed:
-- 1. Via Supabase Dashboard: SQL Editor > New Query > Paste & Run
-- 2. Via CLI: supabase db seed
