-- Add plain text password field to file_shares table for display purposes
-- Note: This stores passwords in plain text for user convenience
-- In production, consider encrypting this field or using a different approach

ALTER TABLE file_shares ADD COLUMN plain_text_password TEXT;

-- Create index for potential queries
CREATE INDEX IF NOT EXISTS idx_file_shares_plain_text_password ON file_shares(plain_text_password);