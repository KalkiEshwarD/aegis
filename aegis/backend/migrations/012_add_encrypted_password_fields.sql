-- Add missing encrypted password fields to file_shares table
-- These fields are needed for the FileShare model

ALTER TABLE file_shares ADD COLUMN IF NOT EXISTS encrypted_password TEXT;
ALTER TABLE file_shares ADD COLUMN IF NOT EXISTS password_iv TEXT;

-- Create indexes for the new fields
CREATE INDEX IF NOT EXISTS idx_file_shares_encrypted_password ON file_shares(encrypted_password);
CREATE INDEX IF NOT EXISTS idx_file_shares_password_iv ON file_shares(password_iv);