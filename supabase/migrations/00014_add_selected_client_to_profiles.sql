-- Add selected_client_id to user_profiles for persistent company selection
-- This replaces localStorage-based selection which causes sync issues

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS selected_client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_selected_client ON user_profiles(selected_client_id);

-- Comment for documentation
COMMENT ON COLUMN user_profiles.selected_client_id IS 'Currently selected client/company for the user session';
