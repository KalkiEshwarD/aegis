-- Add is_starred field to user_files table
ALTER TABLE user_files ADD COLUMN is_starred BOOLEAN DEFAULT FALSE NOT NULL;

-- Add envelope key fields to file_shares table
ALTER TABLE file_shares ADD COLUMN envelope_key TEXT NOT NULL DEFAULT '';
ALTER TABLE file_shares ADD COLUMN envelope_salt TEXT NOT NULL DEFAULT '';
ALTER TABLE file_shares ADD COLUMN envelope_iv TEXT NOT NULL DEFAULT '';

-- Update any existing file_shares to have empty envelope key fields
UPDATE file_shares SET envelope_key = '', envelope_salt = '', envelope_iv = '' WHERE envelope_key IS NULL OR envelope_salt IS NULL OR envelope_iv IS NULL;