-- Add shared_file_access table for tracking which users have accessed shared files
-- This enables "Shared with Me" functionality

-- Create shared_file_access table to track who has successfully accessed shared files
CREATE TABLE IF NOT EXISTS shared_file_access (
    id SERIAL PRIMARY KEY,
    user_id INTEGER, -- NULL for anonymous access, user_id for logged-in users
    file_share_id INTEGER NOT NULL REFERENCES file_shares(id) ON DELETE CASCADE,
    share_token VARCHAR(255) NOT NULL,
    first_access_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_access_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 1,
    ip_address INET,
    user_agent TEXT,
    UNIQUE(user_id, file_share_id) -- One record per user per share
);

-- Create indexes for shared_file_access
CREATE INDEX IF NOT EXISTS idx_shared_file_access_user_id ON shared_file_access(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_file_access_file_share_id ON shared_file_access(file_share_id);
CREATE INDEX IF NOT EXISTS idx_shared_file_access_share_token ON shared_file_access(share_token);
CREATE INDEX IF NOT EXISTS idx_shared_file_access_last_access ON shared_file_access(last_access_at);

-- Add rate limiting table for password attempts
CREATE TABLE IF NOT EXISTS share_rate_limits (
    id SERIAL PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL, -- Could be IP address or token+IP combo
    attempt_count INTEGER DEFAULT 1,
    first_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    blocked_until TIMESTAMP WITH TIME ZONE,
    UNIQUE(identifier)
);

-- Create indexes for rate limiting
CREATE INDEX IF NOT EXISTS idx_share_rate_limits_identifier ON share_rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_share_rate_limits_blocked_until ON share_rate_limits(blocked_until);