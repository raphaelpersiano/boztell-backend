-- Quick test: Run this in Supabase SQL Editor to apply the migration

-- Migration: Fix last message query using PostgreSQL function
-- Created: 2025-11-05
-- Purpose: Efficiently get the latest message for each room using DISTINCT ON

-- Drop function if exists (for safe re-run)
DROP FUNCTION IF EXISTS get_latest_messages_for_rooms(uuid[]);
DROP FUNCTION IF EXISTS get_latest_messages_for_rooms(text[]);

-- Create function to get latest message per room
-- Note: room_id in messages table is TEXT, not UUID
CREATE OR REPLACE FUNCTION get_latest_messages_for_rooms(room_ids text[])
RETURNS TABLE (
  room_id text,
  content_text text,
  content_type text,
  created_at timestamptz
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (m.room_id)
    m.room_id,
    m.content_text,
    m.content_type,
    m.created_at
  FROM messages m
  WHERE m.room_id = ANY(room_ids)
  ORDER BY m.room_id, m.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_latest_messages_for_rooms(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_latest_messages_for_rooms(text[]) TO anon;
GRANT EXECUTE ON FUNCTION get_latest_messages_for_rooms(text[]) TO service_role;

-- Test the function (Option 1: Get room IDs and convert to text array)
SELECT * FROM get_latest_messages_for_rooms(
  (SELECT ARRAY_AGG(id::text) FROM rooms LIMIT 5)
);

-- Alternative test (Option 2: Manual array with text values)
-- SELECT * FROM get_latest_messages_for_rooms(
--   ARRAY['7e956fc9-d64b-4e77-9fd5-1cafc1588b41', '8a123b45-c678-9def-0123-456789abcdef']
-- );
