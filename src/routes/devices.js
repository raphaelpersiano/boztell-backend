import express from 'express';
import { upsertDeviceToken } from '../services/deviceService.js';

export const devicesRouter = express.Router();

devicesRouter.post('/register', async (req, res) => {
  const { user_id, device_token, platform } = req.body || {};
  if (!user_id || !device_token) return res.status(400).json({ error: 'user_id and device_token required' });
  const rec = await upsertDeviceToken({ user_id, device_token, platform });
  res.json({ ok: true, device: rec });
});
