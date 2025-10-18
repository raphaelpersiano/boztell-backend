import { upsertDevice } from '../db.js';

export async function upsertDeviceToken({ user_id, device_token, platform }) {
  const { rows } = await upsertDevice(user_id, device_token, platform);
  return rows[0];
}
