-- Add envelope key fields to users table for key rotation support
ALTER TABLE users ADD COLUMN envelope_key TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN envelope_key_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN envelope_key_salt TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN envelope_key_iv TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN envelope_key_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE users ADD COLUMN envelope_key_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for envelope key version for efficient queries
CREATE INDEX IF NOT EXISTS idx_users_envelope_key_version ON users(envelope_key_version);

-- Update existing users to have empty envelope key fields (will be populated during rotation)
UPDATE users SET envelope_key = '', envelope_key_salt = '', envelope_key_iv = '' WHERE envelope_key IS NULL OR envelope_key_salt IS NULL OR envelope_key_iv IS NULL;