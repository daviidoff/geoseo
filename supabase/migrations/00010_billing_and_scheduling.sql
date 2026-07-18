-- ============================================
-- PRODUCTION SCHEMA: Billing & Scheduling
-- Adds user_profiles, credit_transactions, scheduled_runs
-- ============================================

-- ============================================
-- USER PROFILES (extends users with billing)
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  organization TEXT,
  user_type TEXT DEFAULT 'self_service' CHECK (user_type IN ('self_service', 'enterprise', 'admin')),

  -- Stripe integration
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('active', 'inactive', 'past_due', 'canceled', 'trialing')),
  plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'beta', 'pro', 'enterprise')),
  current_period_end TIMESTAMPTZ,

  -- Credits system
  credits_remaining DECIMAL(10,2) DEFAULT 0,
  credits_total DECIMAL(10,2) DEFAULT 0,

  -- Onboarding
  onboarding_link TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer ON user_profiles(stripe_customer_id);

-- ============================================
-- CREDIT TRANSACTIONS (payment history)
-- ============================================
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'usage', 'refund', 'bonus', 'subscription')),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  balance_after DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying user transactions
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(type);

-- ============================================
-- SCHEDULED RUNS (cron jobs)
-- ============================================
CREATE TABLE IF NOT EXISTS scheduled_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,

  -- Schedule configuration
  cron_expression TEXT NOT NULL,
  timezone TEXT DEFAULT 'UTC',

  -- Job configuration
  job_type TEXT NOT NULL CHECK (job_type IN ('keyword_generation', 'blog_generation', 'aeo_check')),
  job_config JSONB DEFAULT '{}',
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disabled')),
  is_enabled BOOLEAN DEFAULT TRUE,

  -- Execution tracking
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  last_error_message TEXT,
  error_count INTEGER DEFAULT 0,
  run_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cron job queries
CREATE INDEX IF NOT EXISTS idx_scheduled_runs_user_id ON scheduled_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_runs_next_run ON scheduled_runs(next_run_at) WHERE status = 'active' AND is_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_scheduled_runs_client ON scheduled_runs(client_id);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_runs ENABLE ROW LEVEL SECURITY;

-- User Profiles: users can only access their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Credit Transactions: users can view their own transactions
CREATE POLICY "Users can view own transactions"
  ON credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Note: Only service role can INSERT transactions (via webhooks)

-- Scheduled Runs: users can manage their own schedules
CREATE POLICY "Users can view own schedules"
  ON scheduled_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own schedules"
  ON scheduled_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedules"
  ON scheduled_runs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own schedules"
  ON scheduled_runs FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- UPDATE AUTH TRIGGER
-- ============================================

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;

-- Create comprehensive auth trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert into public.users
  INSERT INTO public.users (id, email, full_name, avatar_url, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, users.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url);

  -- Insert into user_profiles with default credits
  INSERT INTO public.user_profiles (user_id, email, full_name, credits_remaining, credits_total, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    50.00,  -- Default free credits
    50.00,
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to deduct credits
CREATE OR REPLACE FUNCTION deduct_credits(p_user_id UUID, p_amount DECIMAL, p_description TEXT DEFAULT 'Usage')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance DECIMAL;
BEGIN
  -- Get current balance
  SELECT credits_remaining INTO v_current_balance
  FROM user_profiles
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Check if sufficient balance
  IF v_current_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  -- Deduct credits
  UPDATE user_profiles
  SET credits_remaining = credits_remaining - p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log transaction
  INSERT INTO credit_transactions (user_id, amount, type, description, balance_after)
  VALUES (p_user_id, -p_amount, 'usage', p_description, v_current_balance - p_amount);

  RETURN TRUE;
END;
$$;

-- Function to add credits
CREATE OR REPLACE FUNCTION add_credits(p_user_id UUID, p_amount DECIMAL, p_type TEXT, p_description TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance DECIMAL;
BEGIN
  -- Add credits
  UPDATE user_profiles
  SET credits_remaining = credits_remaining + p_amount,
      credits_total = credits_total + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING credits_remaining INTO v_new_balance;

  -- Log transaction
  INSERT INTO credit_transactions (user_id, amount, type, description, balance_after)
  VALUES (p_user_id, p_amount, p_type, p_description, v_new_balance);

  RETURN TRUE;
END;
$$;

-- ============================================
-- UPDATE EXISTING USERS
-- ============================================
-- Create user_profiles for any existing users that don't have one
INSERT INTO user_profiles (user_id, email, credits_remaining, credits_total)
SELECT u.id, u.email, 50.00, 50.00
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = u.id);
