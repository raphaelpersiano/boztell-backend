import { config } from '../config.js';
import { logger } from '../utils/logger.js';

// FormData polyfill for Node.js
const FormData = globalThis.FormData || (await import('form-data')).default;

/**
 * Send text message to WhatsApp Business API
 * @param {string} to - Recipient phone number (with country code)
 * @param {string} text - Message text
 * @param {object} options - Additional options
 * @returns {object} WhatsApp API response
 */
export async function sendTextMessage(to, text, options = {}) {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'text',
      text: {
        body: text
      }
    };
    // Reply-to context
    if (options.replyTo) {
      payload.context = { message_id: options.replyTo };
    }
    
    const response = await callWhatsAppAPI('/messages', payload);
    
    logger.info({ 
      to, 
      messageId: response.messages?.[0]?.id,
      text: text.substring(0, 100) 
    }, 'Text message sent to WhatsApp');
    
    return response;
    
  } catch (err) {
    logger.error({ err, to, text: text.substring(0, 100) }, 'Failed to send text message to WhatsApp');
    throw err;
  }
}

/**
 * Upload media to WhatsApp Business API
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename
 * @param {string} mimeType - MIME type
 * @returns {object} WhatsApp media upload response
 */
export async function uploadMediaToWhatsApp({ buffer, filename, mimeType }) {
  try {
    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: mimeType }), filename);
    formData.append('type', mimeType);
    formData.append('messaging_product', 'whatsapp');
    
    const url = `${config.whatsapp.baseUrl}/${config.whatsapp.graphVersion}/${config.whatsapp.phoneNumberId}/media`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.whatsapp.accessToken}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WhatsApp media upload failed: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    logger.info({ 
      filename, 
      mimeType,
      mediaId: data.id 
    }, 'Media uploaded to WhatsApp successfully');
    
    return data;
    
  } catch (err) {
    logger.error({ err, filename, mimeType }, 'Failed to upload media to WhatsApp');
    throw err;
  }
}

/**
 * Send media message using WhatsApp media ID
 * @param {string} to - Recipient phone number
 * @param {string} mediaType - 'image', 'video', 'audio', 'document'
 * @param {string} mediaId - WhatsApp media ID
 * @param {object} options - Additional options (caption, filename, etc.)
 * @returns {object} WhatsApp API response
 */
export async function sendMediaMessage(to, mediaType, mediaId, options = {}) {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      type: mediaType,
      [mediaType]: {
        id: mediaId
      }
    };
    
    // Add caption for image/video
    if (options.caption && ['image', 'video'].includes(mediaType)) {
      payload[mediaType].caption = options.caption;
    }
    
    // Add filename for document
    if (options.filename && mediaType === 'document') {
      payload[mediaType].filename = options.filename;
    }
    
    // Reply-to context
    if (options.replyTo) {
      payload.context = { message_id: options.replyTo };
    }

    const response = await callWhatsAppAPI('/messages', payload);
    
    logger.info({ 
      to, 
      mediaType,
      mediaId,
      messageId: response.messages?.[0]?.id 
    }, 'Media message sent to WhatsApp');
    
    return response;
    
  } catch (err) {
    logger.error({ err, to, mediaType, mediaId }, 'Failed to send media message to WhatsApp');
    throw err;
  }
}

/**
 * Send media message using URL (WhatsApp will download and cache)
 * @param {string} to - Recipient phone number
 * @param {string} mediaType - 'image', 'video', 'audio', 'document'
 * @param {string} mediaUrl - Public URL to media file
 * @param {object} options - Additional options
 * @returns {object} WhatsApp API response
 */
export async function sendMediaByUrl(to, mediaType, mediaUrl, options = {}) {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      type: mediaType,
      [mediaType]: {
        link: mediaUrl
      }
    };
    
    // Add caption for image/video
    if (options.caption && ['image', 'video'].includes(mediaType)) {
      payload[mediaType].caption = options.caption;
    }
    
    // Add filename for document
    if (options.filename && mediaType === 'document') {
      payload[mediaType].filename = options.filename;
    }
    
    // Reply-to context
    if (options.replyTo) {
      payload.context = { message_id: options.replyTo };
    }

    const response = await callWhatsAppAPI('/messages', payload);
    
    logger.info({ 
      to, 
      mediaType,
      mediaUrl,
      messageId: response.messages?.[0]?.id 
    }, 'Media message sent to WhatsApp via URL');
    
    return response;
    
  } catch (err) {
    logger.error({ err, to, mediaType, mediaUrl }, 'Failed to send media message via URL to WhatsApp');
    throw err;
  }
}

/**
 * Send template message to WhatsApp Business API
 * @param {string} to - Recipient phone number
 * @param {string} templateName - Template name
 * @param {string} languageCode - Language code (e.g., 'en', 'id')
 * @param {array} parameters - Template parameters
 * @returns {object} WhatsApp API response
 */
export async function sendTemplateMessage(to, templateName, languageCode = 'en', parameters = []) {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode
        }
      }
    };
    
    if (parameters.length > 0) {
      payload.template.components = [{
        type: 'body',
        parameters: parameters.map(param => ({
          type: 'text',
          text: param
        }))
      }];
    }
    
    const response = await callWhatsAppAPI('/messages', payload);
    
    logger.info({ 
      to, 
      templateName,
      languageCode,
      messageId: response.messages?.[0]?.id 
    }, 'Template message sent to WhatsApp');
    
    return response;
    
  } catch (err) {
    logger.error({ err, to, templateName }, 'Failed to send template message to WhatsApp');
    throw err;
  }
}

