-- Add username column to users table
ALTER TABLE users ADD COLUMN username VARCHAR(255) UNIQUE NOT NULL DEFAULT '';

-- Update existing users with a default username based on email (before email)
UPDATE users SET username = SPLIT_PART(email, '@', 1) WHERE username = '';

-- Make username NOT NULL without default
ALTER TABLE users ALTER COLUMN username DROP DEFAULT;

-- Create index for username
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);