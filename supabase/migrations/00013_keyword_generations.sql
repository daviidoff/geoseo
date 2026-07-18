-- ============================================
-- KEYWORD GENERATIONS TABLE
-- Stores keyword generation batches with results
-- ============================================

CREATE TABLE IF NOT EXISTS keyword_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  
  -- Generation parameters
  company_name TEXT NOT NULL,
  company_url TEXT,
  language TEXT DEFAULT 'en',
  country TEXT DEFAULT 'US',
  
  -- Results
  keywords JSONB NOT NULL DEFAULT '[]',
  total_keywords INTEGER DEFAULT 0,
  generation_time DECIMAL(10,2), -- seconds
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_keyword_generations_user_id ON keyword_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_keyword_generations_client_id ON keyword_generations(client_id);
CREATE INDEX IF NOT EXISTS idx_keyword_generations_created_at ON keyword_generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_keyword_generations_language_country ON keyword_generations(language, country);

-- Enable RLS
ALTER TABLE keyword_generations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own keyword generations'
  ) THEN
    CREATE POLICY "Users can view own keyword generations"
      ON keyword_generations FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can create own keyword generations'
  ) THEN
    CREATE POLICY "Users can create own keyword generations"
      ON keyword_generations FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own keyword generations'
  ) THEN
    CREATE POLICY "Users can delete own keyword generations"
      ON keyword_generations FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;
