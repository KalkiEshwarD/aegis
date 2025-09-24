-- Create key_rotation_backups table to store backup data for rollback operations
CREATE TABLE IF NOT EXISTS key_rotation_backups (
    id SERIAL PRIMARY KEY,
    rotation_id VARCHAR(64) NOT NULL REFERENCES key_rotations(rotation_id) ON DELETE CASCADE,
    user_file_id INTEGER NOT NULL REFERENCES user_files(id) ON DELETE CASCADE,
    old_encryption_key TEXT NOT NULL, -- Backup of the old encrypted file key
    old_key_iv TEXT NOT NULL, -- Backup of the old IV used for file key encryption
    backup_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries and foreign key constraints
CREATE INDEX IF NOT EXISTS idx_key_rotation_backups_rotation_id ON key_rotation_backups(rotation_id);
CREATE INDEX IF NOT EXISTS idx_key_rotation_backups_user_file_id ON key_rotation_backups(user_file_id);

-- Create a unique constraint to prevent duplicate backups for the same file in a rotation
CREATE UNIQUE INDEX IF NOT EXISTS idx_key_rotation_backups_unique ON key_rotation_backups(rotation_id, user_file_id);