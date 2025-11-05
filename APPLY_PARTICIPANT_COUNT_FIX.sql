-- PostgreSQL function to count participants per room
-- This function returns COUNT(*) grouped by room_id for performance

CREATE OR REPLACE FUNCTION count_participants_by_room(room_ids text[])
RETURNS TABLE (room_id uuid, count bigint)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rp.room_id::uuid,
    COUNT(*)::bigint as count
  FROM room_participants rp
  WHERE rp.room_id::text = ANY(room_ids)
  GROUP BY rp.room_id;
END;
$$;

-- Grant execute permission to authenticated users, anon, and service_role
GRANT EXECUTE ON FUNCTION count_participants_by_room(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION count_participants_by_room(text[]) TO anon;
GRANT EXECUTE ON FUNCTION count_participants_by_room(text[]) TO service_role;

-- Test the function (optional, remove this after testing)
-- SELECT * FROM count_participants_by_room(ARRAY['room-uuid-1', 'room-uuid-2']::text[]);
