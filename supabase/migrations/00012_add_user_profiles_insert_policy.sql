-- ============================================
-- ADD INSERT POLICY FOR user_profiles
-- Allows users to insert their own profile as a fallback
-- if the database trigger fails
-- ============================================

-- Drop policy if it exists, then create
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- Create INSERT policy for user_profiles
-- Users can only insert a profile for themselves
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);
