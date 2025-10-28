-- Rename allowed_usernames to allowed_emails in file_shares table
-- This migration updates the column name to reflect email-based sharing instead of username-based sharing

-- Rename the column
ALTER TABLE file_shares RENAME COLUMN allowed_usernames TO allowed_emails;

-- Rename the index as well
DROP INDEX IF EXISTS idx_file_shares_allowed_usernames;
CREATE INDEX IF NOT EXISTS idx_file_shares_allowed_emails ON file_shares USING GIN (allowed_emails);