/**
 * Send auto-reply to incoming message
 * @param {string} to - Customer phone number
 * @param {string} originalMessage - Original message from customer
 * @param {object} options - Reply options
 * @returns {object} WhatsApp API response or null if no reply needed
 */
export async function sendAutoReply(to, originalMessage, options = {}) {
  try {
    // Simple auto-reply logic (customize based on your needs)
    let replyText = null;
    
    const lowerMessage = originalMessage.toLowerCase().trim();
    
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('halo')) {
      replyText = `Hello! Thank you for contacting us. How can we help you today?`;
    } else if (lowerMessage.includes('help') || lowerMessage.includes('bantuan')) {
      replyText = `I'm here to help! Please describe what you need assistance with.`;
    } else if (lowerMessage.includes('price') || lowerMessage.includes('harga')) {
      replyText = `For pricing information, please contact our sales team or visit our website.`;
    } else if (lowerMessage.includes('thank') || lowerMessage.includes('terima kasih')) {
      replyText = `You're welcome! Is there anything else I can help you with?`;
    }
    
    // Send reply if we have one
    if (replyText && !options.skipAutoReply) {
      return await sendTextMessage(to, replyText);
    }
    
    return null;
    
  } catch (err) {
    logger.error({ err, to, originalMessage }, 'Failed to send auto-reply');
    // Don't throw here - auto-reply failure shouldn't break the main flow
    return null;
  }
}

/**
 * Mark message as read
 * @param {string} messageId - WhatsApp message ID to mark as read
 * @returns {object} WhatsApp API response
 */
export async function markMessageAsRead(messageId) {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId
    };
    
    const response = await callWhatsAppAPI('/messages', payload);
    
    logger.debug({ messageId }, 'Message marked as read');
    return response;
    
  } catch (err) {
    logger.error({ err, messageId }, 'Failed to mark message as read');
    throw err;
  }
}

/**
 * Get WhatsApp media URL and download info
 * @param {string} mediaId - WhatsApp media ID
 * @returns {object} Media info with download URL
 */
export async function getWhatsAppMedia(mediaId) {
  try {
    const response = await callWhatsAppAPI(`/${mediaId}`, null, 'GET');
    
    logger.debug({ mediaId, url: response.url }, 'Retrieved WhatsApp media info');
    return response;
    
  } catch (err) {
    logger.error({ err, mediaId }, 'Failed to get WhatsApp media');
    throw err;
  }
}

/**
 * Call WhatsApp Business API
 * @param {string} endpoint - API endpoint (e.g., '/messages')
 * @param {object} payload - Request payload (null for GET)
 * @param {string} method - HTTP method (GET, POST)
 * @returns {object} API response
 */
async function callWhatsAppAPI(endpoint, payload = null, method = 'POST') {
  const url = `${config.whatsapp.baseUrl}/${config.whatsapp.graphVersion}/${config.whatsapp.phoneNumberId}${endpoint}`;
  
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${config.whatsapp.accessToken}`,
      'Content-Type': 'application/json'
    }
  };
  
  if (payload && method === 'POST') {
    options.body = JSON.stringify(payload);
  }
  
  logger.debug({ 
    url, 
    method, 
    hasPayload: !!payload 
  }, 'Calling WhatsApp API');
  
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ 
      status: response.status, 
      statusText: response.statusText,
      errorText,
      url 
    }, 'WhatsApp API call failed');
    
    throw new Error(`WhatsApp API error: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  const data = await response.json();
  
  logger.debug({ 
    status: response.status,
    messageId: data.messages?.[0]?.id 
  }, 'WhatsApp API call successful');
  
  return data;
}

/**
 * Validate WhatsApp phone number format
 * @param {string} phoneNumber - Phone number to validate
 * @returns {string} Cleaned phone number
 */
export function validateWhatsAppPhoneNumber(phoneNumber) {
  // Remove all non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Must be between 10-15 digits
  if (cleaned.length < 10 || cleaned.length > 15) {
    throw new Error(`Invalid phone number format: ${phoneNumber}`);
  }
  
  return cleaned;
}

// Send contacts object
export async function sendContactsMessage(to, contacts, options = {}) {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'contacts',
      contacts
    };
    if (options.replyTo) payload.context = { message_id: options.replyTo };
    const response = await callWhatsAppAPI('/messages', payload);
    logger.info({ to, count: contacts?.length, messageId: response.messages?.[0]?.id }, 'Contacts message sent');
    return response;
  } catch (err) {
    logger.error({ err, to }, 'Failed to send contacts');
    throw err;
  }
}

// Send location object
export async function sendLocationMessage(to, location, options = {}) {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'location',
      location
    };
    if (options.replyTo) payload.context = { message_id: options.replyTo };
    const response = await callWhatsAppAPI('/messages', payload);
    logger.info({ to, messageId: response.messages?.[0]?.id }, 'Location message sent');
    return response;
  } catch (err) {
    logger.error({ err, to }, 'Failed to send location');
    throw err;
  }
}

// Send reaction object
export async function sendReactionMessage(to, messageId, emoji) {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'reaction',
      reaction: {
        message_id: messageId,
        emoji
      }
    };
    const response = await callWhatsAppAPI('/messages', payload);
    logger.info({ to, messageId, emoji, waId: response.messages?.[0]?.id }, 'Reaction sent');
    return response;
  } catch (err) {
    logger.error({ err, to, messageId, emoji }, 'Failed to send reaction');
    throw err;
  }
}
