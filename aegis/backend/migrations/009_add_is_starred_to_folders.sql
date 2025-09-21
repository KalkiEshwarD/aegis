-- Add is_starred field to folders table
ALTER TABLE folders ADD COLUMN is_starred BOOLEAN DEFAULT FALSE NOT NULL;
