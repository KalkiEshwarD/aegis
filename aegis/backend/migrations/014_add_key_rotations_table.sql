-- Create key_rotations table to track envelope key rotation operations
CREATE TABLE IF NOT EXISTS key_rotations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rotation_id VARCHAR(64) UNIQUE NOT NULL, -- UUID for tracking rotation operations
    status VARCHAR(50) NOT NULL CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'ROLLED_BACK')),
    old_envelope_key_version INTEGER NOT NULL,
    new_envelope_key_version INTEGER NOT NULL,
    total_files_affected INTEGER NOT NULL DEFAULT 0,
    files_processed INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_key_rotations_user_id ON key_rotations(user_id);
CREATE INDEX IF NOT EXISTS idx_key_rotations_rotation_id ON key_rotations(rotation_id);
CREATE INDEX IF NOT EXISTS idx_key_rotations_status ON key_rotations(status);
CREATE INDEX IF NOT EXISTS idx_key_rotations_started_at ON key_rotations(started_at);

-- Create updated_at trigger for key_rotations
CREATE TRIGGER update_key_rotations_updated_at BEFORE UPDATE ON key_rotations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();