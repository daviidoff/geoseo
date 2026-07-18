-- ============================================
-- HISTORY LOGS TABLE
-- Generic execution history across services
-- ============================================

CREATE TABLE IF NOT EXISTS history_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- context, keywords, blog, blog_batch, refresh, analytics
  company TEXT,
  url TEXT,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_history_logs_user_id ON history_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_history_logs_client_id ON history_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_history_logs_created_at ON history_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_logs_type ON history_logs(type);

-- Enable RLS
ALTER TABLE history_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own logs
CREATE POLICY "Users can view own history logs"
  ON history_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own logs
CREATE POLICY "Users can create own history logs"
  ON history_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own logs
CREATE POLICY "Users can delete own history logs"
  ON history_logs FOR DELETE
  USING (auth.uid() = user_id);
