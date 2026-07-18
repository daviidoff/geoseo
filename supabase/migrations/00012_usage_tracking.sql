-- ============================================
-- ABOUTME: Usage tracking migration for pricing refactor
-- ABOUTME: Replaces credit-based system with usage-based tiers
-- ============================================

-- ============================================
-- USAGE EVENTS TABLE
-- Tracks all billable operations for analytics and limits
-- ============================================
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  quantity INT DEFAULT 1,
  estimated_cost_usd DECIMAL(10,6),
  tokens_input INT,
  tokens_output INT,
  model TEXT,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for monthly usage queries (primary use case)
-- Using simple composite index on user_id and created_at for monthly queries
CREATE INDEX IF NOT EXISTS idx_usage_events_user_created
  ON usage_events(user_id, created_at DESC);

-- Index for operation-type filtering
CREATE INDEX IF NOT EXISTS idx_usage_events_operation
  ON usage_events(operation);

-- Index for client-specific usage
CREATE INDEX IF NOT EXISTS idx_usage_events_client
  ON usage_events(client_id);

-- Index for date-range queries
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at
  ON usage_events(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view own usage"
  ON usage_events FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can INSERT (via API routes)
-- This ensures usage is only tracked through authorized endpoints

-- ============================================
-- HELPER FUNCTION: Get monthly usage summary
-- ============================================
CREATE OR REPLACE FUNCTION get_monthly_usage(
  p_user_id UUID,
  p_month_offset INT DEFAULT 0
)
RETURNS TABLE (
  operation TEXT,
  total_quantity BIGINT,
  total_cost_usd DECIMAL(10,2)
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    operation,
    SUM(quantity)::BIGINT as total_quantity,
    SUM(estimated_cost_usd)::DECIMAL(10,2) as total_cost_usd
  FROM usage_events
  WHERE user_id = p_user_id
    AND created_at >= date_trunc('month', NOW() - (p_month_offset || ' months')::INTERVAL)
    AND created_at < date_trunc('month', NOW() - ((p_month_offset - 1) || ' months')::INTERVAL)
  GROUP BY operation;
$$;

-- ============================================
-- HELPER FUNCTION: Get context count for user
-- ============================================
CREATE OR REPLACE FUNCTION get_context_count(p_user_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INT FROM clients WHERE user_id = p_user_id;
$$;
