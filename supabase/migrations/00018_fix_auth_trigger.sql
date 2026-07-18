-- ============================================
-- FIX: Auth trigger was trying to insert into non-existent 'users' table
-- The 'users' table was dropped in 00011_merge_users_into_profiles.sql
-- This migration fixes the trigger to only use user_profiles and user_credits
-- ============================================

-- Drop the broken trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;

-- Recreate the function WITHOUT the insert into public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert into user_profiles with default free plan
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
    5.00,  -- Default free credits
    5.00,
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
    5.00,  -- Default free credits
    5.00,
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
