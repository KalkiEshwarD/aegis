-- Change allowed_emails column from TEXT[] array type to TEXT type
-- This migration fixes the "malformed array literal" error when creating shares
-- The application stores JSON strings (e.g., '[]' or '["email@example.com"]') 
-- which are not compatible with PostgreSQL array syntax

-- Drop the GIN index first
DROP INDEX IF EXISTS idx_file_shares_allowed_emails;

-- Change the column type from TEXT[] to TEXT
ALTER TABLE file_shares ALTER COLUMN allowed_emails TYPE TEXT USING allowed_emails::TEXT;

-- Set a default value for new records
ALTER TABLE file_shares ALTER COLUMN allowed_emails SET DEFAULT '[]';

-- Make it NOT NULL (if not already)
ALTER TABLE file_shares ALTER COLUMN allowed_emails SET NOT NULL;
