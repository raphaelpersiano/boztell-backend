import axios from 'axios';
import FormData from 'form-data';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { insertMessage } from '../db.js';
import { uploadBuffer, uploadStream } from './storageService.js';
import { sendPushNotification, sendMulticastNotification } from './fcmService.js';

/**
 * Handle incoming media message from WhatsApp webhook
 */
export async function handleIncomingMedia({ io }, input) {
  const messageId = uuidv4();
  
  try {
    logger.info({ media_id: input.media_id, room_id: input.room_id }, 'Starting media processing');
    
    // For development: skip WhatsApp download if media_id is test
    let mediaData;
    if (input.media_id && input.media_id.startsWith('test_')) {
      logger.info('Using test media data for development');
      mediaData = {
        buffer: Buffer.from('Test media content for development'),
        contentType: input.mime_type || 'image/jpeg',
        size: 58,
        sha256: 'test_sha'
      };
    } else {
      // 1. Download media from WhatsApp API
      logger.info('Downloading media from WhatsApp API');
      try {
        mediaData = await downloadWhatsAppMedia(input.media_id);
      } catch (err) {
        if (config.env === 'development') {
          logger.warn('WhatsApp API failed in development, using test data');
          mediaData = {
            buffer: Buffer.from('Fallback test media content'),
            contentType: input.mime_type || 'image/jpeg',
            size: 32,
            sha256: 'fallback_sha'
          };
        } else {
          throw err;
        }
      }
    }
    
    // 2. Upload to Google Cloud Storage with organized structure
    const gcsData = await uploadBuffer({
      buffer: mediaData.buffer,
      filename: input.filename || `media_${input.media_id}`,
      contentType: mediaData.contentType || input.mime_type,
      folder: 'whatsapp-media',
      roomId: input.room_id,
      phoneNumber: extractPhoneNumberFromRoomId(input.room_id)
    });
    
    // 3. Save to database
    const storedName = (gcsData.gcsFilename || '').split('/').pop() || input.filename;
    const message = await saveMediaMessage({
      id: messageId,
      room_id: input.room_id,
      user_id: input.user_id, // null for customer messages from webhook
      media_type: input.media_type,
      media_id: input.media_id,
      caption: input.caption,
      gcs_filename: gcsData.gcsFilename,
      gcs_url: gcsData.url,
      file_size: gcsData.size,
      mime_type: gcsData.contentType,
      original_filename: storedName,
      wa_message_id: input.wa_message_id,
      metadata: input.metadata || {}
    });
    
    // 4. Emit to Socket.io room - use direct message structure
    const mediaPayload = {
      id: message.id,
      room_id: input.room_id,
      user_id: input.user_id,
      content_type: 'media',
      content_text: input.caption || '',
      media_type: input.media_type,
      media_id: input.media_id,
      gcs_filename: gcsData.gcsFilename,
      gcs_url: gcsData.url,
      file_size: gcsData.size,
      mime_type: gcsData.contentType,
      original_filename: storedName,
      wa_message_id: input.wa_message_id,
      status: message.status || 'received',
      reply_to_wa_message_id: input.reply_to_wa_message_id || null,
      reaction_emoji: null,
      reaction_to_wa_message_id: null,
      metadata: input.metadata || {},
      created_at: message.created_at,
      updated_at: message.updated_at,
      // Additional media info
      media_url: gcsData.url,
      thumbnail_url: await generateThumbnailIfNeeded(gcsData, input.media_type)
    };
    
    // Emit direct message object (not wrapped)
    io.to(`room:${input.room_id}`).emit('room:new_message', mediaPayload);
    io.emit('new_message', mediaPayload);
    
    logger.info({ 
      messageId,
      roomId: input.room_id,
      mediaType: input.media_type,
      hasId: !!mediaPayload.id
    }, '📡 Emitting new_message events for media');
    
    // 5. Send push notifications
    await notifyRoomParticipants({
      room_id: input.room_id,
      message: {
        title: input.sender,
        message: getMediaNotificationText(input.media_type, input.caption),
        room_id: input.room_id,
        sender: input.sender,
        message_id: messageId,
        type: 'media'
      }
    });
    
    logger.info({ messageId, media_id: input.media_id, room_id: input.room_id }, 'Media message processed successfully');
    
    return {
      type: 'media_message',
      success: true,
      room_id: input.room_id,
      message_id: messageId,
      wa_message_id: input.wa_message_id,
      public_url: gcsData.url
    };
    
  } catch (err) {
    logger.error({ err, media_id: input.media_id }, 'Failed to process media message');
  throw err;
  }
}

/**
 * Download media from WhatsApp Cloud API
 */
