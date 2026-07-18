-- ============================================
-- ABOUTME: Update plan types for new pricing model
-- ABOUTME: Migrates from free/beta/pro/enterprise to free/pro/business
-- ============================================

-- ============================================
-- UPDATE PLAN TYPE CONSTRAINT
-- ============================================

-- Drop old constraint
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_plan_type_check;

-- Add new constraint with updated plan types
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_plan_type_check
  CHECK (plan_type IN ('free', 'pro', 'business'));

-- ============================================
-- MIGRATE EXISTING USERS
-- ============================================

-- beta users become free (trial period ended)
UPDATE user_profiles SET plan_type = 'free' WHERE plan_type = 'beta';

-- enterprise/max users become business
UPDATE user_profiles SET plan_type = 'business' WHERE plan_type IN ('max', 'enterprise');

-- pro stays pro, free stays free (no action needed)

-- ============================================
-- CLEANUP CREDIT COLUMNS (deprecated but kept for history)
-- We keep credits_remaining and credits_total for migration purposes
-- but they won't be used in the new system
-- ============================================

-- Add comment to indicate these columns are deprecated
COMMENT ON COLUMN user_profiles.credits_remaining IS 'DEPRECATED: Kept for historical reference only. See usage_events table for new system.';
COMMENT ON COLUMN user_profiles.credits_total IS 'DEPRECATED: Kept for historical reference only. See usage_events table for new system.';
