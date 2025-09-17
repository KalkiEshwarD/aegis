-- Add unique constraint to prevent duplicate user-file associations
-- This ensures a user cannot have multiple entries for the same file

-- First, remove any existing duplicates (keep the most recent one)
DELETE FROM user_files
WHERE id NOT IN (
    SELECT DISTINCT ON (user_id, file_id) id
    FROM user_files
    ORDER BY user_id, file_id, created_at DESC
);

-- Add unique constraint on (user_id, file_id)
ALTER TABLE user_files
ADD CONSTRAINT unique_user_file
UNIQUE (user_id, file_id);