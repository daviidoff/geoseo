-- Add avatar_url to users table for LinkedIn profile pictures
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
