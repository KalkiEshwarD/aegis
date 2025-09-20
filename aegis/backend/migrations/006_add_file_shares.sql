-- Add file sharing functionality to the database
-- This migration adds tables and columns for password-based file sharing

-- Create file_shares table for storing share information
CREATE TABLE IF NOT EXISTS file_shares (
    id SERIAL PRIMARY KEY,
    user_file_id INTEGER NOT NULL REFERENCES user_files(id) ON DELETE CASCADE,
    share_token VARCHAR(255) UNIQUE NOT NULL,
    encrypted_key TEXT NOT NULL, -- Encrypted file encryption key
    salt TEXT NOT NULL, -- Salt used for PBKDF2
    iv TEXT NOT NULL, -- Initialization vector for AES-GCM
    max_downloads INTEGER DEFAULT -1, -- -1 means unlimited
    download_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for file_shares
CREATE INDEX IF NOT EXISTS idx_file_shares_user_file_id ON file_shares(user_file_id);
CREATE INDEX IF NOT EXISTS idx_file_shares_share_token ON file_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_file_shares_expires_at ON file_shares(expires_at);

-- Create share_access_logs table for tracking access attempts
CREATE TABLE IF NOT EXISTS share_access_logs (
    id SERIAL PRIMARY KEY,
    file_share_id INTEGER NOT NULL REFERENCES file_shares(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN DEFAULT FALSE,
    failure_reason TEXT
);

-- Create indexes for share_access_logs
CREATE INDEX IF NOT EXISTS idx_share_access_logs_file_share_id ON share_access_logs(file_share_id);
CREATE INDEX IF NOT EXISTS idx_share_access_logs_attempted_at ON share_access_logs(attempted_at);

-- Add share-related fields to user_files table
ALTER TABLE user_files ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT FALSE;
ALTER TABLE user_files ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0;

-- Create index for shared files
CREATE INDEX IF NOT EXISTS idx_user_files_is_shared ON user_files(is_shared);