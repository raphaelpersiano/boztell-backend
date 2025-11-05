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
    
    // 1. Check if this is the first message in the room (for new_room_complete event)
    const { getMessagesByRoom } = await import('../db.js');
    const existingMessagesResult = await getMessagesByRoom(input.room_id);
    const isFirstMessage = !existingMessagesResult || existingMessagesResult.rows.length === 0;
    
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
      waMessageId: input.wa_message_id,
      messageFromDb: message
    }, 'Incoming message saved to database');

    // Verify message has required fields
    if (!message || !message.id) {
      logger.error({ 
        message,
        messageData,
        hasMessage: !!message,
        messageKeys: message ? Object.keys(message) : null
      }, 'ERROR: Message from database missing id field!');
      throw new Error('Message saved to database but missing id field');
    }

    // 3. Emit to socket for real-time updates
    const messagePayload = {
      // Ensure ALL fields are explicitly included with null fallback (not undefined)
      id: message.id,
      room_id: message.room_id,
      user_id: message.user_id || null,
      content_type: message.content_type,
      content_text: message.content_text || null,
      wa_message_id: message.wa_message_id || null,
      status: message.status || 'sent',
      reply_to_wa_message_id: message.reply_to_wa_message_id || null,
      reaction_emoji: message.reaction_emoji || null,
      reaction_to_wa_message_id: message.reaction_to_wa_message_id || null,
      status_timestamp: message.status_timestamp || null,
      // Media fields (explicitly null if not present)
      media_type: message.media_type || null,
      media_id: message.media_id || null,
      gcs_filename: message.gcs_filename || null,
      gcs_url: message.gcs_url || null,
      file_size: message.file_size || null,
      mime_type: message.mime_type || null,
      original_filename: message.original_filename || null,
      // Metadata (explicitly null if not present)
      metadata: message.metadata || null,
      created_at: message.created_at,
      updated_at: message.updated_at
    };
    
    // 3a. If this is the first message, emit new_room_complete event
    if (isFirstMessage && io) {
      try {
        // Get full room details with leads info
        const { getAllRoomsWithDetails } = await import('../db.js');
        const allRoomsResult = await getAllRoomsWithDetails();
        const roomDetail = allRoomsResult.rows.find(r => r.room_id === input.room_id);
        
        if (roomDetail) {
          const newRoomCompletePayload = {
            // Room data
            room_id: roomDetail.room_id,
            room_phone: roomDetail.room_phone,
            room_title: roomDetail.room_title || 'Personal',
            room_created_at: roomDetail.room_created_at,
            room_updated_at: roomDetail.room_updated_at,
            
            // Full leads info
            leads_id: roomDetail.leads_id || null,
            leads_info: roomDetail.leads_info || null,
            
            // First message as last_message
            last_message: {
              id: message.id,
              content_text: message.content_text,
              content_type: message.content_type,
              created_at: message.created_at,
              user_id: message.user_id,
              wa_message_id: message.wa_message_id
            },
            last_message_text: message.content_text,
            last_message_timestamp: message.created_at,
            last_message_type: message.content_type,
            
            // Counts
            unread_count: 1,
            message_count: 1,
            
            // Participants
            participants: roomDetail.participants || []
          };
          
          // Emit global event for all agents/admins to see new room with complete data
          io.emit('new_room_complete', newRoomCompletePayload);
          
          logger.info({ 
            roomId: input.room_id,
            phone: roomDetail.room_phone,
            customerName: roomDetail.leads_info?.name || roomDetail.room_title,
            firstMessageText: message.content_text
          }, '📡 Emitting new_room_complete event - new room with full data');
        }
      } catch (err) {
        logger.error({ err, roomId: input.room_id }, 'Failed to emit new_room_complete event');
        // Continue even if this fails - message will still be saved and other events emitted
      }
    }
    
    // 3b. Emit to room-specific channel (best practice for scalability)
    io.to(`room:${input.room_id}`).emit('room:new_message', messagePayload);
    
    // 3c. ALSO emit global event for existing rooms (backward compatibility)
    // Frontend expects message object directly, not wrapped
    io.emit('new_message', messagePayload);
    
    logger.info({ 
      messageId: message.id,
      roomId: input.room_id,
      isFirstMessage,
      hasId: !!messagePayload.id,
      socketPayloadKeys: Object.keys(messagePayload),
      events: isFirstMessage ? ['new_room_complete', 'room:new_message', 'new_message'] : ['room:new_message', 'new_message']
    }, '📡 Emitting message events via Socket.IO');

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


