// Plain SQL strings to keep logic in services clean
export const SQL = {
  insertMessage: `
    INSERT INTO messages (id, room_id, sender_id, sender, content_type, content_text, wa_message_id, metadata, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    RETURNING *;
  `,
  getRoomParticipants: `
  SELECT rp.user_id, d.device_token
  FROM room_participants rp
  LEFT JOIN devices d ON d.user_id = rp.user_id
  WHERE rp.room_id = $1 AND d.device_token IS NOT NULL;
  `,
  ensureRoom: `
    INSERT INTO rooms (id, external_id, title, created_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (id) DO NOTHING;
  `
};
