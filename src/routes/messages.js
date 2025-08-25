import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { sendTextMessage, sendMediaMessage, sendMediaByUrl, sendTemplateMessage, uploadMediaToWhatsApp, sendContactsMessage, sendLocationMessage, sendReactionMessage } from '../services/whatsappService.js';
import { validateWhatsAppPhoneNumber } from '../services/whatsappService.js';
import { uploadBuffer as uploadToGCS } from '../services/storageService.js';
import { ensureRoom } from '../services/roomService.js';
import { query } from '../db.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Configure multer for media uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max (WhatsApp limit: 16MB for most, 100MB for documents)
  },
  fileFilter: (req, file, cb) => {
    // WhatsApp supported media types
    const allowedTypes = [
      // Images
      'image/jpeg', 'image/png', 'image/webp',
      // Videos
      'video/mp4', 'video/3gpp',
      // Audio
      'audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr', 'audio/ogg',
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
      cb(new Error(`Unsupported media type for WhatsApp: ${file.mimetype}`), false);
    }
  }
});

/**
 * Send text message to WhatsApp
 * POST /messages/send
 */
router.post('/send', async (req, res) => {
  try {
    const { to, text, type = 'text', user_id = 'operator', sender_name = 'Operator', ...options } = req.body;
    
    if (!to || !text) {
      return res.status(400).json({ 
        error: 'Missing required fields: to, text' 
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
    
    // Send message based on type
    let result;
    
    switch (type) {
      case 'text':
        // Ensure room exists (1 room = 1 phone number)
        await ensureRoom(cleanPhone, { customerPhone: cleanPhone });

        // 1) Insert DB row first
        const messageId = uuidv4();
        const insertSql = `
          INSERT INTO messages (
            id, room_id, sender_id, sender, content_type, content_text,
            media_type, media_id, gcs_filename, gcs_url, file_size, mime_type,
            original_filename, wa_message_id, reply_to_wa_message_id, metadata, created_at
          ) VALUES (
            $1, $2, $3, $4, 'text', $5,
            NULL, NULL, NULL, NULL, NULL, NULL,
            NULL, NULL, $6, $7, NOW()
          ) RETURNING *;
        `;
        const baseMeta = { direction: 'outgoing', source: 'api', type: 'text' };
        if (replyTo) baseMeta.reply_to = replyTo;
        const insertParams = [
          messageId, cleanPhone, (user_id || 'operator'), (sender_name || 'Operator'), text,
          replyTo || null,
          JSON.stringify(baseMeta)
        ];
        await query(insertSql, insertParams);

        // 2) Send to WhatsApp
        try {
          result = await sendTextMessage(cleanPhone, text, { ...options, replyTo });
        } catch (sendErr) {
          // Mark failure on the same row and return 500 with message_id for tracking
          const failMeta = { ...baseMeta, send_error: sendErr.message };
          try {
            await query('UPDATE messages SET metadata = $1, updated_at = NOW() WHERE id = $2', [
              JSON.stringify(failMeta), messageId
            ]);
          } catch (_) { /* best effort */ }
          throw Object.assign(new Error(sendErr.message), { _messageId: messageId });
        }

        // 3) Update DB row with WA message id
        const waMessageId = result.messages?.[0]?.id || null;
        try {
          await query('UPDATE messages SET wa_message_id = $1, updated_at = NOW() WHERE id = $2', [
            waMessageId, messageId
          ]);
        } catch (updErr) {
          logger.warn({ err: updErr, messageId }, 'Failed to update wa_message_id for text message');
        }

        logger.info({ to: cleanPhone, type, messageId, waMessageId }, 'Text message persisted and sent');

        return res.json({
          success: true,
          to: cleanPhone,
          type,
          message_id: messageId,
          whatsapp_message_id: waMessageId,
          result
        });
        break;
        
      case 'template':
        const { templateName, languageCode = 'en', parameters = [] } = options;
        if (!templateName) {
          return res.status(400).json({ error: 'templateName required for template messages' });
        }
        result = await sendTemplateMessage(cleanPhone, templateName, languageCode, parameters);
        break;
        
      default:
        return res.status(400).json({ error: `Unsupported message type: ${type}` });
    }
    
    logger.info({ to: cleanPhone, type, messageId: result.messages?.[0]?.id }, 'Message sent to WhatsApp successfully');
    res.json({ success: true, to: cleanPhone, type, whatsapp_message_id: result.messages?.[0]?.id, result });
    
  } catch (err) {
    logger.error({ err, body: req.body }, 'Failed to send WhatsApp message');
    
    if (err._messageId) {
      return res.status(500).json({ error: 'Failed to send message', message: err.message, message_id: err._messageId });
    }
    if (err.message.includes('Invalid phone number')) {
      return res.status(400).json({ error: err.message });
    }
    
    res.status(500).json({ 
      error: 'Failed to send message',
      message: err.message 
    });
  }
});

/**
 * Send contacts message
 * POST /messages/send-contacts
 * body: { to, contacts: [...], replyTo?, user_id?, sender_name? }
 */
router.post('/send-contacts', async (req, res) => {
  try {
    const { to, contacts, replyTo, user_id = 'operator', sender_name = 'Operator' } = req.body;
    if (!to || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'to and contacts[] required' });
    }
    const cleanPhone = validateWhatsAppPhoneNumber(to);
    await ensureRoom(cleanPhone, { customerPhone: cleanPhone });

    // Insert DB row first
    const messageId = uuidv4();
    const meta = { direction: 'outgoing', source: 'api', type: 'contacts' };
    if (replyTo) meta.reply_to = replyTo;
    await query(`
      INSERT INTO messages (id, room_id, sender_id, sender, content_type, content_text,
        media_type, media_id, gcs_filename, gcs_url, file_size, mime_type,
        original_filename, wa_message_id, reply_to_wa_message_id, metadata, created_at)
      VALUES ($1,$2,$3,$4,'contacts',$5,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,$6,$7,NOW())
    `, [messageId, cleanPhone, user_id, sender_name, `contacts:${contacts.length}`, replyTo || null, JSON.stringify(meta)]);

    let result;
    try {
      result = await sendContactsMessage(cleanPhone, contacts, { replyTo });
    } catch (err) {
      await query('UPDATE messages SET metadata = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify({ ...meta, send_error: err.message }), messageId]);
      throw Object.assign(new Error(err.message), { _messageId: messageId });
    }
    const waMessageId = result.messages?.[0]?.id || null;
    await query('UPDATE messages SET wa_message_id = $1, updated_at = NOW() WHERE id = $2', [waMessageId, messageId]);
    res.json({ success: true, to: cleanPhone, type: 'contacts', message_id: messageId, whatsapp_message_id: waMessageId, result });
  } catch (err) {
    if (err._messageId) return res.status(500).json({ error: 'Failed to send contacts', message: err.message, message_id: err._messageId });
    res.status(500).json({ error: 'Failed to send contacts', message: err.message });
  }
});

/**
 * Send location message
 * POST /messages/send-location
 * body: { to, location: { latitude, longitude, name?, address? }, replyTo?, user_id?, sender_name? }
 */
router.post('/send-location', async (req, res) => {
  try {
    const { to, location, replyTo, user_id = 'operator', sender_name = 'Operator' } = req.body;
    if (!to || !location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      return res.status(400).json({ error: 'to and location.latitude/longitude required' });
    }
    const cleanPhone = validateWhatsAppPhoneNumber(to);
    await ensureRoom(cleanPhone, { customerPhone: cleanPhone });

    const messageId = uuidv4();
    const meta = { direction: 'outgoing', source: 'api', type: 'location', location };
    if (replyTo) meta.reply_to = replyTo;
    await query(`
      INSERT INTO messages (id, room_id, sender_id, sender, content_type, content_text,
        media_type, media_id, gcs_filename, gcs_url, file_size, mime_type,
        original_filename, wa_message_id, reply_to_wa_message_id, metadata, created_at)
      VALUES ($1,$2,$3,$4,'location',$5,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,$6,$7,NOW())
    `, [messageId, cleanPhone, user_id, sender_name, `Location: ${location.latitude}, ${location.longitude}`, replyTo || null, JSON.stringify(meta)]);

    let result;
    try {
      result = await sendLocationMessage(cleanPhone, location, { replyTo });
    } catch (err) {
      await query('UPDATE messages SET metadata = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify({ ...meta, send_error: err.message }), messageId]);
      throw Object.assign(new Error(err.message), { _messageId: messageId });
    }
    const waMessageId = result.messages?.[0]?.id || null;
    await query('UPDATE messages SET wa_message_id = $1, updated_at = NOW() WHERE id = $2', [waMessageId, messageId]);
    res.json({ success: true, to: cleanPhone, type: 'location', message_id: messageId, whatsapp_message_id: waMessageId, result });
  } catch (err) {
    if (err._messageId) return res.status(500).json({ error: 'Failed to send location', message: err.message, message_id: err._messageId });
    res.status(500).json({ error: 'Failed to send location', message: err.message });
  }
});

/**
 * Send reaction to a message
 * POST /messages/send-reaction
 * body: { to, message_id, emoji }
 */
router.post('/send-reaction', async (req, res) => {
  try {
    const { to, message_id, emoji, user_id = 'operator', sender_name = 'Operator' } = req.body;
    if (!to || !message_id || !emoji) {
      return res.status(400).json({ error: 'to, message_id, and emoji are required' });
    }
    const cleanPhone = validateWhatsAppPhoneNumber(to);
    await ensureRoom(cleanPhone, { customerPhone: cleanPhone });

    const messageId = uuidv4();
    const meta = { direction: 'outgoing', source: 'api', type: 'reaction', reaction: { emoji, message_id } };
    await query(`
      INSERT INTO messages (id, room_id, sender_id, sender, content_type, content_text,
        media_type, media_id, gcs_filename, gcs_url, file_size, mime_type,
        original_filename, wa_message_id, reaction_emoji, reaction_to_wa_message_id, metadata, created_at)
      VALUES ($1,$2,$3,$4,'reaction',$5,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,$6,$7,$8,NOW())
    `, [messageId, cleanPhone, user_id, sender_name, `Reaction ${emoji} to ${message_id}`, emoji, message_id, JSON.stringify(meta)]);

    let result;
    try {
      result = await sendReactionMessage(cleanPhone, message_id, emoji);
    } catch (err) {
      await query('UPDATE messages SET metadata = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify({ ...meta, send_error: err.message }), messageId]);
      throw err;
    }
    const waMessageId = result.messages?.[0]?.id || null;
    await query('UPDATE messages SET wa_message_id = $1, updated_at = NOW() WHERE id = $2', [waMessageId, messageId]);
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
    const { to, mediaType, mediaId, mediaUrl, caption, filename } = req.body;
    
    if (!to || !mediaType) {
      return res.status(400).json({ 
        error: 'Missing required fields: to, mediaType' 
      });
    }
    
    if (!mediaId && !mediaUrl) {
      return res.status(400).json({ 
        error: 'Either mediaId or mediaUrl is required' 
      });
    }
    
    const cleanPhone = validateWhatsAppPhoneNumber(to);
    
    let result;
    
    if (mediaId) {
      // Send using WhatsApp media ID
      result = await sendMediaMessage(cleanPhone, mediaType, mediaId, {
        caption,
        filename
      });
    } else {
      // Send using URL
      result = await sendMediaByUrl(cleanPhone, mediaType, mediaUrl, {
        caption,
        filename
      });
    }
    
    logger.info({ 
      to: cleanPhone, 
      mediaType,
      mediaId: mediaId || 'url',
      messageId: result.messages?.[0]?.id 
    }, 'Media message sent to WhatsApp successfully');
    
    res.json({
      success: true,
      to: cleanPhone,
      mediaType,
      mediaId: mediaId || null,
      mediaUrl: mediaUrl || null,
      whatsapp_message_id: result.messages?.[0]?.id,
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
 */
router.post('/send-media-file', upload.single('media'), async (req, res) => {
  try {
    const { to, caption } = req.body;
    
    if (!to) {
      return res.status(400).json({ error: 'Phone number (to) required' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'Media file required' });
    }
    
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
    
    // 1. Upload media to WhatsApp
    const uploadResult = await uploadMediaToWhatsApp({
      buffer,
      filename: originalname,
      mimeType: mimetype
    });
    
    // 2. Send media message
    const sendResult = await sendMediaMessage(cleanPhone, mediaType, uploadResult.id, {
      caption,
      filename: originalname
    });
    
    logger.info({ 
      to: cleanPhone,
      mediaType,
      filename: originalname,
      mediaId: uploadResult.id,
      messageId: sendResult.messages?.[0]?.id 
    }, 'Media uploaded and sent to WhatsApp successfully');
    
    res.json({
      success: true,
      to: cleanPhone,
      mediaType,
      filename: originalname,
      size: buffer.length,
      whatsapp_media_id: uploadResult.id,
      whatsapp_message_id: sendResult.messages?.[0]?.id,
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
 * Combined flow: upload to GCS + persist DB + upload to WhatsApp + send to WhatsApp
 * POST /messages/send-media-combined
 * Form fields: media (file), to (phone), caption (optional), user_id (optional), sender_name (optional)
 */
router.post('/send-media-combined', upload.single('media'), async (req, res) => {
  try {
    const { to, caption = '', user_id = null, sender_name = 'Operator' } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Phone number (to) required' });
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

    // Ensure room exists (1 room = 1 phone number)
    await ensureRoom(cleanPhone, { customerPhone: cleanPhone });

    // 1) Upload to GCS (organized by phone/date)
  const gcs = await uploadToGCS({
      buffer,
      filename: originalname,
      contentType: mimetype,
      folder: 'whatsapp-media',
      roomId: cleanPhone,
      phoneNumber: cleanPhone
    });

    // 2) Create DB row first (will update with WA IDs later)
    const messageId = uuidv4();
  const insertSql = `
      INSERT INTO messages (
        id, room_id, sender_id, sender, content_type, content_text,
        media_type, media_id, gcs_filename, gcs_url, file_size, mime_type,
        original_filename, wa_message_id, metadata, created_at
      ) VALUES (
        $1, $2, $3, $4, 'media', $5,
        $6, NULL, $7, $8, $9, $10,
        $11, NULL, $12, NOW()
      ) RETURNING *;
    `;
    const metadata = { direction: 'outgoing', source: 'api', filename: originalname };
    const storedName = (gcs.gcsFilename || '').split('/').pop() || originalname;
    const insertParams = [
      messageId, cleanPhone, (user_id || 'operator'), (sender_name || 'Operator'), caption,
      mediaType, gcs.gcsFilename, gcs.url, gcs.size, mimetype,
      storedName, JSON.stringify(metadata)
    ];
    const { rows: insertedRows } = await query(insertSql, insertParams);

    // 3) Upload media to WhatsApp to obtain media ID
    const waUpload = await uploadMediaToWhatsApp({
      buffer,
      filename: originalname,
      mimeType: mimetype
    });

    // 4) Send WhatsApp message using media ID
    const sendResult = await sendMediaMessage(cleanPhone, mediaType, waUpload.id, {
      caption,
      filename: originalname
    });
    const waMessageId = sendResult.messages?.[0]?.id || null;

    // 5) Update the same DB row with WhatsApp IDs
    const updateSql = `
      UPDATE messages
      SET media_id = $1, wa_message_id = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *;
    `;
    const { rows: updatedRows } = await query(updateSql, [waUpload.id, waMessageId, messageId]);
    const saved = updatedRows[0] || insertedRows[0];

    logger.info({
      to: cleanPhone,
      mediaType,
      mediaId: waUpload.id,
      waMessageId,
      gcsFilename: gcs.gcsFilename
    }, 'Combined media flow successful');

    return res.json({
      success: true,
      to: cleanPhone,
      mediaType,
      message_id: saved.id,
      whatsapp_media_id: waUpload.id,
      whatsapp_message_id: waMessageId,
      public_url: gcs.url
    });
  } catch (err) {
    logger.error({ err }, 'Failed combined media flow');
    return res.status(500).json({ error: 'Failed to upload and send media', message: err.message });
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
 * Send test message (for development/testing)
 * POST /messages/test
 */
router.post('/test', async (req, res) => {
  try {
    const { to } = req.body;
    
    if (!to) {
      return res.status(400).json({ error: 'Phone number (to) required' });
    }
    
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

export const messagesRouter = router;
