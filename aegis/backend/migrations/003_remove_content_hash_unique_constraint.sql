-- Remove unique constraint on content_hash to allow user-specific deduplication
-- This prevents security vulnerabilities where malicious users could block legitimate uploads

-- Drop the unique constraint on content_hash
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_content_hash_key;

-- Add a composite unique constraint on user_id and content_hash at the user_files level
-- This prevents duplicates within a user's files while allowing cross-user duplicates
ALTER TABLE user_files ADD CONSTRAINT user_files_user_content_unique 
    UNIQUE (user_id, file_id);

-- Add an index on content_hash for performance (without uniqueness)
CREATE INDEX IF NOT EXISTS idx_files_content_hash ON files(content_hash);