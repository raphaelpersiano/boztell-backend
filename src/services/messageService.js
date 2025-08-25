import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import { SQL } from '../models/sql/messages.sql.js';
import { logger } from '../utils/logger.js';
import { ensureRoom } from './roomService.js';
import { sendAutoReply, markMessageAsRead } from './whatsappService.js';

/**
 * Save incoming message, ensure room exists, emit to socket room, and send push to participants.
 * @param {object} deps - dependencies
 * @param {import('socket.io').Server} deps.io - socket.io server
 * @param {object} input - message input
 * @param {string} input.room_id
 * @param {string} input.sender_id
 * @param {string} input.sender
 * @param {string} input.content_type - 'text' | 'image' | ...
 * @param {string} input.content_text
 * @param {string} [input.wa_message_id]
 * @param {object} [input.metadata] - Additional message metadata
 */
export async function handleIncomingMessage({ io }, input) {
  try {
    // 1. Ensure room exists in database
    await ensureRoom(input.room_id, {
      customerPhone: input.sender_id,
      customerName: input.sender,
      lastActivity: new Date().toISOString()
    });
    
    // 2. Save message to database
    const id = uuidv4();
  const replyTo = input.metadata?.reply_to || null;
    const reactionEmoji = input.metadata?.reaction?.emoji || null;
    const reactionToWa = input.metadata?.reaction?.message_id || null;

    const params = [
      id,
      input.room_id,
      input.sender_id,
      input.sender,
      input.content_type,
      input.content_text,
      input.wa_message_id || null,
  replyTo,
      reactionEmoji,
      reactionToWa,
      JSON.stringify(input.metadata || {})
    ];

    const { rows } = await query(SQL.insertMessage, params);
    const message = rows[0];

    logger.info({ 
      messageId: id,
      roomId: input.room_id,
      senderId: input.sender_id,
      contentType: input.content_type,
      waMessageId: input.wa_message_id
    }, 'Message saved to database');

    // 3. Emit to socket room for real-time updates
    io.to(`room:${input.room_id}`).emit('room:new_message', {
      room_id: input.room_id,
      message
    });

    // 4. Send push notifications to participants
    await sendPushNotifications(input.room_id, {
      title: input.sender,
      message: input.content_text,
      room_id: input.room_id,
      sender: input.sender,
      message_id: id,
      type: input.content_type
    });

    // 5. Mark message as read in WhatsApp (optional)
    if (input.wa_message_id) {
      try {
        await markMessageAsRead(input.wa_message_id);
      } catch (err) {
        logger.warn({ err, waMessageId: input.wa_message_id }, 'Failed to mark message as read');
      }
    }

    // 6. Send auto-reply if it's a text message
    if (input.content_type === 'text' && input.content_text) {
      try {
        const autoReply = await sendAutoReply(input.sender_id, input.content_text);
        if (autoReply) {
          logger.info({ 
            roomId: input.room_id,
            replyMessageId: autoReply.messages?.[0]?.id 
          }, 'Auto-reply sent');
        }
      } catch (err) {
        logger.warn({ err, roomId: input.room_id }, 'Auto-reply failed');
      }
    }

    return {
      success: true,
      message,
      room_id: input.room_id,
      message_id: id,
      wa_message_id: input.wa_message_id
    };

  } catch (err) {
    logger.error({ 
      err, 
      roomId: input.room_id, 
      senderId: input.sender_id 
    }, 'Failed to handle incoming message');
    
    throw err;
  }
}

/**
 * Send push notifications to room participants
 */
async function sendPushNotifications(roomId, notificationData) {
  try {
    // Fetch participants to notify
    const { rows: participants } = await query(SQL.getRoomParticipants, [roomId]);

    if (participants.length === 0) {
      logger.debug({ roomId }, 'No participants found for push notifications');
      return;
    }

    // Send push notifications using Firebase Admin SDK
    const tokens = participants.map(p => p.device_token).filter(Boolean);
    
    if (tokens.length === 0) {
      logger.debug({ roomId }, 'No device tokens found for push notifications');
      return;
    }

    const { sendMulticastNotification } = await import('./fcmService.js');
    
    const result = await sendMulticastNotification({
      tokens,
      payload: notificationData
    });

    // Remove invalid tokens if any
    if (result.invalidTokens && result.invalidTokens.length > 0) {
      await removeInvalidTokens(result.invalidTokens);
    }

    logger.info({ 
      roomId,
      notificationsSent: result.successCount,
      invalidTokens: result.invalidTokens?.length || 0
    }, 'Push notifications processed');

  } catch (err) {
    logger.warn({ err, roomId }, 'Push notification failed');
  }
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
