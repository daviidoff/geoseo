-- ============================================
-- BLOG GENERATIONS TABLE
-- Stores blog generation history with results
-- ============================================

CREATE TABLE IF NOT EXISTS blog_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  
  -- Generation type
  type TEXT NOT NULL DEFAULT 'blog', -- 'blog', 'blog_batch', 'refresh'
  
  -- Generation parameters
  company TEXT NOT NULL,
  url TEXT,
  language TEXT DEFAULT 'en',
  country TEXT DEFAULT 'US',
  keyword TEXT,
  
  -- Results
  title TEXT,
  content TEXT,
  word_count INTEGER,
  aeo_score DECIMAL(5,2),
  generation_time DECIMAL(10,2), -- seconds
  
  -- Batch-specific fields (for blog_batch type)
  batch_id TEXT,
  total INTEGER,
  successful INTEGER,
  failed INTEGER,
  results JSONB, -- Array of batch results
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_blog_generations_user_id ON blog_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_blog_generations_client_id ON blog_generations(client_id);
CREATE INDEX IF NOT EXISTS idx_blog_generations_created_at ON blog_generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_generations_type ON blog_generations(type);
CREATE INDEX IF NOT EXISTS idx_blog_generations_keyword ON blog_generations(keyword);

-- Enable RLS
ALTER TABLE blog_generations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own blog generations'
  ) THEN
    CREATE POLICY "Users can view own blog generations"
      ON blog_generations FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can create own blog generations'
  ) THEN
    CREATE POLICY "Users can create own blog generations"
      ON blog_generations FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own blog generations'
  ) THEN
    CREATE POLICY "Users can update own blog generations"
      ON blog_generations FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own blog generations'
  ) THEN
    CREATE POLICY "Users can delete own blog generations"
      ON blog_generations FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;
