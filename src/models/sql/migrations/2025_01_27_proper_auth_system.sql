-- Update users table untuk proper authentication
-- Add password hash dan access token fields

-- Add new columns for proper authentication
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_token TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_logout TIMESTAMPTZ;

-- Remove PIN column (tidak aman dan bisa duplicate)
ALTER TABLE users DROP COLUMN IF EXISTS pin;

-- Create index for access token
CREATE INDEX IF NOT EXISTS idx_users_access_token ON users(access_token) WHERE access_token IS NOT NULL;

-- Update existing users with default password (untuk testing)
-- Dalam production, user harus set password sendiri
UPDATE users SET 
  password_hash = 'default123' -- Dalam production, ini harus di-hash dengan bcrypt/argon2
WHERE password_hash IS NULL;

-- Buat constraint password tidak boleh null
ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;