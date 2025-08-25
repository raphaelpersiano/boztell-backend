import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import { SQL } from '../models/sql/messages.sql.js';
import { logger } from '../utils/logger.js';

/**
 * Save incoming message, emit to socket room, and send push to participants.
 * @param {object} deps - dependencies
 * @param {import('socket.io').Server} deps.io - socket.io server
 * @param {object} input - message input
 * @param {string} input.room_id
 * @param {string} input.sender_id
 * @param {string} input.sender
 * @param {string} input.content_type - 'text' | 'image' | ...
 * @param {string} input.content_text
 * @param {string} [input.wa_message_id]
 */
export async function handleIncomingMessage({ io }, input) {
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

  // Send push notifications using Firebase Admin SDK
  if (participants.length > 0) {
    const tokens = participants.map(p => p.device_token).filter(Boolean);
    
    if (tokens.length > 0) {
      const { sendMulticastNotification } = await import('./fcmService.js');
      
      try {
        const result = await sendMulticastNotification({
          tokens,
          payload: {
            title: input.sender,
            message: input.content_text,
            room_id: input.room_id,
            sender: input.sender,
            message_id: id,
            type: 'text'
          }
        });

        // Remove invalid tokens if any
        if (result.invalidTokens && result.invalidTokens.length > 0) {
          await removeInvalidTokens(result.invalidTokens);
        }

        logger.info({ 
          messageId: id, 
          room_id: input.room_id,
          notificationsSent: result.successCount 
        }, 'Message processed and notifications sent');

      } catch (err) {
        logger.warn({ err, messageId: id }, 'Push notification failed');
      }
    }
  }

  return message;
}

/**
 * Remove invalid device tokens from database
 */
async function removeInvalidTokens(tokens) {
  if (!tokens || tokens.length === 0) return;
  
  try {
    const placeholders = tokens.map((_, i) => `$${i + 1}`).join(',');
    const sql = `DELETE FROM devices WHERE device_token IN (${placeholders})`;
    
    await query(sql, tokens);
    logger.info({ count: tokens.length }, 'Invalid device tokens removed');
  } catch (err) {
    logger.error({ err, tokenCount: tokens.length }, 'Failed to remove invalid tokens');
  }
}
