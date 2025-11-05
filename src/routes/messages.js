import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { sendTextMessage, sendMediaMessage, sendMediaByUrl, sendTemplateMessage, uploadMediaToWhatsApp, sendContactsMessage, sendLocationMessage, sendReactionMessage } from '../services/whatsappService.js';
import { validateWhatsAppPhoneNumber } from '../services/whatsappService.js';
import { uploadBuffer as uploadToStorage } from '../services/storageService.js';
import { ensureRoom } from '../services/roomService.js';
import { insertMessage, updateMessage } from '../db.js';
import { getUserForMessage } from '../services/userService.js';
import { logger } from '../utils/logger.js';
import { convertAudioToOgg, needsAudioConversion, getFFmpegFormat } from '../utils/audioConverter.js';

export function createMessagesRouter(io) {
  const router = express.Router();

/**
 * Get messages for a room (historical messages)
 * GET /messages/room/:roomId
 * Query params: limit (default 50), offset (default 0), order (asc/desc, default desc)
 */
router.get('/room/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const order = req.query.order === 'asc' ? 'ASC' : 'DESC';
    
    if (!roomId) {
      return res.status(400).json({ error: 'Room ID required' });
    }
    
    const { getMessagesByRoom } = await import('../db.js');
    const result = await getMessagesByRoom(roomId, limit, offset, order);
    
    logger.info({ 
      room_id: roomId,
      message_count: result.rows.length,
      limit,
      offset,
      order
    }, 'Fetched messages for room');
    
    res.json({
      success: true,
      room_id: roomId,
      messages: result.rows,
      count: result.rows.length,
      limit,
      offset,
      order,
      has_more: result.rows.length === limit // If we got exactly limit, there might be more
    });
    
  } catch (err) {
    logger.error({ err, roomId: req.params.roomId }, 'Failed to fetch messages for room');
    res.status(500).json({
      error: 'Failed to fetch messages',
      message: err.message
    });
  }
});

