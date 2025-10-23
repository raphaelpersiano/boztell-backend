import { v4 as uuidv4 } from 'uuid';
import { insertMessage, getRoomParticipants, deleteDeviceTokens } from '../db.js';
import { logger } from '../utils/logger.js';
import { ensureRoom } from './roomService.js';
import { sendAutoReply, markMessageAsRead } from './whatsappService.js';

/**
 * Save incoming message, ensure room exists, emit to socket room, and send push to participants.
 * @param {object} deps - dependencies
 * @param {import('socket.io').Server} deps.io - socket.io server
 * @param {object} input - message input
 * @param {string} input.room_id
 * @param {string|null} input.user_id - null for customer messages, user ID for agent messages
 * @param {string} input.content_type - 'text' | 'image' | ...
 * @param {string} input.content_text
 * @param {string} [input.wa_message_id]
 * @param {object} [input.metadata] - Additional message metadata
 */
export async function handleIncomingMessage({ io }, input) {
  try {
    // Note: input.room_id is already the actual room UUID from webhook handler
    
    // 2. Save message to database
    const id = uuidv4();
  const replyTo = input.metadata?.reply_to || null;
    const reactionEmoji = input.metadata?.reaction?.emoji || null;
    const reactionToWa = input.metadata?.reaction?.message_id || null;

    const messageData = {
      id,
      room_id: input.room_id,
      user_id: input.user_id, // null for customer messages from webhook
      content_type: input.content_type,
      content_text: input.content_text,
      wa_message_id: input.wa_message_id || null,
      reply_to_wa_message_id: replyTo,
      reaction_emoji: reactionEmoji,
      reaction_to_wa_message_id: reactionToWa,
      metadata: input.metadata || {},
      created_at: new Date().toISOString()
    };

    const { rows } = await insertMessage(messageData);
    const message = rows[0];

    logger.info({ 
      messageId: id,
      roomId: input.room_id,
      userId: input.user_id, // null for customer messages
      contentType: input.content_type,
      waMessageId: input.wa_message_id
    }, 'Incoming message saved to database');

    // 3. Emit to socket for real-time updates
    const socketPayload = {
      room_id: input.room_id,
      message
    };
    
    // Emit to room-specific channel (best practice for scalability)
    io.to(`room:${input.room_id}`).emit('room:new_message', socketPayload);
    
    // ALSO emit global event for backward compatibility with frontend
    io.emit('new_message', socketPayload);
    
    logger.info({ 
      messageId: id,
      roomId: input.room_id,
      events: ['room:new_message', 'new_message']
    }, '📡 Emitting new_message events via Socket.IO');

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

    // 6. Send auto-reply if it's a text message and we have customer phone
    if (input.content_type === 'text' && input.content_text && input.customer_phone) {
      try {
        const autoReply = await sendAutoReply(input.customer_phone, input.content_text);
        if (autoReply) {
          logger.info({ 
            roomId: input.room_id,
            customerPhone: input.customer_phone,
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
      userId: input.user_id,
      customerPhone: input.customer_phone
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
    const { rows: participants } = await getRoomParticipants(roomId);

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
      await deleteDeviceTokens(result.invalidTokens);
      logger.info({ count: result.invalidTokens.length }, 'Invalid device tokens removed');
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


