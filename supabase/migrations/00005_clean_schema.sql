-- HyperNiche AI - Clean Schema
-- Agency tool for managing client content (keywords, blogs, analyses)

-- ============================================
-- DROP ALL EXISTING TABLES
-- ============================================

DROP TABLE IF EXISTS blog_versions CASCADE;
DROP TABLE IF EXISTS blogs CASCADE;
DROP TABLE IF EXISTS keywords CASCADE;
DROP TABLE IF EXISTS aeo_health_results CASCADE;
DROP TABLE IF EXISTS aeo_mentions_results CASCADE;
DROP TABLE IF EXISTS company_analyses CASCADE;
DROP TABLE IF EXISTS package_runs CASCADE;
DROP TABLE IF EXISTS client_package_assignments CASCADE;
DROP TABLE IF EXISTS saved_prompts CASCADE;
DROP TABLE IF EXISTS keyword_generations CASCADE;
DROP TABLE IF EXISTS scheduled_run_executions CASCADE;
DROP TABLE IF EXISTS scheduled_runs CASCADE;
DROP TABLE IF EXISTS resources CASCADE;
DROP TABLE IF EXISTS context_analyses CASCADE;
DROP TABLE IF EXISTS context_profiles CASCADE;
DROP TABLE IF EXISTS business_contexts CASCADE;
DROP TABLE IF EXISTS agent_definitions CASCADE;
DROP TABLE IF EXISTS failed_usage_reports CASCADE;
DROP TABLE IF EXISTS usage_tracking CASCADE;
DROP TABLE IF EXISTS rate_limits CASCADE;
DROP TABLE IF EXISTS batch_results CASCADE;
DROP TABLE IF EXISTS batches CASCADE;
DROP TABLE IF EXISTS credit_transactions CASCADE;
DROP TABLE IF EXISTS user_api_keys CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop old trigger function if exists
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;

-- ============================================
-- TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 1. USERS
-- ============================================

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- 2. CLIENTS
-- ============================================

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website TEXT,
  industry TEXT,
  brand_voice TEXT,
  target_audience TEXT,
  competitors TEXT,
  products TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 3. ASSETS
-- ============================================

CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('image', 'document')),
  mime_type TEXT,
  size_bytes INTEGER,
  storage_path TEXT,
  ai_labels JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assets_user_id ON assets(user_id);
CREATE INDEX idx_assets_client_id ON assets(client_id);

-- ============================================
-- 4. KEYWORDS
-- ============================================

CREATE TABLE keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  intent TEXT,
  is_question BOOLEAN DEFAULT FALSE,
  search_volume INTEGER,
  difficulty INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_keywords_user_id ON keywords(user_id);
CREATE INDEX idx_keywords_client_id ON keywords(client_id);
CREATE INDEX idx_keywords_created_at ON keywords(created_at);

-- ============================================
-- 5. BLOGS
-- ============================================

CREATE TABLE blogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  keyword TEXT,
  slug TEXT,
  content TEXT,
  html_content TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  word_count INTEGER,
  meta_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  UNIQUE(client_id, slug)
);

CREATE INDEX idx_blogs_user_id ON blogs(user_id);
CREATE INDEX idx_blogs_client_id ON blogs(client_id);
CREATE INDEX idx_blogs_status ON blogs(status);
CREATE INDEX idx_blogs_created_at ON blogs(created_at);
CREATE TRIGGER update_blogs_updated_at
  BEFORE UPDATE ON blogs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 6. ANALYSES
-- ============================================

CREATE TABLE analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('aeo_mentions', 'health_check')),
  score INTEGER,
  results JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analyses_user_id ON analyses(user_id);
CREATE INDEX idx_analyses_client_id ON analyses(client_id);
CREATE INDEX idx_analyses_type ON analyses(type);
CREATE INDEX idx_analyses_created_at ON analyses(created_at);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE blogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

-- Users: can only see own record
CREATE POLICY "Users can view own record" ON users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own record" ON users
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own record" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Clients: user_id = auth.uid()
CREATE POLICY "Users can view own clients" ON clients
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own clients" ON clients
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own clients" ON clients
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own clients" ON clients
  FOR DELETE USING (auth.uid() = user_id);

-- Assets: user_id = auth.uid()
CREATE POLICY "Users can view own assets" ON assets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own assets" ON assets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own assets" ON assets
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own assets" ON assets
  FOR DELETE USING (auth.uid() = user_id);

-- Keywords: user_id = auth.uid()
CREATE POLICY "Users can view own keywords" ON keywords
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own keywords" ON keywords
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own keywords" ON keywords
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own keywords" ON keywords
  FOR DELETE USING (auth.uid() = user_id);

-- Blogs: user_id = auth.uid()
CREATE POLICY "Users can view own blogs" ON blogs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own blogs" ON blogs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own blogs" ON blogs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own blogs" ON blogs
  FOR DELETE USING (auth.uid() = user_id);

-- Analyses: user_id = auth.uid()
CREATE POLICY "Users can view own analyses" ON analyses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own analyses" ON analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own analyses" ON analyses
  FOR DELETE USING (auth.uid() = user_id);
