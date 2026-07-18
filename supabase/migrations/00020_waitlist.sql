-- ABOUTME: Waitlist table for early access signups
-- ABOUTME: Stores email, name, source tracking, and UTM parameters

-- Create waitlist table
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  source TEXT DEFAULT 'landing',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);

-- Create index for analytics queries
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at);
CREATE INDEX IF NOT EXISTS idx_waitlist_source ON waitlist(source);

-- Enable RLS
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (for public signup)
CREATE POLICY "Anyone can join waitlist"
  ON waitlist
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Policy: Only service role can read (for admin dashboard)
CREATE POLICY "Service role can read waitlist"
  ON waitlist
  FOR SELECT
  TO service_role
  USING (true);

-- Policy: Only service role can update
CREATE POLICY "Service role can update waitlist"
  ON waitlist
  FOR UPDATE
  TO service_role
  USING (true);

-- Policy: Only service role can delete
CREATE POLICY "Service role can delete waitlist"
  ON waitlist
  FOR DELETE
  TO service_role
  USING (true);
