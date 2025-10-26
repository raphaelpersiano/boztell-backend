-- Migration: Rename sender_id to user_id in messages table
-- Date: 2025-10-26
-- Reason: Align database schema with application code (all code uses user_id)

-- Rename column sender_id to user_id
ALTER TABLE messages RENAME COLUMN sender_id TO user_id;

-- Update any indexes that reference the old column name
-- (Most indexes use room_id, wa_message_id, etc. so no changes needed)

-- Note: This is a non-breaking change as both fields represent the same concept
-- The 'sender' TEXT column remains unchanged for display names
