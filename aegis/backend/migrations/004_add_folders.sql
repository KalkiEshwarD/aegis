-- Add folder support to the database
-- This migration adds tables and columns for folder functionality

-- Add folder_id column to user_files table
ALTER TABLE user_files ADD COLUMN folder_id INTEGER REFERENCES folders(id);

-- Create index on folder_id for better performance
CREATE INDEX IF NOT EXISTS idx_user_files_folder_id ON user_files(folder_id);

-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create index on user_id for folders
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);

-- Create index on parent_id for folders
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);

-- Create index on deleted_at for folders (for soft deletes)
CREATE INDEX IF NOT EXISTS idx_folders_deleted_at ON folders(deleted_at);

-- Create room_folders table for sharing folders to rooms
CREATE TABLE IF NOT EXISTS room_folders (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(room_id, folder_id)
);

-- Create indexes for room_folders
CREATE INDEX IF NOT EXISTS idx_room_folders_room_id ON room_folders(room_id);
CREATE INDEX IF NOT EXISTS idx_room_folders_folder_id ON room_folders(folder_id);

-- Add folders and room_folders to rooms table associations
-- Note: This is handled by the application layer through the room_folders junction table