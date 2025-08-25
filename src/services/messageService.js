import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import { SQL } from '../models/sql/messages.sql.js';
import { logger } from '../utils/logger.js';

/**
 * Save incoming message, emit to socket room, and send push to participants.
 * @param {object} deps - dependencies
 * @param {import('socket.io').Server} deps.io - socket.io server
 * @param {string} deps.fcmServerKey - FCM server key
 * @param {object} input - message input
 * @param {string} input.room_id
 * @param {string} input.sender_id
 * @param {string} input.sender
 * @param {string} input.content_type - 'text' | 'image' | ...
 * @param {string} input.content_text
 * @param {string} [input.wa_message_id]
 */
export async function handleIncomingMessage({ io, fcmServerKey }, input) {
  const id = uuidv4();
  const params = [
    id,
    input.room_id,
    input.sender_id,
    input.sender,
    input.content_type,
    input.content_text,
    input.wa_message_id || null
  ];

  const { rows } = await query(SQL.insertMessage, params);
  const message = rows[0];

  // Emit only to the room, and with a granular event
  io.to(`room:${input.room_id}`).emit('room:new_message', {
    room_id: input.room_id,
    message
  });

  // Fetch participants to notify
  const { rows: participants } = await query(SQL.getRoomParticipants, [input.room_id]);

  // Send push (fire-and-forget)
  const payload = {
    room_id: input.room_id,
    message: input.content_text,
    sender: input.sender
  };
  for (const p of participants) {
    if (!p.device_token) continue;
    import('./fcmService.js').then(({ sendPushNotification }) =>
      sendPushNotification({ serverKey: fcmServerKey, token: p.device_token, payload })
        .catch((err) => logger.warn({ err }, 'FCM push failed'))
    );
  }

  return message;
}