// Configure multer for media uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max (WhatsApp limit: 16MB for most, 100MB for documents)
  },
  fileFilter: (req, file, cb) => {
    // WhatsApp supported media types
    // Audio formats that need conversion will be auto-converted to OGG with OPUS codec
    const allowedTypes = [
      // Images
      'image/jpeg', 'image/png', 'image/webp',
      // Videos
      'video/mp4', 'video/3gpp',
      // Audio - Natively supported by WhatsApp (NO conversion needed):
      'audio/aac',      // ✅ AAC - Supported
      'audio/mp4',      // ✅ MP4 audio - Supported
      'audio/mpeg',     // ✅ MP3 - Supported
      'audio/amr',      // ✅ AMR - Supported
      'audio/ogg',      // ✅ OGG (must be OPUS codec) - Supported
      // Audio - Will be auto-converted to OGG (OPUS codec):
      'audio/webm',     // 🔄 Will convert to OGG (OPUS)
      // Documents
      'application/pdf', 'application/vnd.ms-powerpoint', 'application/msword',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported media type: ${file.mimetype}. Supported formats: Images (JPEG, PNG, WebP), Videos (MP4, 3GPP), Audio (AAC, MP4, MP3, AMR, OGG-OPUS, WebM - auto-converted), Documents (PDF, Office files)`), false);
    }
  }
});

/**
 * Helper function to validate user_id - REQUIRED for all outgoing messages
 */
async function validateUserId(user_id, required = true) {
  try {
    // user_id is REQUIRED for all outgoing messages (agents/admin send messages)
    if (!user_id && required) {
      throw new Error('user_id is required for all outgoing messages. Only agents/admin can send messages.');
    }
    
    // If no user_id provided and not required, it's a customer message (null)
    if (!user_id) {
      return null;
    }
    
    // Validate that user exists in database
    const user = await getUserForMessage(user_id);
    if (!user) {
      throw new Error(`User not found for user_id: ${user_id}`);
    }
    
    return user_id;
    
  } catch (error) {
    logger.error({ err: error, user_id }, 'Error validating user_id');
    throw error;
  }
}

/**
 * Helper function to ensure room and get room ID
 */
async function ensureRoomAndGetId(phone, metadata = {}) {
  const room = await ensureRoom(phone, { phone, ...metadata });
  return room.id;
}

/**
 * Send text message to WhatsApp
 * POST /messages/send
 */
router.post('/send', async (req, res) => {
  try {
    const { to, text, room_id, user_id, ...options } = req.body;
    
    // REQUIRED: Validate user_id for all outgoing messages
    if (!user_id) {
      return res.status(400).json({ 
        error: 'user_id is required for all outgoing messages. Only agents/admin can send messages.',
        required_fields: ['to', 'text', 'room_id', 'user_id']
      });
    }
    const validatedUserId = await validateUserId(user_id, true);
    
    if (!to || !text || !room_id) {
      return res.status(400).json({ 
        error: 'Missing required fields: to, text, room_id' 
      });
    }
    
    // Validate phone number
    const cleanPhone = validateWhatsAppPhoneNumber(to);
    
    // Extract contextual reply if provided
    const ctx = req.body.context;
    let replyTo = options.replyTo || null;
    if (ctx) {
      if (typeof ctx === 'string') replyTo = ctx;
      else if (typeof ctx === 'object' && ctx.message_id) replyTo = ctx.message_id;
    }
    
    // Use room_id from frontend directly
    const roomId = room_id;

    // 1) Send to WhatsApp first to get message ID
    let result;
    try {
      result = await sendTextMessage(cleanPhone, text, { ...options, replyTo });
    } catch (sendErr) {
      logger.error({ err: sendErr, to: cleanPhone, text }, 'Failed to send text message to WhatsApp');
      throw new Error(`WhatsApp send failed: ${sendErr.message}`);
    }

    // 2) Get WhatsApp message ID from response
    const waMessageId = result.messages?.[0]?.id || null;
    
    // 3) Insert to database with WhatsApp message ID already included
    const messageId = uuidv4();
    const baseMeta = { direction: 'outgoing', source: 'api', type: 'text' };
    if (replyTo) baseMeta.reply_to = replyTo;
    
    const messageData = {
      id: messageId,
      room_id: roomId,
      user_id: validatedUserId,
      content_type: 'text',
      content_text: text,
      media_type: null,
      media_id: null,
      gcs_filename: null,
      gcs_url: null,
      file_size: null,
      mime_type: null,
      original_filename: null,
      wa_message_id: waMessageId, // Insert with WhatsApp message ID directly
      reply_to_wa_message_id: replyTo || null,
      metadata: baseMeta,
      created_at: new Date().toISOString()
    };
    
    try {
      await insertMessage(messageData);
    } catch (insertErr) {
      logger.error({ err: insertErr, messageId, waMessageId, to: cleanPhone }, 'Failed to insert text message to database (message already sent to WhatsApp)');
      // Don't throw error here since WhatsApp message was sent successfully
    }

    logger.info({ to: cleanPhone, messageId, waMessageId }, 'Text message sent to WhatsApp and saved to database');

    // Emit Socket.IO event for real-time updates with explicit null fallbacks
    if (io) {
      const messagePayload = {
        id: messageId,
        room_id: roomId,
        user_id: validatedUserId,
        content_type: 'text',
        content_text: text,
        wa_message_id: waMessageId || null,
        status: 'sent',
        status_timestamp: messageData.created_at,
        reply_to_wa_message_id: replyTo || null,
        reaction_emoji: null,
        reaction_to_wa_message_id: null,
        media_type: null,
        media_id: null,
        gcs_filename: null,
        gcs_url: null,
        file_size: null,
        mime_type: null,
        original_filename: null,
        metadata: baseMeta || null,
        created_at: messageData.created_at,
        updated_at: messageData.created_at
      };
      
      // Emit message object directly (not wrapped)
      io.to(`room:${roomId}`).emit('room:new_message', messagePayload);
      io.emit('new_message', messagePayload);
      
      logger.info({ 
        messageId, 
        roomId: roomId,
        userId: validatedUserId,
        hasId: !!messagePayload.id,
        payloadKeys: Object.keys(messagePayload)
      }, '📡 Emitting new_message events for agent message');
    }

    res.json({
      success: true,
      to: cleanPhone,
      type: 'text',
      message_id: messageId,
      whatsapp_message_id: waMessageId,
      result
    });
    
  } catch (err) {
    logger.error({ err, body: req.body }, 'Failed to send WhatsApp text message');
    
    if (err.message.includes('Invalid phone number')) {
      return res.status(400).json({ error: err.message });
    }
    
    res.status(500).json({ 
      error: 'Failed to send text message',
      message: err.message 
    });
  }
});

/**
 * Send contacts message
 * POST /messages/send-contacts
 * body: { to, contacts: [...], room_id, replyTo?, user_id?, sender_name? }
 */
router.post('/send-contacts', async (req, res) => {
  try {
    const { to, contacts, room_id, replyTo, user_id } = req.body;
    
    // REQUIRED: Validate user_id for all outgoing messages
    if (!user_id) {
      return res.status(400).json({ 
        error: 'user_id is required for all outgoing messages. Only agents/admin can send contacts.',
        required_fields: ['to', 'contacts', 'room_id', 'user_id']
      });
    }
    const validatedUserId = await validateUserId(user_id, true);
    if (!to || !Array.isArray(contacts) || contacts.length === 0 || !room_id) {
      return res.status(400).json({ error: 'to, room_id and contacts[] required' });
    }
    const cleanPhone = validateWhatsAppPhoneNumber(to);
    const contactsRoomId = room_id;

    // 1) Send to WhatsApp first to get message ID
    let result;
    try {
      result = await sendContactsMessage(cleanPhone, contacts, { replyTo });
    } catch (sendErr) {
      logger.error({ err: sendErr, to: cleanPhone, contacts }, 'Failed to send contacts message to WhatsApp');
      throw new Error(`WhatsApp send failed: ${sendErr.message}`);
    }

    // 2) Get WhatsApp message ID from response
    const waMessageId = result.messages?.[0]?.id || null;
    
    // 3) Insert to database with WhatsApp message ID already included
    const messageId = uuidv4();
    const meta = { direction: 'outgoing', source: 'api', type: 'contacts' };
    if (replyTo) meta.reply_to = replyTo;
    
    const messageData = {
      id: messageId,
      room_id: contactsRoomId,
      user_id: validatedUserId,
      content_type: 'contacts',
      content_text: `contacts:${contacts.length}`,
      media_type: null,
      media_id: null,
      gcs_filename: null,
      gcs_url: null,
      file_size: null,
      mime_type: null,
      original_filename: null,
      wa_message_id: waMessageId, // Insert with WhatsApp message ID directly
      reply_to_wa_message_id: replyTo || null,
      metadata: meta,
      created_at: new Date().toISOString()
    };
    
    try {
      await insertMessage(messageData);
    } catch (insertErr) {
      logger.error({ err: insertErr, messageId, waMessageId, to: cleanPhone }, 'Failed to insert contacts message to database (message already sent to WhatsApp)');
      // Don't throw error here since WhatsApp message was sent successfully
    }

    // Emit Socket.IO event
    if (io) {
      const messagePayload = {
        id: messageId,
        room_id: contactsRoomId,
        user_id: validatedUserId,
        content_type: 'contacts',
        content_text: `contacts:${contacts.length}`,
        wa_message_id: waMessageId,
        status: 'sent',
        status_timestamp: messageData.created_at,
        reply_to_wa_message_id: replyTo || null,
        reaction_emoji: null,
        reaction_to_wa_message_id: null,
        media_type: null,
        media_id: null,
        gcs_filename: null,
        gcs_url: null,
        file_size: null,
        mime_type: null,
        original_filename: null,
        metadata: meta,
        created_at: messageData.created_at,
        updated_at: messageData.created_at
      };
      
      io.to(`room:${contactsRoomId}`).emit('room:new_message', messagePayload);
      io.emit('new_message', messagePayload);
      
      logger.info({ messageId, roomId: contactsRoomId }, '📡 Emitting new_message events for contacts');
    }

    logger.info({ to: cleanPhone, messageId, waMessageId, contactsCount: contacts.length }, 'Contacts message sent to WhatsApp and saved to database');

    res.json({ success: true, to: cleanPhone, type: 'contacts', message_id: messageId, whatsapp_message_id: waMessageId, result });
  } catch (err) {
    if (err._messageId) return res.status(500).json({ error: 'Failed to send contacts', message: err.message, message_id: err._messageId });
    res.status(500).json({ error: 'Failed to send contacts', message: err.message });
  }
});

/**
 * Send location message
 * POST /messages/send-location
 * body: { to, location: { latitude, longitude, name?, address? }, room_id, replyTo?, user_id?, sender_name? }
 */
router.post('/send-location', async (req, res) => {
  try {
    const { to, location, room_id, replyTo, user_id } = req.body;
    
    // REQUIRED: Validate user_id for all outgoing messages
    if (!user_id) {
      return res.status(400).json({ 
        error: 'user_id is required for all outgoing messages. Only agents/admin can send location.',
        required_fields: ['to', 'location', 'room_id', 'user_id']
      });
    }
    const validatedUserId = await validateUserId(user_id, true);
    if (!to || !location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number' || !room_id) {
      return res.status(400).json({ error: 'to, room_id and location.latitude/longitude required' });
    }
    const cleanPhone = validateWhatsAppPhoneNumber(to);
    const locationRoomId = room_id;

    // 1) Send to WhatsApp first to get message ID
    let result;
    try {
      result = await sendLocationMessage(cleanPhone, location, { replyTo });
    } catch (sendErr) {
      logger.error({ err: sendErr, to: cleanPhone, location }, 'Failed to send location message to WhatsApp');
      throw new Error(`WhatsApp send failed: ${sendErr.message}`);
    }

    // 2) Get WhatsApp message ID from response
    const waMessageId = result.messages?.[0]?.id || null;
    
    // 3) Insert to database with WhatsApp message ID already included
    const messageId = uuidv4();
    const meta = { direction: 'outgoing', source: 'api', type: 'location', location };
    if (replyTo) meta.reply_to = replyTo;
    
    const messageData = {
      id: messageId,
      room_id: locationRoomId,
      user_id: validatedUserId,
      content_type: 'location',
      content_text: `Location: ${location.latitude}, ${location.longitude}`,
      media_type: null,
      media_id: null,
      gcs_filename: null,
      gcs_url: null,
      file_size: null,
      mime_type: null,
      original_filename: null,
      wa_message_id: waMessageId, // Insert with WhatsApp message ID directly
      reply_to_wa_message_id: replyTo || null,
      metadata: meta,
      created_at: new Date().toISOString()
    };
    
    try {
      await insertMessage(messageData);
    } catch (insertErr) {
      logger.error({ err: insertErr, messageId, waMessageId, to: cleanPhone }, 'Failed to insert location message to database (message already sent to WhatsApp)');
      // Don't throw error here since WhatsApp message was sent successfully
    }

    // Emit Socket.IO event
    if (io) {
      const messagePayload = {
        id: messageId,
        room_id: locationRoomId,
        user_id: validatedUserId,
        content_type: 'location',
        content_text: `Location: ${location.latitude}, ${location.longitude}`,
        wa_message_id: waMessageId,
        status: 'sent',
        status_timestamp: messageData.created_at,
        reply_to_wa_message_id: replyTo || null,
        reaction_emoji: null,
        reaction_to_wa_message_id: null,
        media_type: null,
        media_id: null,
        gcs_filename: null,
        gcs_url: null,
        file_size: null,
        mime_type: null,
        original_filename: null,
        metadata: meta,
        created_at: messageData.created_at,
        updated_at: messageData.created_at
      };
      
      io.to(`room:${locationRoomId}`).emit('room:new_message', messagePayload);
      io.emit('new_message', messagePayload);
      
      logger.info({ messageId, roomId: locationRoomId }, '📡 Emitting new_message events for location');
    }

    logger.info({ to: cleanPhone, messageId, waMessageId, location }, 'Location message sent to WhatsApp and saved to database');

    res.json({ success: true, to: cleanPhone, type: 'location', message_id: messageId, whatsapp_message_id: waMessageId, result });
  } catch (err) {
    if (err._messageId) return res.status(500).json({ error: 'Failed to send location', message: err.message, message_id: err._messageId });
    res.status(500).json({ error: 'Failed to send location', message: err.message });
  }
});

/**
 * Send reaction to a message
 * POST /messages/send-reaction
 * body: { to, message_id, emoji, room_id }
 */
router.post('/send-reaction', async (req, res) => {
  try {
    const { to, message_id, emoji, room_id, user_id } = req.body;
    
    // REQUIRED: Validate user_id for all outgoing messages
    if (!user_id) {
      return res.status(400).json({ 
        error: 'user_id is required for all outgoing messages. Only agents/admin can send reactions.',
        required_fields: ['to', 'message_id', 'emoji', 'room_id', 'user_id']
      });
    }
    const validatedUserId = await validateUserId(user_id, true);
    if (!to || !message_id || !emoji || !room_id) {
      return res.status(400).json({ error: 'to, message_id, emoji, and room_id are required' });
    }
    const cleanPhone = validateWhatsAppPhoneNumber(to);
    const reactionRoomId = room_id;

    // 1) Send to WhatsApp first to get message ID
    let result;
    try {
      result = await sendReactionMessage(cleanPhone, message_id, emoji);
    } catch (sendErr) {
      logger.error({ err: sendErr, to: cleanPhone, message_id, emoji }, 'Failed to send reaction message to WhatsApp');
      throw new Error(`WhatsApp send failed: ${sendErr.message}`);
    }

    // 2) Get WhatsApp message ID from response
    const waMessageId = result.messages?.[0]?.id || null;
    
    // 3) Insert to database with WhatsApp message ID already included
    const messageId = uuidv4();
    const meta = { direction: 'outgoing', source: 'api', type: 'reaction', reaction: { emoji, message_id } };
    
    const messageData = {
      id: messageId,
      room_id: reactionRoomId,
      user_id: validatedUserId,
      content_type: 'reaction',
      content_text: `Reaction ${emoji} to ${message_id}`,
      media_type: null,
      media_id: null,
      gcs_filename: null,
      gcs_url: null,
      file_size: null,
      mime_type: null,
      original_filename: null,
      wa_message_id: waMessageId, // Insert with WhatsApp message ID directly
      reaction_emoji: emoji,
      reaction_to_wa_message_id: message_id,
      metadata: meta,
      created_at: new Date().toISOString()
    };
    
    try {
      await insertMessage(messageData);
    } catch (insertErr) {
      logger.error({ err: insertErr, messageId, waMessageId, to: cleanPhone }, 'Failed to insert reaction message to database (message already sent to WhatsApp)');
      // Don't throw error here since WhatsApp message was sent successfully
    }

    // Emit Socket.IO event
    if (io) {
      const messagePayload = {
        id: messageId,
        room_id: reactionRoomId,
        user_id: validatedUserId,
        content_type: 'reaction',
        content_text: `Reaction ${emoji} to ${message_id}`,
        wa_message_id: waMessageId,
        status: 'sent',
        status_timestamp: messageData.created_at,
        reply_to_wa_message_id: null,
        reaction_emoji: emoji,
        reaction_to_wa_message_id: message_id,
        media_type: null,
        media_id: null,
        gcs_filename: null,
        gcs_url: null,
        file_size: null,
        mime_type: null,
        original_filename: null,
        metadata: meta,
        created_at: messageData.created_at,
        updated_at: messageData.created_at
      };
      
      io.to(`room:${reactionRoomId}`).emit('room:new_message', messagePayload);
      io.emit('new_message', messagePayload);
      
      logger.info({ messageId, roomId: reactionRoomId }, '📡 Emitting new_message events for reaction');
    }

    logger.info({ to: cleanPhone, messageId, waMessageId, emoji, reactionTo: message_id }, 'Reaction message sent to WhatsApp and saved to database');

    res.json({ success: true, to: cleanPhone, type: 'reaction', message_id: messageId, whatsapp_message_id: waMessageId, result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send reaction', message: err.message });
  }
});

/**
 * Send media message to WhatsApp
 * POST /messages/send-media
 */
router.post('/send-media', async (req, res) => {
  try {
    const { to, mediaType, mediaId, mediaUrl, caption, filename, room_id, replyTo, user_id } = req.body;
    
    // REQUIRED: user_id for all outgoing messages
    if (!user_id) {
      return res.status(400).json({ 
        error: 'user_id is required for all outgoing messages. Only agents/admin can send media.',
        required_fields: ['to', 'mediaType', 'room_id', 'user_id']
      });
    }
    
    // Validate user_id
    const validatedUserId = await validateUserId(user_id, true);
    
    if (!to || !mediaType || !room_id) {
      return res.status(400).json({ 
        error: 'Missing required fields: to, mediaType, room_id, user_id' 
      });
    }
    
    if (!mediaId && !mediaUrl) {
      return res.status(400).json({ 
        error: 'Either mediaId or mediaUrl is required' 
      });
    }
    
    const cleanPhone = validateWhatsAppPhoneNumber(to);
    
    // Use room_id from frontend directly
    const roomId = room_id;
    
    let result;
    
    if (mediaId) {
      // Send using WhatsApp media ID
      result = await sendMediaMessage(cleanPhone, mediaType, mediaId, {
        caption,
        filename,
        replyTo
      });
    } else {
      // Send using URL
      result = await sendMediaByUrl(cleanPhone, mediaType, mediaUrl, {
        caption,
        filename,
        replyTo
      });
    }
    
    const waMessageId = result.messages?.[0]?.id || null;
    
    // Save to database
    const messageId = uuidv4();
    const messageData = {
      id: messageId,
      room_id: roomId,
      user_id: validatedUserId,
      content_type: 'media',
      content_text: caption || null,
      media_type: mediaType,
      media_id: mediaId || null,
      gcs_filename: null,
      gcs_url: mediaUrl || null,
      file_size: null,
      mime_type: null,
      original_filename: filename || null,
      wa_message_id: waMessageId,
      reply_to_wa_message_id: replyTo || null,
      reaction_emoji: null,
      reaction_to_wa_message_id: null,
      metadata: {
        direction: 'outgoing',
        source: 'api',
        type: 'media',
        media_source: mediaId ? 'whatsapp_media_id' : 'url'
      },
      created_at: new Date().toISOString()
    };
    
    try {
      await insertMessage(messageData);
      logger.info({ messageId, waMessageId, roomId: roomId }, 'Media message saved to database');
    } catch (insertErr) {
      logger.error({ err: insertErr, messageId, waMessageId }, 'Failed to insert media message to database (message already sent to WhatsApp)');
    }
    
    // Emit Socket.IO event
    if (io) {
      const messagePayload = {
        id: messageId,
        room_id: roomId,
        user_id: validatedUserId,
        content_type: 'media',
        content_text: caption || null,
        media_type: mediaType,
        media_id: mediaId || null,
        gcs_filename: null,
        gcs_url: mediaUrl || null,
        file_size: null,
        mime_type: null,
        original_filename: filename || null,
        wa_message_id: waMessageId,
        status: 'sent',
        status_timestamp: messageData.created_at,
        reply_to_wa_message_id: replyTo || null,
        reaction_emoji: null,
        reaction_to_wa_message_id: null,
        metadata: messageData.metadata,
        created_at: messageData.created_at,
        updated_at: messageData.created_at
      };
      
      io.to(`room:${roomId}`).emit('room:new_message', messagePayload);
      io.emit('new_message', messagePayload);
      
      logger.info({ messageId, roomId: roomId }, '📡 Emitting new_message events for media');
    }
    
    logger.info({ 
      to: cleanPhone, 
      mediaType,
      mediaId: mediaId || 'url',
      messageId,
      waMessageId 
    }, 'Media message sent to WhatsApp and saved to database');
    
    res.json({
      success: true,
      to: cleanPhone,
      mediaType,
      mediaId: mediaId || null,
      mediaUrl: mediaUrl || null,
      message_id: messageId,
      whatsapp_message_id: waMessageId,
      result
    });
    
  } catch (err) {
    logger.error({ err, body: req.body }, 'Failed to send WhatsApp media message');
    res.status(500).json({ 
      error: 'Failed to send media message',
      message: err.message 
    });
  }
});

/**
 * Upload and send media to WhatsApp in one request
 * POST /messages/send-media-file
 * 
 * Caption Support by Media Type:
 * - Image: ✅ Caption supported natively by WhatsApp
 * - Video: ✅ Caption supported natively by WhatsApp  
 * - Audio: ❌ Caption not supported (ignored by WhatsApp)
 * - Document: ⚠️ Caption supported but may not display in all clients
 */
router.post('/send-media-file', upload.single('media'), async (req, res) => {
  try {
    const { to, caption, room_id, replyTo, user_id } = req.body;
    
    // REQUIRED: Validate user_id for all outgoing messages
    if (!user_id) {
      return res.status(400).json({ 
        error: 'user_id is required for all outgoing messages. Only agents/admin can send media.',
        required_fields: ['to', 'media', 'room_id', 'user_id']
      });
    }
    
    if (!to || !room_id) {
      return res.status(400).json({ error: 'Phone number (to) and room_id required' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'Media file required' });
    }
    
    const validatedUserId = await validateUserId(user_id, true);
    
    const cleanPhone = validateWhatsAppPhoneNumber(to);
    const { buffer, originalname, mimetype } = req.file;
    
    // Determine media type based on MIME type
    let mediaType;
    if (mimetype.startsWith('image/')) {
      mediaType = 'image';
    } else if (mimetype.startsWith('video/')) {
      mediaType = 'video';
    } else if (mimetype.startsWith('audio/')) {
      mediaType = 'audio';
    } else {
      mediaType = 'document';
    }
    
    // Use room_id from frontend directly
    const roomId = room_id;
    
    // 1. Upload media to WhatsApp
    const uploadResult = await uploadMediaToWhatsApp({
      buffer,
      filename: originalname,
      mimeType: mimetype
    });
    
    // 2. Send media message
    const sendResult = await sendMediaMessage(cleanPhone, mediaType, uploadResult.id, {
      caption,
      filename: originalname,
      replyTo
    });
    
    const waMessageId = sendResult.messages?.[0]?.id || null;
    
    // 2.5. Save media message to database
    const mediaMessageId = uuidv4();
    const mediaMessageData = {
      id: mediaMessageId,
      room_id: roomId,
      user_id: validatedUserId,
      content_type: 'media',
      content_text: caption || null,
      media_type: mediaType,
      media_id: uploadResult.id,
      gcs_filename: null,
      gcs_url: null,
      file_size: buffer.length,
      mime_type: mimetype,
      original_filename: originalname,
      wa_message_id: waMessageId,
      reply_to_wa_message_id: replyTo || null,
      reaction_emoji: null,
      reaction_to_wa_message_id: null,
      metadata: {
        direction: 'outgoing',
        source: 'api',
        type: 'media',
        upload_method: 'send-media-file'
      },
      created_at: new Date().toISOString()
    };
    
    try {
      await insertMessage(mediaMessageData);
      logger.info({ messageId: mediaMessageId, waMessageId, roomId: roomId }, 'Media message saved to database');
    } catch (insertErr) {
      logger.error({ err: insertErr, messageId: mediaMessageId, waMessageId }, 'Failed to insert media message to database (message already sent to WhatsApp)');
    }
    
    // Emit Socket.IO event for media message
    if (io) {
      const messagePayload = {
        id: mediaMessageId,
        room_id: roomId,
        user_id: validatedUserId,
        content_type: 'media',
        content_text: caption || null,
        media_type: mediaType,
        media_id: uploadResult.id,
        gcs_filename: null,
        gcs_url: null,
        file_size: buffer.length,
        mime_type: mimetype,
        original_filename: originalname,
        wa_message_id: waMessageId,
        status: 'sent',
        status_timestamp: mediaMessageData.created_at,
        reply_to_wa_message_id: replyTo || null,
        reaction_emoji: null,
        reaction_to_wa_message_id: null,
        metadata: mediaMessageData.metadata,
        created_at: mediaMessageData.created_at,
        updated_at: mediaMessageData.created_at
      };
      
      io.to(`room:${roomId}`).emit('room:new_message', messagePayload);
      io.emit('new_message', messagePayload);
      
      logger.info({ messageId: mediaMessageId, roomId: roomId }, '📡 Emitting new_message events for media file');
    }
    
    logger.info({ 
      to: cleanPhone,
      mediaType,
      filename: originalname,
      mediaId: uploadResult.id,
      mediaMessageId,
      waMessageId
    }, 'Media uploaded, sent to WhatsApp, and saved to database successfully');
    
    res.json({
      success: true,
      to: cleanPhone,
      mediaType,
      filename: originalname,
      size: buffer.length,
      message_id: mediaMessageId,
      whatsapp_media_id: uploadResult.id,
      whatsapp_message_id: waMessageId,
      upload: uploadResult,
      send: sendResult
    });
    
  } catch (err) {
    logger.error({ err, body: req.body }, 'Failed to upload and send media to WhatsApp');
    
    if (err.message.includes('Unsupported media type')) {
      return res.status(400).json({ error: err.message });
    }
    
    res.status(500).json({ 
      error: 'Failed to upload and send media',
      message: err.message 
    });
  }
});

/**
 * Combined flow: upload to Supabase Storage + persist DB + upload to WhatsApp + send to WhatsApp
 * POST /messages/send-media-combined
 * Form fields: media (file), to (phone), room_id (required), caption (optional), user_id (required)
 * 
 * Caption Support by Media Type:
 * - Image: ✅ Caption supported natively by WhatsApp
 * - Video: ✅ Caption supported natively by WhatsApp  
 * - Audio: ❌ Caption not supported (ignored by WhatsApp)
 * - Document: ⚠️ Caption supported but may not display in all clients
 */
router.post('/send-media-combined', upload.single('media'), async (req, res) => {
  try {
    const { to, caption = '', room_id, replyTo, user_id } = req.body;
    
    // REQUIRED: Validate user_id for all outgoing messages
    if (!user_id) {
      return res.status(400).json({ 
        error: 'user_id is required for all outgoing messages. Only agents/admin can send media.',
        required_fields: ['to', 'media', 'room_id', 'user_id']
      });
    }
    
    // Validate user_id and other required fields
    const validatedUserId = await validateUserId(user_id, true);

    if (!to || !room_id) {
      return res.status(400).json({ error: 'Phone number (to) and room_id required' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Media file required (field name: media)' });
    }

    const cleanPhone = validateWhatsAppPhoneNumber(to);
    const { buffer, originalname, mimetype } = req.file;

    // Determine WhatsApp media type
    let mediaType;
    if (mimetype.startsWith('image/')) mediaType = 'image';
    else if (mimetype.startsWith('video/')) mediaType = 'video';
    else if (mimetype.startsWith('audio/')) mediaType = 'audio';
    else mediaType = 'document';

    // Auto-convert unsupported audio formats to OGG with OPUS codec (WhatsApp requirement)
    let processedBuffer = buffer;
    let processedMimetype = mimetype;
    let processedFilename = originalname;
    let conversionPerformed = false;

    if (mediaType === 'audio' && needsAudioConversion(mimetype)) {
      logger.info({ 
        originalFormat: mimetype,
        originalSize: buffer.length,
        filename: originalname
      }, '🔄 Audio format not supported by WhatsApp - converting to OGG with OPUS codec');

      try {
        const ffmpegFormat = getFFmpegFormat(mimetype);
        processedBuffer = await convertAudioToOgg(buffer, ffmpegFormat);
        processedMimetype = 'audio/ogg';
        processedFilename = originalname.replace(/\.[^.]+$/, '.ogg');
        conversionPerformed = true;

        logger.info({ 
          originalFormat: mimetype,
          originalSize: buffer.length,
          convertedFormat: 'audio/ogg (OPUS codec)',
          convertedSize: processedBuffer.length,
          compressionRatio: ((1 - processedBuffer.length / buffer.length) * 100).toFixed(2) + '%',
          newFilename: processedFilename
        }, '✅ Audio conversion to OGG (OPUS codec) successful');

      } catch (conversionErr) {
        logger.error({ 
          err: conversionErr, 
          mimetype, 
          filename: originalname 
        }, '❌ Audio conversion to OGG (OPUS codec) failed - rejecting upload');
        
        throw new Error(`Audio conversion to OGG (OPUS codec) failed: ${conversionErr.message}. Original format: ${mimetype}`);
      }
    }

    // Use room_id from frontend directly
    const mediaRoomId = room_id;
    
    logger.info({ 
      to: cleanPhone, 
      filename: processedFilename, 
      size: processedBuffer.length, 
      mimetype: processedMimetype,
      conversionPerformed 
    }, '🚀 Starting OPTIMIZED combined media flow with parallel uploads');

    let supabaseStorage, messageId, waUpload, sendResult;

    try {
      // OPTIMIZATION: Run Supabase Storage upload and WhatsApp upload in PARALLEL
      logger.info('⚡ Starting parallel uploads (Supabase Storage + WhatsApp)...');
      
      const [supabaseResult, waUploadResult] = await Promise.allSettled([
        // 1) Upload to Supabase Storage (backup) - non-blocking
        uploadToStorage({
          buffer: processedBuffer,
          filename: processedFilename,
          contentType: processedMimetype,
          folder: 'whatsapp-media',
          roomId: cleanPhone,
          phoneNumber: cleanPhone
        }),
        
        // 2) Upload media to WhatsApp (critical path)
        uploadMediaToWhatsApp({
          buffer: processedBuffer,
          filename: processedFilename,
          mimeType: processedMimetype
        })
      ]);

      // Check WhatsApp upload result (CRITICAL - must succeed)
      if (waUploadResult.status === 'rejected') {
        logger.error({ err: waUploadResult.reason }, '❌ WhatsApp upload FAILED');
        throw new Error(`WhatsApp upload failed: ${waUploadResult.reason.message}`);
      }
      
      waUpload = waUploadResult.value;
      logger.info({ 
        mediaId: waUpload.id, 
        filename: processedFilename,
        converted: conversionPerformed
      }, '✅ WhatsApp upload successful');

      // Check Supabase Storage result (NON-CRITICAL - log warning if fails)
      if (supabaseResult.status === 'fulfilled') {
        supabaseStorage = supabaseResult.value;
        logger.info({ 
          filename: supabaseStorage.gcsFilename,
          url: supabaseStorage.url,
          size: supabaseStorage.size,
          converted: conversionPerformed
        }, '✅ Supabase Storage backup successful');
      } else {
        logger.warn({ 
          err: supabaseResult.reason,
          filename: processedFilename 
        }, '⚠️ Supabase Storage backup FAILED - continuing without backup (WhatsApp still works)');
        
        // Set fallback values for Supabase Storage fields
        supabaseStorage = {
          gcsFilename: null,
          url: null,
          size: processedBuffer.length
        };
      }

      // 3) Send WhatsApp message using media ID
      logger.info({ mediaId: waUpload.id }, '📤 Sending WhatsApp message...');
      
      sendResult = await sendMediaMessage(cleanPhone, mediaType, waUpload.id, {
        caption: caption || '',
        filename: processedFilename,
        replyTo
      });
      
      // CRITICAL: Validate WhatsApp send result
      if (!sendResult || !sendResult.messages || sendResult.messages.length === 0) {
        logger.error({ 
          sendResult,
          mediaId: waUpload.id,
          to: cleanPhone,
          mediaType
        }, '❌ WhatsApp send failed - no messages in response');
        throw new Error('WhatsApp send failed: No messages in response');
      }
      
      const waMessageId = sendResult.messages?.[0]?.id || null;
      
      if (!waMessageId) {
        logger.error({ 
          sendResult,
          mediaId: waUpload.id,
          to: cleanPhone
        }, '❌ WhatsApp send failed - no message ID in response');
        throw new Error('WhatsApp send failed: No message ID returned');
      }
      
      logger.info({ 
        waMessageId, 
        mediaId: waUpload.id,
        to: cleanPhone,
        converted: conversionPerformed,
        sendResultFull: sendResult
      }, '✅ WhatsApp message sent successfully');

      // 4) Create DB row with ALL data at once (optimized - single query)
      messageId = uuidv4();
      
      const metadata = {
        direction: 'outgoing',
        source: 'api',
        filename: originalname,
        upload_step: 'complete',
        whatsapp_media_id: waUpload.id,
        whatsapp_message_id: waMessageId,
        ...(conversionPerformed && {
          audio_conversion: {
            original_format: mimetype,
            original_filename: originalname,
            original_size: buffer.length,
            converted_format: processedMimetype,
            converted_filename: processedFilename,
            converted_size: processedBuffer.length
          }
        })
      };
      
      const storedName = (supabaseStorage.gcsFilename || '').split('/').pop() || processedFilename;
      
      const messageData = {
        id: messageId,
        room_id: mediaRoomId,
        user_id: validatedUserId,
        content_type: 'media',
        content_text: caption || null,
        media_type: mediaType,
        media_id: waUpload.id, // Already have media ID
        gcs_filename: supabaseStorage.gcsFilename,
        gcs_url: supabaseStorage.url,
        file_size: supabaseStorage.size,
        mime_type: processedMimetype, // Store converted MIME type
        original_filename: storedName,
        wa_message_id: waMessageId, // Already have message ID
        status: null,
        status_timestamp: null,
        reply_to_wa_message_id: replyTo || null,
        reaction_emoji: null,
        reaction_to_wa_message_id: null,
        metadata: metadata,
        created_at: new Date().toISOString()
      };
      
      logger.info({ 
        messageData,
        fieldTypes: {
          id: typeof messageData.id,
          room_id: typeof messageData.room_id,
          user_id: typeof messageData.user_id,
          content_type: typeof messageData.content_type,
          content_text: typeof messageData.content_text,
          media_type: typeof messageData.media_type,
          media_id: typeof messageData.media_id,
          wa_message_id: typeof messageData.wa_message_id,
          metadata: typeof messageData.metadata,
          metadataIsObject: messageData.metadata !== null && typeof messageData.metadata === 'object',
          metadataKeys: messageData.metadata ? Object.keys(messageData.metadata) : null
        }
      }, '💾 About to insert message to database - DETAILED DEBUG');
      
      try {
        logger.info({ messageId, step: 'before_insert' }, '🔍 Starting database insert...');
        await insertMessage(messageData);
        logger.info({ messageId, step: 'after_insert' }, '✅ Database insert successful');
      } catch (insertErr) {
        logger.error({ 
          err: insertErr,
          errMessage: insertErr.message,
          errStack: insertErr.stack,
          errCode: insertErr.code,
          messageData,
          step: 'database_insert_failed'
        }, '❌ CRITICAL: Database insert FAILED - but WhatsApp message already sent');
        
        // Don't throw - WhatsApp message already sent successfully
        // Just log the error and continue with response
      }
      
      logger.info({ 
        messageId, 
        room_id: cleanPhone, 
        mediaId: waUpload.id,
        waMessageId,
        hasSupabaseBackup: !!supabaseStorage?.url
      }, '✅ Message record created in database with complete data');

      // Emit Socket.IO event
      if (io) {
        const messagePayload = {
          id: messageId,
          room_id: mediaRoomId,
          user_id: validatedUserId,
          content_type: 'media',
          content_text: caption || null,
          media_type: mediaType,
          media_id: waUpload.id,
          gcs_filename: supabaseStorage.gcsFilename,
          gcs_url: supabaseStorage.url,
          file_size: supabaseStorage.size,
          mime_type: processedMimetype, // Use converted MIME type
          original_filename: storedName,
          wa_message_id: waMessageId,
          status: 'sent',
          status_timestamp: messageData.created_at,
          reply_to_wa_message_id: replyTo || null,
          reaction_emoji: null,
          reaction_to_wa_message_id: null,
          metadata: metadata,
          created_at: messageData.created_at,
          updated_at: messageData.created_at
        };
        
        io.to(`room:${mediaRoomId}`).emit('room:new_message', messagePayload);
        io.emit('new_message', messagePayload);
        
        logger.info({ messageId, roomId: mediaRoomId }, '📡 Emitting new_message events for media combined');
      }

      logger.info({
        to: cleanPhone,
        mediaType,
        mediaId: waUpload.id,
        waMessageId,
        gcsFilename: supabaseStorage?.gcsFilename || 'backup_failed',
        gcsUrl: supabaseStorage?.url || null,
        messageId,
        audioConverted: conversionPerformed,
        supabaseBackupSuccess: !!supabaseStorage?.url,
        ...(conversionPerformed && {
          conversion: {
            from: mimetype,
            to: processedMimetype,
            originalSize: buffer.length,
            convertedSize: processedBuffer.length
          }
        })
      }, '🎉 OPTIMIZED combined media flow completed successfully (parallel uploads)');

      return res.json({
        success: true,
        to: cleanPhone,
        mediaType,
        filename: processedFilename, // Return converted filename
        size: processedBuffer.length, // Return converted size
        message_id: messageId,
        whatsapp_media_id: waUpload.id,
        whatsapp_message_id: waMessageId,
        storage_url: supabaseStorage?.url || null,
        storage_filename: supabaseStorage?.gcsFilename || null,
        storage_backup_success: !!supabaseStorage?.url,
        ...(conversionPerformed && {
          audio_conversion: {
            performed: true,
            original_format: mimetype,
            original_filename: originalname,
            original_size: buffer.length,
            converted_format: processedMimetype,
            converted_filename: processedFilename,
            converted_size: processedBuffer.length,
            compression_ratio: ((1 - processedBuffer.length / buffer.length) * 100).toFixed(2) + '%'
          }
        })
      });

    } catch (waErr) {
      logger.error({ 
        err: waErr, 
        errMessage: waErr.message,
        errStack: waErr.stack,
        filename: originalname,
        step: 'whatsapp_or_database'
      }, '❌ Failed in WhatsApp operations or database insert');
      throw new Error(`WhatsApp/Database operation failed: ${waErr.message}`);
    }

  } catch (err) {
    logger.error({ 
      err, 
      errMessage: err.message,
      errStack: err.stack,
      to: req.body.to,
      filename: req.file?.originalname,
      step: 'combined_media_flow',
      hasSupabaseStorage: !!supabaseStorage,
      hasMessageId: !!messageId,
      hasWaUpload: !!waUpload,
      hasSendResult: !!sendResult
    }, '❌❌❌ Combined media flow failed');
    
    return res.status(500).json({ 
      error: 'Failed to upload and send media', 
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      details: {
        step_completed: {
          storage_upload: !!supabaseStorage,
          database_insert: !!messageId,
          whatsapp_upload: !!waUpload,
          whatsapp_send: !!sendResult
        }
      }
    });
  }
});

/**
 * Upload media to WhatsApp (get media ID for later use)
 * POST /messages/upload-media
 */
router.post('/upload-media', upload.single('media'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Media file required' });
    }
    
    const { buffer, originalname, mimetype } = req.file;
    
    const result = await uploadMediaToWhatsApp({
      buffer,
      filename: originalname,
      mimeType: mimetype
    });
    
    logger.info({ 
      filename: originalname,
      mimeType: mimetype,
      mediaId: result.id 
    }, 'Media uploaded to WhatsApp for later use');
    
    res.json({
      success: true,
      filename: originalname,
      mimeType: mimetype,
      size: buffer.length,
      whatsapp_media_id: result.id,
      result
    });
    
  } catch (err) {
    logger.error({ err }, 'Failed to upload media to WhatsApp');
    
    if (err.message.includes('Unsupported media type')) {
      return res.status(400).json({ error: err.message });
    }
    
    res.status(500).json({ 
      error: 'Failed to upload media',
      message: err.message 
    });
  }
});

/**
 * Get message status
 * GET /messages/:messageId/status
 */
router.get('/:messageId/status', async (req, res) => {
  try {
    const { messageId } = req.params;
    
    // This would require implementing status tracking in your database
    // For now, return a simple response
    res.json({
      message_id: messageId,
      status: 'Status tracking not yet implemented',
      note: 'Check your database for message status updates from webhooks'
    });
    
  } catch (err) {
    logger.error({ err, messageId: req.params.messageId }, 'Failed to get message status');
    res.status(500).json({ error: 'Failed to get message status' });
  }
});

/**
 * Debug message delivery status
 * GET /messages/debug/:waMessageId
 */
router.get('/debug/:waMessageId', async (req, res) => {
  try {
    const { waMessageId } = req.params;
    
    // Check message in database
    const { getMessage } = await import('../db.js');
    const result = await getMessage(waMessageId);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Message not found in database',
        suggestion: 'Check if the WhatsApp message ID is correct'
      });
    }
    
    const message = result.rows[0];
    
    res.json({
      success: true,
      message_id: message.id,
      whatsapp_message_id: message.wa_message_id,
      to: message.room_id,
      status: message.status || 'unknown',
      content_type: message.content_type,
      content_text: message.content_text,
      created_at: message.created_at,
      metadata: message.metadata,
      troubleshooting: {
        possible_issues: [
          'Recipient number not verified on WhatsApp',
          'Need to use template message for new contacts',
          'WhatsApp Business API limits',
          'Message is in queue but not delivered yet'
        ],
        next_steps: [
          'Check webhook logs for delivery status',
          'Try sending template message first',
          'Verify WhatsApp Business account status'
        ]
      }
    });
    
  } catch (err) {
    logger.error({ err, waMessageId: req.params.waMessageId }, 'Failed to debug message');
    res.status(500).json({ error: 'Failed to debug message status' });
  }
});

/**
 * Send template message (recommended for new contacts)
 * POST /messages/send-template
 * 
 * Template messages are used to:
 * 1. Initiate conversation with NEW customers (room_id empty/null)
 * 2. Send to EXISTING customers (room_id provided)
 * 
 * room_id behavior:
 * - If provided → Use existing room
 * - If empty/null → Create new room (customer baru)
 */
router.post('/send-template', async (req, res) => {
  try {
    const { 
      to, 
      templateName, 
      languageCode, 
      parameters = [],
      room_id,
      replyTo,
      user_id
    } = req.body;
    
    // REQUIRED: Validate user_id for template messages (templates can ONLY be sent by agents/admin)
    if (!user_id) {
      return res.status(400).json({ 
        error: 'user_id is REQUIRED for template messages. Only agents/admin can send templates, never customers.',
        required_fields: ['to', 'templateName', 'languageCode', 'user_id'],
        note: 'Template messages are business-initiated conversations that can only be sent by your team.'
      });
    }
    
    // Validate user_id 
    const validatedUserId = await validateUserId(user_id, true);
    
    if (!to || !templateName || !languageCode) {
      return res.status(400).json({ 
        error: 'Missing required fields: to, templateName, languageCode, user_id',
        note: 'room_id is OPTIONAL - if empty, backend will create new room for new customer',
        examples: {
          new_customer: {
            to: '6287879565390',
            templateName: 'hello_world',
            languageCode: 'en_US',
            user_id: 'agent-001',
            room_id: null // Backend akan buatkan room baru
          },
          existing_customer: {
            to: '6287879565390',
            templateName: 'hello_world',
            languageCode: 'en_US',
            user_id: 'agent-001',
            room_id: 'existing-room-uuid-123' // Pakai room yang sudah ada
          },
          with_parameters: {
            to: '6287879565390',
            templateName: 'welcome_message',
            languageCode: 'en_US',
            parameters: ['John Doe', 'Premium Package', '2024'],
            user_id: 'supervisor-001',
            room_id: null // Opsional
          },
          explanation: 'Parameters will replace {{1}}, {{2}}, {{3}} etc. in your template. languageCode must match what you registered in Meta Business Manager.'
        }
      });
    }
    
    const cleanPhone = validateWhatsAppPhoneNumber(to);
    
    // Handle room_id: Use provided OR create new room + lead for new customer
    let templateFullRoomId;
    let roomCreated = false;
    let leadsId = null;
    
    if (room_id) {
      // Use existing room from frontend
      templateFullRoomId = room_id;
      logger.info({ room_id, to: cleanPhone }, '📦 Using existing room_id from frontend');
    } else {
      // Create new lead + room for new customer
      const { getLeads, insertLead } = await import('../db.js');
      
      try {
        // 1. Check if lead already exists for this phone
        const existingLeadResult = await getLeads({ phone: cleanPhone });
        
        if (existingLeadResult && existingLeadResult.rows && existingLeadResult.rows.length > 0) {
          // Lead exists, use existing lead ID
          leadsId = existingLeadResult.rows[0].id;
          logger.info({ 
            phone: cleanPhone, 
            leadsId,
            leadName: existingLeadResult.rows[0].name
          }, '📋 Using existing lead for template message');
        } else {
          // 2. Create new lead first
          const newLeadData = {
            name: `Customer ${cleanPhone}`,
            phone: cleanPhone,
            outstanding: 0,
            loan_type: 'personal_loan',
            leads_status: 'cold',
            contact_status: 'not_contacted', // Will be updated to 'contacted' when they reply
            utm_id: null,
            created_at: new Date().toISOString()
          };
          
          const newLeadResult = await insertLead(newLeadData);
          
          if (newLeadResult && newLeadResult.rows && newLeadResult.rows.length > 0) {
            leadsId = newLeadResult.rows[0].id;
            logger.info({ 
              phone: cleanPhone, 
              leadsId,
              leadData: newLeadData
            }, '✅ New lead created for template message');
          } else {
            logger.warn({ phone: cleanPhone }, '⚠️ Failed to create lead, proceeding without leads_id');
          }
        }
      } catch (leadErr) {
        logger.error({ 
          err: leadErr, 
          phone: cleanPhone 
        }, '❌ Error handling lead creation, proceeding without leads_id');
      }
      
      // 3. Create new room with leads_id
      templateFullRoomId = await ensureRoomAndGetId(cleanPhone, { 
        phone: cleanPhone,
        leads_id: leadsId, // Pass leads_id to room creation
        source: 'template_message',
        template_name: templateName,
        title: 'Personal'
      });
      roomCreated = true;
      
      logger.info({ 
        room_id: templateFullRoomId, 
        leads_id: leadsId,
        to: cleanPhone,
        templateName 
      }, '🆕 Created new room for new customer (template message)');
    }

    // Auto-assign room to agent if user role is 'agent'
    const { getUserById, checkRoomParticipant, addRoomParticipant } = await import('../db.js');
    
    try {
      // Get user info to check role
      const userResult = await getUserById(validatedUserId);
      if (userResult && userResult.rows && userResult.rows.length > 0) {
        const user = userResult.rows[0];
        
        // If user is agent, auto-assign room
        if (user.role === 'agent') {
          // Check if agent already assigned to this room
          const participantCheck = await checkRoomParticipant(templateFullRoomId, validatedUserId);
          const isAlreadyAssigned = participantCheck.rows.length > 0;
          
          if (!isAlreadyAssigned) {
            // Add agent as room participant
            await addRoomParticipant({
              room_id: templateFullRoomId,
              user_id: validatedUserId,
              joined_at: new Date().toISOString()
            });
            
            logger.info({ 
              room_id: templateFullRoomId,
              user_id: validatedUserId,
              user_name: user.name,
              user_role: user.role,
              action: 'auto_assign_agent_to_room'
            }, '✅ Auto-assigned agent to room for template message');
          } else {
            logger.info({ 
              room_id: templateFullRoomId,
              user_id: validatedUserId,
              user_name: user.name
            }, '✓ Agent already assigned to room');
          }
        } else {
          logger.info({ 
            user_id: validatedUserId,
            user_role: user.role
          }, `ℹ️ User role is '${user.role}' - skipping auto-assignment (only agents are auto-assigned)`);
        }
      }
    } catch (assignErr) {
      // Don't fail the whole request if assignment fails
      logger.error({ 
        err: assignErr, 
        room_id: templateFullRoomId,
        user_id: validatedUserId
      }, '⚠️ Failed to auto-assign agent to room (non-critical error)');
    }

    // Send template message first
    let result;
    try {
      result = await sendTemplateMessage(cleanPhone, templateName, languageCode, parameters, { replyTo });
      logger.info({ 
        templateName,
        fullResult: result,
        resultType: typeof result,
        resultKeys: Object.keys(result || {}),
        messages: result?.messages,
        messagesLength: result?.messages?.length,
        firstMessage: result?.messages?.[0],
        firstMessageType: typeof result?.messages?.[0],
        firstMessageKeys: result?.messages?.[0] ? Object.keys(result.messages[0]) : null
      }, 'WhatsApp API full response analysis');
    } catch (sendErr) {
      logger.error({ err: sendErr, templateName, to: cleanPhone }, 'Failed to send template message to WhatsApp');
      throw new Error(`WhatsApp send failed: ${sendErr.message}`);
    }

    const waMessageId = result.messages?.[0]?.id || null;
    
    logger.info({ 
      templateName,
      waMessageIdFromResponse: waMessageId,
      waMessageIdType: typeof waMessageId,
      responseMessages: result.messages,
      extractionPath: 'result.messages[0].id',
      extractionResult: {
        'result': !!result,
        'result.messages': !!result?.messages,
        'result.messages.length': result?.messages?.length,
        'result.messages[0]': !!result?.messages?.[0],
        'result.messages[0].id': result?.messages?.[0]?.id
      }
    }, 'WhatsApp message ID extraction analysis');

    // Insert to database with WhatsApp message ID included
    const messageId = uuidv4();
    const templateMeta = { 
      direction: 'outgoing', 
      source: 'api', 
      type: 'template', 
      templateName, 
      languageCode,
      parameters: parameters.length > 0 ? parameters : undefined
    };
    
    const messageData = {
      id: messageId,
      room_id: templateFullRoomId,
      user_id: validatedUserId,
      content_type: 'template',
      content_text: `Template: ${templateName}${parameters.length > 0 ? ` (${parameters.join(', ')})` : ''}`,
      media_type: null,
      media_id: null,
      gcs_filename: null,
      gcs_url: null,
      file_size: null,
      mime_type: null,
      original_filename: null,
      wa_message_id: waMessageId,
      reply_to_wa_message_id: replyTo || null,
      reaction_emoji: null,
      reaction_to_wa_message_id: null,
      metadata: templateMeta,
      created_at: new Date().toISOString()
    };
    
    try {
      logger.info({ 
        messageId, 
        waMessageId,
        templateName,
        messageDataPreview: {
          id: messageData.id,
          wa_message_id: messageData.wa_message_id,
          content_text: messageData.content_text,
          room_id: messageData.room_id
        }
      }, 'About to insert template message to database');
      
      await insertMessage(messageData);
      
      logger.info({ 
        messageId, 
        waMessageId,
        templateName,
        insertSuccess: true
      }, 'Template message sent and saved to database successfully');
    } catch (insertErr) {
      logger.error({ 
        err: insertErr, 
        messageId, 
        waMessageId, 
        templateName,
        messageDataAtError: messageData
      }, 'Failed to insert template message to database (message already sent to WhatsApp)');
      // Don't throw error here since WhatsApp message was sent successfully
    }

    // Emit Socket.IO event for template message
    if (io) {
      const messagePayload = {
        id: messageId,
        room_id: templateFullRoomId,
        user_id: validatedUserId,
        content_type: 'template',
        content_text: `Template: ${templateName}${parameters.length > 0 ? ` (${parameters.join(', ')})` : ''}`,
        wa_message_id: waMessageId || null,
        status: 'sent',
        status_timestamp: messageData.created_at,
        reply_to_wa_message_id: replyTo || null,
        reaction_emoji: null,
        reaction_to_wa_message_id: null,
        media_type: null,
        media_id: null,
        gcs_filename: null,
        gcs_url: null,
        file_size: null,
        mime_type: null,
        original_filename: null,
        metadata: templateMeta,
        created_at: messageData.created_at,
        updated_at: messageData.created_at
      };
      
      io.to(`room:${templateFullRoomId}`).emit('room:new_message', messagePayload);
      io.emit('new_message', messagePayload);
      
      logger.info({ 
        messageId, 
        roomId: templateFullRoomId,
        templateName,
        userId: validatedUserId
      }, '📡 Emitting new_message events for template message');
    }

    logger.info({ 
      to: cleanPhone, 
      templateName, 
      parameters: parameters.length,
      messageId, 
      waMessageId 
    }, 'Template message sent successfully');
    
    res.json({
      success: true,
      to: cleanPhone,
      templateName,
      languageCode,
      parameters,
      message_id: messageId,
      whatsapp_message_id: waMessageId,
      database_saved: {
        message_id: messageId,
        whatsapp_message_id: waMessageId,
        room_id: templateFullRoomId
      },
      result
    });
    
  } catch (err) {
    logger.error({ err, body: req.body }, 'Failed to send template message');
    
    if (err._messageId) {
      return res.status(500).json({ 
        error: 'Failed to send template message', 
        message: err.message, 
        message_id: err._messageId 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to send template message',
      message: err.message,
      suggestion: 'Make sure template exists and is approved in your WhatsApp Business account'
    });
  }
});

/**
 * Get available template messages
 * GET /messages/templates
 */
router.get('/templates', async (req, res) => {
  try {
    const { config } = await import('../config.js');
    
    if (!config.whatsapp.businessAccountId) {
      return res.status(500).json({
        error: 'WhatsApp Business Account ID not configured',
        message: 'Please set WHATSAPP_BUSINESS_ACCOUNT_ID in your environment variables',
        how_to_find: [
          '1. Go to Meta Business Manager (business.facebook.com)',
          '2. Select your WhatsApp Business Account',
          '3. The ID is in the URL or Account Settings',
          '4. Set WHATSAPP_BUSINESS_ACCOUNT_ID=your_account_id in .env file'
        ]
      });
    }
    
    // Use WhatsApp Business Account ID, not Phone Number ID for templates
    const response = await fetch(`${config.whatsapp.baseUrl}/${config.whatsapp.graphVersion}/${config.whatsapp.businessAccountId}/message_templates`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.whatsapp.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(400).json({ 
        error: 'Failed to get templates',
        details: data
      });
    }

    // Log raw data for debugging
    logger.info({ 
      totalTemplates: data.data?.length || 0,
      templates: data.data?.map(t => ({ name: t.name, status: t.status, language: t.language })) || []
    }, 'Raw templates from WhatsApp API');

    // Filter only approved templates and format them nicely
    const approvedTemplates = data.data
      .filter(template => template.status === 'APPROVED')
      .map(template => ({
        name: template.name,
        language: template.language,
        status: template.status,
        category: template.category,
        components: template.components.map(comp => ({
          type: comp.type,
          text: comp.text,
          parameters: comp.example?.body_text?.[0] || []
        }))
      }));

    // Count templates by status for debugging
    const statusCounts = data.data.reduce((acc, template) => {
      acc[template.status] = (acc[template.status] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      templates: approvedTemplates,
      total: approvedTemplates.length,
      debug_info: {
        total_templates_from_meta: data.data?.length || 0,
        templates_by_status: statusCounts,
        all_templates: data.data?.map(t => ({
          name: t.name,
          status: t.status,
          language: t.language,
          category: t.category
        })) || []
      },
      usage_example: {
        template_with_variables: {
          name: 'welcome_message',
          text: 'Hello {{1}}, welcome to {{2}}! Your order {{3}} is confirmed.',
          parameters: ['John Doe', 'Our Store', 'ORD123'],
          api_call: {
            url: 'POST /messages/send-template',
            body: {
              to: '6287879565390',
              templateName: 'welcome_message',
              languageCode: 'en_US', // REQUIRED: must match language registered in Meta
              parameters: ['John Doe', 'Our Store', 'ORD123']
            }
          }
        },
        why_language_code_required: "Even though templates are registered with Meta, WhatsApp API needs to know which language version to use since one template can have multiple language variants (en_US, id_ID, etc.)"
      }
    });

  } catch (error) {
    logger.error({ error }, 'Failed to get templates');
    res.status(500).json({ 
      error: 'Failed to get templates',
      message: error.message 
    });
  }
});

/**
 * Test template message with parameters
 * POST /messages/test-template
 */
router.post('/test-template', async (req, res) => {
  try {
    const { to, templateName = 'hello_world', languageCode = 'en_US', parameters = [], user_id } = req.body;
    
    // REQUIRED: user_id for template testing 
    if (!user_id) {
      return res.status(400).json({ 
        error: 'user_id is required for template testing. Only agents/admin can send templates.',
        required_fields: ['to', 'user_id']
      });
    }
    
    if (!to) {
      return res.status(400).json({ error: 'Phone number (to) required' });
    }
    
    // Validate user_id
    const validatedUserId = await validateUserId(user_id, true);
    
    const cleanPhone = validateWhatsAppPhoneNumber(to);
    
    // Test dengan template umum atau yang user specify
    const testTemplates = [
      {
        name: 'hello_world',
        languageCode: 'en_US',
        parameters: [],
        description: 'Basic hello world template (usually available by default)'
      },
      {
        name: 'sample_shipping_confirmation',
        languageCode: 'en_US', 
        parameters: ['John', '15', 'Oct 25'],
        description: 'Sample template with parameters: Hello {{1}}, your package will arrive in {{2}} business days on {{3}}.'
      }
    ];
    
    // Use specified template or try defaults
    const template = templateName === 'hello_world' && !parameters.length ? testTemplates[0] : {
      name: templateName,
      languageCode: languageCode,
      parameters: parameters,
      description: `Custom template: ${templateName} (${languageCode})`
    };
    
    const result = await sendTemplateMessage(
      cleanPhone, 
      template.name, 
      template.languageCode, 
      template.parameters
    );
    
    logger.info({ 
      to: cleanPhone,
      templateName: template.name,
      parameters: template.parameters,
      messageId: result.messages?.[0]?.id 
    }, 'Test template message sent successfully');
    
    res.json({
      success: true,
      message: 'Test template message sent successfully',
      to: cleanPhone,
      template: template,
      whatsapp_message_id: result.messages?.[0]?.id,
      result,
      note: 'If this fails, the template might not exist or not be approved in your WhatsApp Business account'
    });
    
  } catch (err) {
    logger.error({ err, body: req.body }, 'Failed to send test template message');
    res.status(500).json({ 
      error: 'Failed to send test template message',
      message: err.message,
      suggestions: [
        'Check if template exists with GET /messages/templates',
        'Make sure template is approved in WhatsApp Business Manager',
        'Verify parameter count matches template variables {{1}}, {{2}}, etc.'
      ]
    });
  }
});

/**
 * Test database and storage operations
 * POST /messages/test-db
 */
router.post('/test-db', async (req, res) => {
  try {
    const { to = '6287879565390', user_id } = req.body;
    
    // REQUIRED: user_id for database test messages
    if (!user_id) {
      return res.status(400).json({ 
        error: 'user_id is required for database test. Only agents/admin can create test messages.',
        required_fields: ['user_id']
      });
    }
    
    // Validate user_id
    const validatedUserId = await validateUserId(user_id, true);
    
    const cleanPhone = validateWhatsAppPhoneNumber(to);
    
    // Test 1: Room creation
    const testRoomId = await ensureRoomAndGetId(cleanPhone);
    logger.info('✓ Room creation test passed');

    // Test 2: Database insert
    const messageId = uuidv4();
    const testMessageData = {
      id: messageId,
      room_id: testRoomId,
      user_id: validatedUserId, // Use validated user_id instead of null
      content_type: 'text',
      content_text: 'Test message for debugging',
      media_type: null,
      media_id: null,
      gcs_filename: null,
      gcs_url: null,
      file_size: null,
      mime_type: null,
      original_filename: null,
      wa_message_id: null,
      reply_to_wa_message_id: null,
      reaction_emoji: null,
      reaction_to_wa_message_id: null,
      metadata: { direction: 'outgoing', source: 'test', type: 'text' },
      created_at: new Date().toISOString()
    };
    
    const insertResult = await insertMessage(testMessageData);
    logger.info({ insertResult }, '✓ Database insert test passed');
    
    // Test 3: Database update
    const updateResult = await updateMessage(messageId, {
      wa_message_id: 'test-wa-id',
      metadata: { direction: 'outgoing', source: 'test', type: 'text', test_update: true }
    });
    logger.info({ updateResult }, '✓ Database update test passed');
    
    res.json({
      success: true,
      message: 'All database tests passed',
      tests: {
        room_creation: '✓ Passed',
        database_insert: '✓ Passed',  
        database_update: '✓ Passed'
      },
      test_data: {
        message_id: messageId,
        room_id: cleanPhone,
        insert_result: insertResult.rows[0],
        update_result: updateResult.rows[0]
      }
    });
    
  } catch (err) {
    logger.error({ err, body: req.body }, 'Database test failed');
    res.status(500).json({ 
      error: 'Database test failed',
      message: err.message,
      stack: err.stack
    });
  }
});

/**
 * Test storage upload
 * POST /messages/test-storage
 */
router.post('/test-storage', upload.single('media'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Media file required for storage test' });
    }
    
    const { buffer, originalname, mimetype } = req.file;
    const cleanPhone = '6287879565390';
    
    logger.info({ 
      filename: originalname, 
      mimetype, 
      bufferSize: buffer.length,
      bufferType: buffer.constructor.name
    }, 'Starting storage test');
    
    // Test storage upload only
    const storageResult = await uploadToGCS({
      buffer,
      filename: originalname,
      contentType: mimetype,
      folder: 'test-media',
      roomId: cleanPhone,
      phoneNumber: cleanPhone
    });
    
    res.json({
      success: true,
      message: 'Storage test passed',
      storage_result: storageResult,
      file_info: {
        original_name: originalname,
        mime_type: mimetype,
        buffer_size: buffer.length,
        buffer_type: buffer.constructor.name
      }
    });
    
  } catch (err) {
    logger.error({ err, body: req.body }, 'Storage test failed');
    res.status(500).json({ 
      error: 'Storage test failed',
      message: err.message,
      stack: err.stack
    });
  }
});

/**
 * Get WhatsApp media caption support information
 * GET /messages/caption-support
 */
router.get('/caption-support', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'WhatsApp Business API caption support by media type',
      caption_support: {
        image: {
          supported: true,
          behavior: 'Caption appears below the image in WhatsApp',
          implementation: 'Sent directly with media message'
        },
        video: {
          supported: true,
          behavior: 'Caption appears below the video in WhatsApp',
          implementation: 'Sent directly with media message'
        },
        audio: {
          supported: false,
          behavior: 'Caption is ignored by WhatsApp API',
          implementation: 'Caption parameter ignored, not sent'
        },
        document: {
          supported: false,
          behavior: 'Caption is not supported by WhatsApp API',
          implementation: 'Caption automatically sent as separate text message',
          workaround: 'Our API automatically sends caption as separate text message after document'
        }
      },
      api_behavior: {
        '/messages/send-media-file': 'Auto-handles document captions as separate text messages',
        '/messages/send-media-combined': 'Auto-handles document captions as separate text messages',
        '/messages/send-media': 'Raw API - caption sent as-is (may be ignored for unsupported types)'
      },
      examples: {
        image_with_caption: {
          endpoint: 'POST /messages/send-media-file',
          form_data: {
            media: '[image file]',
            to: '6287879565390',
            caption: 'This caption will appear below the image'
          },
          result: 'Caption appears directly in WhatsApp'
        },
        document_with_caption: {
          endpoint: 'POST /messages/send-media-file',
          form_data: {
            media: '[document file]',
            to: '6287879565390',
            caption: 'This will be sent as separate text message'
          },
          result: 'Document sent first, then separate text message with caption'
        }
      }
    });
  } catch (err) {
    logger.error({ err }, 'Failed to get caption support info');
    res.status(500).json({ error: 'Failed to get caption support info' });
  }
});

/**
 * Get message from database by message ID
 * GET /messages/verify/:messageId
 */
router.get('/verify/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    
    const { getMessage } = await import('../db.js');
    const result = await getMessage(messageId);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Message not found in database',
        message_id: messageId
      });
    }
    
    const message = result.rows[0];
    
    res.json({
      success: true,
      message_found: true,
      message: {
        id: message.id,
        room_id: message.room_id,
        sender_id: message.sender_id,
        sender: message.sender,
        content_type: message.content_type,
        content_text: message.content_text,
        wa_message_id: message.wa_message_id,
        metadata: message.metadata,
        created_at: message.created_at,
        updated_at: message.updated_at
      },
      whatsapp_message_id_saved: !!message.wa_message_id,
      database_check: 'Message found and WhatsApp message ID is ' + (message.wa_message_id ? 'saved' : 'NOT saved')
    });
    
  } catch (err) {
    logger.error({ err, messageId: req.params.messageId }, 'Failed to verify message in database');
    res.status(500).json({ 
      error: 'Failed to verify message in database',
      message: err.message 
    });
  }
});

/**
 * Debug WhatsApp template response
 * POST /messages/debug-template-response
 */
router.post('/debug-template-response', async (req, res) => {
  try {
    const { 
      to = '6287879565390', 
      templateName = 'hello_world', 
      languageCode = 'en_US', 
      parameters = [],
      user_id
    } = req.body;
    
    // REQUIRED: user_id for template debugging
    if (!user_id) {
      return res.status(400).json({ 
        error: 'user_id is required for template debugging. Only agents/admin can send templates.',
        required_fields: ['user_id']
      });
    }
    
    // Validate user_id
    const validatedUserId = await validateUserId(user_id, true);
    
    const cleanPhone = validateWhatsAppPhoneNumber(to);
    
    logger.info({ 
      to: cleanPhone,
      templateName,
      languageCode,
      parameters
    }, 'Starting WhatsApp template response debug');
    
    // Send template message and analyze response
    let result;
    try {
      result = await sendTemplateMessage(cleanPhone, templateName, languageCode, parameters);
    } catch (sendErr) {
      return res.status(500).json({
        error: 'Failed to send template message',
        message: sendErr.message,
        details: sendErr
      });
    }
    
    // Detailed analysis of the response
    const analysis = {
      full_result: result,
      result_type: typeof result,
      result_keys: result ? Object.keys(result) : null,
      has_messages: !!result?.messages,
      messages_type: typeof result?.messages,
      messages_length: result?.messages?.length,
      messages_content: result?.messages,
      first_message: result?.messages?.[0],
      first_message_type: typeof result?.messages?.[0],
      first_message_keys: result?.messages?.[0] ? Object.keys(result.messages[0]) : null,
      extracted_id: result?.messages?.[0]?.id,
      extracted_id_type: typeof result?.messages?.[0]?.id,
      is_id_truthy: !!result?.messages?.[0]?.id,
      is_id_null: result?.messages?.[0]?.id === null,
      is_id_undefined: result?.messages?.[0]?.id === undefined
    };
    
    logger.info(analysis, 'WhatsApp API response detailed analysis');
    
    res.json({
      success: true,
      message: 'WhatsApp template response analyzed',
      whatsapp_response: result,
      analysis,
      conclusion: {
        message_sent: !!result,
        has_message_id: !!result?.messages?.[0]?.id,
        message_id_value: result?.messages?.[0]?.id,
        issue_found: !result?.messages?.[0]?.id ? 'WhatsApp API did not return message ID' : 'No issue - message ID exists'
      }
    });
    
  } catch (err) {
    logger.error({ err }, 'Debug template response failed');
    res.status(500).json({ 
      error: 'Debug failed',
      message: err.message 
    });
  }
});

/**
 * Send test message (for development/testing)
 * POST /messages/test
 */
router.post('/test', async (req, res) => {
  try {
    const { to, user_id } = req.body;
    
    // REQUIRED: user_id for test messages
    if (!user_id) {
      return res.status(400).json({ 
        error: 'user_id is required for test messages. Only agents/admin can send test messages.',
        required_fields: ['to', 'user_id']
      });
    }
    
    if (!to) {
      return res.status(400).json({ error: 'Phone number (to) required' });
    }
    
    // Validate user_id
    const validatedUserId = await validateUserId(user_id, true);
    
    const cleanPhone = validateWhatsAppPhoneNumber(to);
    const testMessage = `Hello! This is a test message from Boztell Backend at ${new Date().toLocaleString('id-ID')}. Your phone number: ${cleanPhone}`;
    
    const result = await sendTextMessage(cleanPhone, testMessage);
    
    logger.info({ 
      to: cleanPhone,
      messageId: result.messages?.[0]?.id 
    }, 'Test message sent successfully');
    
    res.json({
      success: true,
      message: 'Test message sent successfully',
      to: cleanPhone,
      whatsapp_message_id: result.messages?.[0]?.id,
      text: testMessage
    });
    
  } catch (err) {
    logger.error({ err, body: req.body }, 'Failed to send test message');
    res.status(500).json({ 
      error: 'Failed to send test message',
      message: err.message 
    });
  }
});

  return router;
}

// For backward compatibility
export const messagesRouter = createMessagesRouter(null);