export async function downloadWhatsAppMedia(mediaId) {
  try {
    // 1. Get media URL
    const urlResponse = await axios.get(
      `${config.whatsapp.baseUrl}/${config.whatsapp.graphVersion}/${mediaId}`,
      {
        headers: {
          'Authorization': `Bearer ${config.whatsapp.accessToken}`
        }
      }
    );
    
    const { url, mime_type, file_size, sha256 } = urlResponse.data;
    
    // 2. Download the actual media file
    const mediaResponse = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${config.whatsapp.accessToken}`
      },
      responseType: 'arraybuffer',
      timeout: 30000, // 30 seconds for large files
      maxContentLength: 100 * 1024 * 1024 // 100MB max
    });
    
    const buffer = Buffer.from(mediaResponse.data);
    
    // Verify file size if provided
    if (file_size && buffer.length !== parseInt(file_size)) {
      logger.warn({ 
        expected: file_size, 
        actual: buffer.length, 
        mediaId 
      }, 'File size mismatch');
    }
    
    return {
      buffer,
      contentType: mime_type || mediaResponse.headers['content-type'],
      size: buffer.length,
      sha256
    };
    
  } catch (err) {
    if (err.response?.status === 404) {
      throw new Error(`Media not found or expired: ${mediaId}`);
    } else if (err.response?.status === 403) {
      throw new Error(`Access denied for media: ${mediaId}`);
    }
    
    logger.error({ err, mediaId }, 'Failed to download WhatsApp media');
    throw new Error(`Failed to download media: ${err.message}`);
  }
}

/**
 * Upload media to WhatsApp Cloud API
 */
export async function uploadMediaToWhatsApp({ buffer, filename, mimeType }) {
  try {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('file', buffer, {
      filename,
      contentType: mimeType
    });
    
    const response = await axios.post(
      `${config.whatsapp.baseUrl}/${config.whatsapp.graphVersion}/${config.whatsapp.phoneNumberId}/media`,
      form,
      {
        headers: {
          'Authorization': `Bearer ${config.whatsapp.accessToken}`,
          ...form.getHeaders()
        },
        maxContentLength: 100 * 1024 * 1024, // 100MB
        timeout: 60000 // 60 seconds
      }
    );
    
    logger.info({ mediaId: response.data.id, filename }, 'Media uploaded to WhatsApp');
    return response.data;
    
  } catch (err) {
    logger.error({ err, filename }, 'Failed to upload media to WhatsApp');
    throw new Error(`WhatsApp upload failed: ${err.message}`);
  }
}

/**
 * Save media message to database
 */
async function saveMediaMessage(data) {
  const replyTo = data.reply_to_wa_message_id || data.metadata?.reply_to || null;
  
  const messageData = {
    id: data.id,
    room_id: data.room_id,
    user_id: data.user_id, // null for customer messages from webhook
    content_type: 'media',
    content_text: data.caption,
    media_type: data.media_type,
    media_id: data.media_id,
    gcs_filename: data.gcs_filename,
    gcs_url: data.gcs_url,
    file_size: data.file_size,
    mime_type: data.mime_type,
    original_filename: data.original_filename,
    wa_message_id: data.wa_message_id,
    reply_to_wa_message_id: replyTo,
    metadata: data.metadata || {},
    created_at: new Date().toISOString()
  };
  
  const { rows } = await insertMessage(messageData);
  return rows[0];
}

/**
 * Get media notification text based on type
 */
function getMediaNotificationText(mediaType, caption) {
  const typeTexts = {
    image: 'sent a photo',
    video: 'sent a video',
    audio: 'sent an audio message',
    document: 'sent a document',
    sticker: 'sent a sticker'
  };
  
  const baseText = typeTexts[mediaType] || 'sent media';
  return caption ? `${baseText}: ${caption}` : baseText;
}

/**
 * Generate thumbnail for media if needed (placeholder - implement based on needs)
 */
async function generateThumbnailIfNeeded(gcsData, mediaType) {
  // For now, return null. You can implement thumbnail generation here
  // using libraries like Sharp for images or FFmpeg for videos
  return null;
}

/**
 * Notify room participants about new message
 */
async function notifyRoomParticipants({ room_id, message }) {
  try {
    // Get participants with device tokens
    const { getRoomParticipants } = await import('../db.js');
    const { rows: participants } = await getRoomParticipants(room_id);
    
    if (participants.length === 0) {
      logger.debug({ room_id }, 'No participants with device tokens found');
      return;
    }
    
    const tokens = participants.map(p => p.device_token);
    
    // Send multicast notification
    const result = await sendMulticastNotification({
      tokens,
      payload: message
    });
    
    // Remove invalid tokens
    if (result.invalidTokens && result.invalidTokens.length > 0) {
      const { deleteDeviceTokens } = await import('../db.js');
      await deleteDeviceTokens(result.invalidTokens);
      logger.info({ count: result.invalidTokens.length }, 'Invalid device tokens removed');
    }
    
    logger.info({ 
      room_id, 
      sentCount: result.successCount,
      failedCount: result.failureCount,
      invalidCount: result.invalidTokens?.length || 0
    }, 'Room participants notified');
    
  } catch (err) {
    logger.error({ err, room_id }, 'Failed to notify room participants');
    // Don't throw - notification failure shouldn't stop message processing
  }
}



/**
 * Get media message by ID with GCS URL
 */
export async function getMediaMessage(messageId) {
  const { getMediaMessage: getMediaMessageDb } = await import('../db.js');
  return await getMediaMessageDb(messageId);
}

/**
 * Extract phone number from room ID for folder organization
 */
function extractPhoneNumberFromRoomId(roomId) {
  if (!roomId) return null;
  
  // Common patterns for room IDs that contain phone numbers
  const patterns = [
    /(\d{10,15})$/,           // Phone number at end: "prefix_1234567890"
    /_(\d{10,15})$/,          // Phone number after underscore: "room_1234567890"
    /(\d{10,15})_/,           // Phone number before underscore: "1234567890_suffix"
    /^(\d{10,15})/,           // Phone number at start: "1234567890something"
    /(\d{10,15})/             // Any phone number pattern
  ];
  
  for (const pattern of patterns) {
    const match = roomId.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}
export async function refreshMediaUrl(messageId) {
  const message = await getMediaMessage(messageId);
  if (!message || !message.gcs_filename) {
    throw new Error('Media message not found');
  }
  
  try {
    const { generateSignedUrl } = await import('./storageService.js');
    const newUrl = await generateSignedUrl(message.gcs_filename);
    
    // Update URL in database
    const { updateMediaUrl } = await import('../db.js');
    const { rows } = await updateMediaUrl(messageId, newUrl);
    return rows[0];
    
  } catch (err) {
    logger.error({ err, messageId }, 'Failed to refresh media URL');
    throw err;
  }
}
