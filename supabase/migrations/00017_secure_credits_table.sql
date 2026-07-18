-- ============================================
-- SECURITY FIX: Move credits to separate table
-- Users could previously update their own credits via user_profiles
-- This migration creates a secure user_credits table that users can only READ
-- ============================================

-- ============================================
-- 1. CREATE SECURE USER_CREDITS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Credit balances
  credits_remaining DECIMAL(10,2) DEFAULT 0 NOT NULL,
  credits_total DECIMAL(10,2) DEFAULT 0 NOT NULL,
  
  -- Tracking
  last_credited_at TIMESTAMPTZ,
  last_deducted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);

-- ============================================
-- 2. MIGRATE EXISTING DATA
-- ============================================
INSERT INTO user_credits (user_id, credits_remaining, credits_total, created_at, updated_at)
SELECT 
  user_id, 
  COALESCE(credits_remaining, 0), 
  COALESCE(credits_total, 0),
  created_at,
  updated_at
FROM user_profiles
WHERE user_id IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET
  credits_remaining = EXCLUDED.credits_remaining,
  credits_total = EXCLUDED.credits_total,
  updated_at = NOW();

-- ============================================
-- 3. ENABLE RLS WITH RESTRICTIVE POLICIES
-- ============================================
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

-- Users can ONLY view their own credits (no insert, update, delete)
CREATE POLICY "Users can view own credits"
  ON user_credits FOR SELECT
  USING (auth.uid() = user_id);

-- Note: No INSERT, UPDATE, or DELETE policies for regular users
-- Only service_role (supabaseAdmin) can modify credits

-- ============================================
-- 4. UPDATE credit_transactions TO ADD subscription_renewal TYPE
-- ============================================
ALTER TABLE credit_transactions 
  DROP CONSTRAINT IF EXISTS credit_transactions_type_check;

ALTER TABLE credit_transactions 
  ADD CONSTRAINT credit_transactions_type_check 
  CHECK (type IN ('purchase', 'usage', 'refund', 'bonus', 'subscription', 'subscription_renewal'));

-- ============================================
-- 5. RESTRICT user_profiles UPDATE POLICY
-- This prevents users from modifying billing-related columns
-- ============================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- Create a new restricted policy that only allows updating non-billing columns
-- Users can update: full_name, organization, avatar_url, onboarding_completed, selected_client_id
-- Users CANNOT update: credits_*, stripe_*, plan_type, subscription_status, etc.
CREATE POLICY "Users can update own profile (restricted)"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    -- The new values for billing columns must match the old values (no changes allowed)
    -- This is enforced by checking that sensitive columns weren't modified
    auth.uid() = user_id
  );

-- Note: The above policy still allows row-level updates, but we'll enforce column
-- restrictions via a trigger for maximum security

-- ============================================
-- 6. CREATE TRIGGER TO PROTECT BILLING COLUMNS
-- ============================================
CREATE OR REPLACE FUNCTION protect_billing_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If this is NOT the service role, prevent changes to billing columns
  -- Service role has a special session setting
  IF current_setting('role', true) != 'service_role' THEN
    -- Restore protected columns to their original values
    NEW.credits_remaining := OLD.credits_remaining;
    NEW.credits_total := OLD.credits_total;
    NEW.stripe_customer_id := OLD.stripe_customer_id;
    NEW.stripe_subscription_id := OLD.stripe_subscription_id;
    NEW.subscription_status := OLD.subscription_status;
    NEW.plan_type := OLD.plan_type;
    NEW.current_period_end := OLD.current_period_end;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS protect_user_profile_billing ON user_profiles;
CREATE TRIGGER protect_user_profile_billing
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_billing_columns();

-- ============================================
-- 7. UPDATE HELPER FUNCTIONS TO USE user_credits
-- ============================================

-- Function to deduct credits (uses user_credits table now)
CREATE OR REPLACE FUNCTION deduct_credits(p_user_id UUID, p_amount DECIMAL, p_description TEXT DEFAULT 'Usage')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance DECIMAL;
BEGIN
  -- Get current balance from user_credits
  SELECT credits_remaining INTO v_current_balance
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Check if sufficient balance
  IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  -- Deduct credits from user_credits
  UPDATE user_credits
  SET credits_remaining = credits_remaining - p_amount,
      last_deducted_at = NOW(),
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Also update user_profiles for backwards compatibility (via service role)
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

-- Function to add credits (uses user_credits table now)
CREATE OR REPLACE FUNCTION add_credits(p_user_id UUID, p_amount DECIMAL, p_type TEXT, p_description TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance DECIMAL;
BEGIN
  -- Ensure user_credits record exists
  INSERT INTO user_credits (user_id, credits_remaining, credits_total)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Add credits to user_credits
  UPDATE user_credits
  SET credits_remaining = credits_remaining + p_amount,
      credits_total = credits_total + p_amount,
      last_credited_at = NOW(),
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING credits_remaining INTO v_new_balance;

  -- Also update user_profiles for backwards compatibility
  UPDATE user_profiles
  SET credits_remaining = credits_remaining + p_amount,
      credits_total = credits_total + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log transaction
  INSERT INTO credit_transactions (user_id, amount, type, description, balance_after)
  VALUES (p_user_id, p_amount, p_type, p_description, v_new_balance);

  RETURN TRUE;
END;
$$;

-- ============================================
-- 8. CREATE FUNCTION TO GET CREDITS (for easy querying)
-- ============================================
CREATE OR REPLACE FUNCTION get_user_credits(p_user_id UUID)
RETURNS TABLE(credits_remaining DECIMAL, credits_total DECIMAL)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT uc.credits_remaining, uc.credits_total
  FROM user_credits uc
  WHERE uc.user_id = p_user_id;
END;
$$;

-- ============================================
-- 9. UPDATE AUTH TRIGGER TO CREATE user_credits
-- ============================================
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
    5.00,  -- Default free credits (matching 'free' plan)
    5.00,
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Insert into user_credits (secure credits table)
  INSERT INTO public.user_credits (user_id, credits_remaining, credits_total, created_at)
  VALUES (
    NEW.id,
    5.00,  -- Default free credits
    5.00,
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ============================================
-- 10. CREATE user_credits FOR EXISTING USERS WHO DON'T HAVE IT
-- ============================================
INSERT INTO user_credits (user_id, credits_remaining, credits_total)
SELECT u.id, COALESCE(up.credits_remaining, 5.00), COALESCE(up.credits_total, 5.00)
FROM auth.users u
LEFT JOIN user_profiles up ON up.user_id = u.id
WHERE NOT EXISTS (SELECT 1 FROM user_credits uc WHERE uc.user_id = u.id);
