import { query } from '../db.js';

export async function upsertDeviceToken({ user_id, device_token, platform }) {
  const sql = `
    INSERT INTO devices (user_id, device_token, platform, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (device_token)
    DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, updated_at = NOW()
    RETURNING *;
  `;
  const { rows } = await query(sql, [user_id, device_token, platform || null]);
  return rows[0];
}
