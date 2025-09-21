-- Add allowed_usernames column to file_shares table
-- This column stores an array of usernames that are allowed to access the shared file
-- When populated, only users with usernames in this array can access the share
ALTER TABLE file_shares ADD COLUMN IF NOT EXISTS allowed_usernames TEXT[];

-- Create GIN index for efficient querying of array elements
CREATE INDEX IF NOT EXISTS idx_file_shares_allowed_usernames ON file_shares USING GIN (allowed_usernames);