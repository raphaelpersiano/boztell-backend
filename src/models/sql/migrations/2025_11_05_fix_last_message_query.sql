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

-- Test query (comment out after verification)
-- SELECT * FROM get_latest_messages_for_rooms((SELECT ARRAY_AGG(id::text) FROM rooms LIMIT 5));

COMMENT ON FUNCTION get_latest_messages_for_rooms IS 
'Returns the latest message for each room. Uses DISTINCT ON for efficient per-group sorting.
Parameters: room_ids - Array of room IDs as TEXT (supports both UUID and text formats)
Returns: Table with room_id, content_text, content_type, created_at';
