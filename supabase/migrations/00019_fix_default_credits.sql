-- ============================================
-- FIX: Update default credits from 5 to 50
-- Free users should start with 50 credits as per pricing config
-- ============================================

-- Drop and recreate the trigger function with correct default credits
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;

-- Recreate the function with 50 credits default
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert into user_profiles with default free plan (50 credits)
  INSERT INTO public.user_profiles (
    user_id, 
    email, 
    full_name, 
    avatar_url,
    plan_type,
    subscription_status,
    credits_remaining, 
    credits_total, 
    created_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'free',
    'active',
    50,  -- Default free credits (was 5, now 50)
    50,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, user_profiles.avatar_url);

  -- Insert into user_credits (secure credits table)
  INSERT INTO public.user_credits (user_id, credits_remaining, credits_total, created_at)
  VALUES (
    NEW.id,
    50,  -- Default free credits (was 5, now 50)
    50,
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update existing users who have 5 credits to 50 (if they were created with old defaults)
UPDATE public.user_profiles 
SET credits_remaining = 50, credits_total = 50 
WHERE credits_total = 5 AND plan_type = 'free';

UPDATE public.user_credits 
SET credits_remaining = 50, credits_total = 50 
WHERE credits_total = 5;
