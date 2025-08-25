import axios from 'axios';
import { logger } from '../utils/logger.js';

export async function sendPushNotification({ serverKey, token, payload }) {
  if (!serverKey) {
    logger.warn('FCM server key missing; skip push');
    return { skipped: true };
  }
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `key=${serverKey}`
  };
  const body = {
    to: token,
    notification: {
      title: payload.sender || 'New message',
      body: payload.message,
      sound: 'default'
    },
    data: payload,
    android: { priority: 'high' },
    apns: { headers: { 'apns-priority': '10' } }
  };
  try {
    const res = await axios.post('https://fcm.googleapis.com/fcm/send', body, { headers, timeout: 5000 });
    return res.data;
  } catch (err) {
    logger.error({ err }, 'FCM send error');
    throw err;
  }
}
