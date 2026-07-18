-- ============================================
-- MERGE users INTO user_profiles (MECE cleanup)
-- Single source of truth for user data
-- ============================================

-- 1. Add avatar_url to user_profiles if not exists
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Migrate any data from users to user_profiles that might be missing
UPDATE user_profiles up
SET
  avatar_url = COALESCE(up.avatar_url, u.avatar_url),
  email = COALESCE(up.email, u.email),
  full_name = COALESCE(up.full_name, u.full_name)
FROM users u
WHERE up.user_id = u.id;

-- 3. Drop the users table (cascades to trigger)
DROP TABLE IF EXISTS users CASCADE;

-- 4. Drop old triggers and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;

-- 5. Create new simplified auth trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    user_id,
    email,
    full_name,
    avatar_url,
    credits_remaining,
    credits_total,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    50.00,  -- Default free credits
    50.00,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, user_profiles.avatar_url);

  RETURN NEW;
END;
$$;

-- 6. Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Add index for email lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
