import { logger } from '../../utils/logger.js';
import { handleIncomingMessage } from '../../services/messageService.js';
import { handleIncomingMedia } from '../../services/mediaService.js';
import { ensureRoom } from '../../services/roomService.js';
import { handleMessageStatus } from '../../services/statusService.js';
import { handleSystemEvent } from '../../services/systemService.js';

/**
 * Route WhatsApp webhook events to appropriate handlers
 */
export async function routeWhatsAppWebhook({ io, body }) {
  if (!body?.entry) return [];

  const results = [];
  
  for (const entry of body.entry) {
    if (!entry.changes) continue;
    
    for (const change of entry.changes) {
      const { field, value } = change;
      
      if (field === 'messages') {
        const processed = await processMessagesField(io, value);
        results.push(...processed);
      }
    }
  }
  
  return results;
}

/**
 * Process the 'messages' field from webhook payload
 */
async function processMessagesField(io, value) {
  const results = [];
  
  // Handle incoming messages
  if (value.messages) {
    for (const message of value.messages) {
      try {
        const result = await processIncomingMessage(io, message, value);
        results.push(result);
      } catch (err) {
        logger.error({ err, message }, 'Failed to process incoming message');
      }
    }
  }
  
  // Handle message statuses (delivered, read, sent, failed)
  if (value.statuses) {
    for (const status of value.statuses) {
      try {
        const result = await handleMessageStatus(status, value);
        results.push(result);
      } catch (err) {
        logger.error({ err, status }, 'Failed to process message status');
      }
    }
  }
  
  // Handle errors
  if (value.errors) {
    for (const error of value.errors) {
      logger.error({ error, metadata: value.metadata }, 'WhatsApp API error received');
      results.push({ type: 'error', error });
    }
  }
  
  return results;
}

/**
 * Process individual incoming message based on type
 */
async function processIncomingMessage(io, message, value) {
  try {
  const { type, from, id: wa_message_id, timestamp } = message;
    const contacts = value.contacts || [];
    const metadata = value.metadata || {};
  const context = message.context || null;
    
    // Find contact info
    const contact = contacts.find(c => c.wa_id === from) || {};
    const senderName = contact.profile?.name || from;
    
    // Ensure room exists and get room ID
    const room = await ensureRoom(from, { phone: from, title: senderName || 'Personal' });
    const roomId = room.id;

  const baseMessage = {
      room_id: roomId,
      user_id: null, // Customer messages have user_id as null
      wa_message_id,
      timestamp: parseInt(timestamp) * 1000, // Convert to milliseconds
      type,
      context
    };
    
    logger.info({ 
      type, 
      from, 
      roomId, 
      wa_message_id 
    }, 'Processing incoming WhatsApp message');
    
    switch (type) {
      case 'text':
        return await handleTextMessage(io, { ...baseMessage, text: message.text });
        
      case 'image':
      case 'video':
      case 'audio':
      case 'document':
      case 'sticker':
  return await handleMediaMessage(io, { ...baseMessage, media: message[type] });
        
      case 'location':
        return await handleLocationMessage(io, { ...baseMessage, location: message.location });
        
      case 'contacts':
        return await handleContactsMessage(io, { ...baseMessage, contacts: message.contacts });
      case 'reaction':
        return await handleReactionMessage(io, { ...baseMessage, reaction: message.reaction });
        
      case 'interactive':
        return await handleInteractiveMessage(io, { ...baseMessage, interactive: message.interactive });
        
      case 'button':
        return await handleButtonMessage(io, { ...baseMessage, button: message.button });
        
      case 'order':
        return await handleOrderMessage(io, { ...baseMessage, order: message.order });
        
      case 'system':
        return await handleSystemEvent({ ...baseMessage, system: message.system });
        
      case 'referral':
        return await handleReferralMessage(io, { ...baseMessage, referral: message.referral });
        
      default:
        logger.warn({ type, message }, 'Unknown message type received');
        return { 
          type: 'unknown_message', 
          success: false,
          error: `Unknown message type: ${type}`,
          room_id: roomId,
          wa_message_id
        };
    }
    
  } catch (err) {
    logger.error({ err, message }, 'Failed to process incoming message');
    return {
      type: 'message_processing_error',
      success: false,
      error: err.message,
      wa_message_id: message?.id
    };
  }
}

/**
 * Handle text messages
 */
async function handleTextMessage(io, messageData) {
  try {
    const result = await handleIncomingMessage({ io }, {
      room_id: messageData.room_id,
      user_id: messageData.user_id, // null for customer messages
      content_type: 'text',
      content_text: messageData.text.body,
      wa_message_id: messageData.wa_message_id,
      metadata: { 
        timestamp: messageData.timestamp,
        type: 'text',
        reply_to: messageData.context?.id || null
      }
    });
    
    return {
      type: 'text_message',
      success: true,
      room_id: messageData.room_id,
      message_id: result.message_id,
      wa_message_id: messageData.wa_message_id
    };
    
  } catch (err) {
    logger.error({ err, messageData }, 'Failed to handle text message');
    return {
      type: 'text_message',
      success: false,
      error: err.message,
      room_id: messageData.room_id,
      wa_message_id: messageData.wa_message_id
    };
  }
}

/**
 * Handle media messages (image, video, audio, document, sticker)
 */
async function handleMediaMessage(io, messageData) {
  const { media, type } = messageData;
  
  return await handleIncomingMedia({ io }, {
    room_id: messageData.room_id,
    user_id: messageData.user_id, // null for customer messages
    media_type: type,
    media_id: media.id,
    caption: media.caption || '',
    filename: media.filename || null,
    mime_type: media.mime_type || null,
    sha256: media.sha256 || null,
    wa_message_id: messageData.wa_message_id,
    metadata: { timestamp: messageData.timestamp, reply_to: messageData.context?.id || null }
  });
}

/**
 * Handle location messages
 */
async function handleLocationMessage(io, messageData) {
  const { location } = messageData;
  
  return await handleIncomingMessage({ io }, {
    room_id: messageData.room_id,
    user_id: messageData.user_id, // null for customer messages
    content_type: 'location',
    content_text: `Location: ${location.latitude}, ${location.longitude}`,
    wa_message_id: messageData.wa_message_id,
    metadata: {
  timestamp: messageData.timestamp,
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        name: location.name,
        address: location.address
  },
  reply_to: messageData.context?.id || null
    }
  });
}

/**
 * Handle contact sharing messages
 */
async function handleContactsMessage(io, messageData) {
  const { contacts } = messageData;
  const contactsList = contacts.map(c => c.name?.formatted_name || 'Contact').join(', ');
  
  return await handleIncomingMessage({ io }, {
    room_id: messageData.room_id,
    user_id: messageData.user_id, // null for customer messages
    content_type: 'contacts',
    content_text: `Shared contacts: ${contactsList}`,
    wa_message_id: messageData.wa_message_id,
    metadata: {
  timestamp: messageData.timestamp,
  contacts,
  reply_to: messageData.context?.id || null
    }
  });
}

/**
 * Handle reaction messages
 */
async function handleReactionMessage(io, messageData) {
  const { reaction } = messageData;
  const text = `Reaction ${reaction.emoji} to ${reaction.message_id}`;
  return await handleIncomingMessage({ io }, {
    room_id: messageData.room_id,
    user_id: messageData.user_id, // null for customer messages
    content_type: 'reaction',
    content_text: text,
    wa_message_id: messageData.wa_message_id,
    metadata: {
      timestamp: messageData.timestamp,
      reaction
    }
  });
}

/**
 * Handle interactive messages (lists, buttons)
 */
async function handleInteractiveMessage(io, messageData) {
  const { interactive } = messageData;
  const { type: interactiveType } = interactive;
  
  let responseText = '';
  let responseData = {};
  
  switch (interactiveType) {
    case 'button_reply':
      responseText = `Button clicked: ${interactive.button_reply.title}`;
      responseData = { button_reply: interactive.button_reply };
      break;
    case 'list_reply':
      responseText = `List option selected: ${interactive.list_reply.title}`;
      responseData = { list_reply: interactive.list_reply };
      break;
    default:
      responseText = `Interactive response: ${interactiveType}`;
      responseData = interactive;
  }
  
  return await handleIncomingMessage({ io }, {
    room_id: messageData.room_id,
    user_id: messageData.user_id, // null for customer messages
    content_type: 'interactive',
    content_text: responseText,
    wa_message_id: messageData.wa_message_id,
    metadata: {
  timestamp: messageData.timestamp,
  interactive: responseData,
  reply_to: messageData.context?.id || null
    }
  });
}

/**
 * Handle button messages (legacy)
 */
async function handleButtonMessage(io, messageData) {
  const { button } = messageData;
  
  return await handleIncomingMessage({ io }, {
    room_id: messageData.room_id,
    user_id: messageData.user_id, // null for customer messages
    content_type: 'button',
    content_text: `Button: ${button.text}`,
    wa_message_id: messageData.wa_message_id,
    metadata: {
  timestamp: messageData.timestamp,
  button,
  reply_to: messageData.context?.id || null
    }
  });
}

/**
 * Handle order messages
 */
async function handleOrderMessage(io, messageData) {
  const { order } = messageData;
  
  return await handleIncomingMessage({ io }, {
    room_id: messageData.room_id,
    user_id: messageData.user_id, // null for customer messages
    content_type: 'order',
    content_text: `Order placed with ${order.product_items?.length || 0} items`,
    wa_message_id: messageData.wa_message_id,
    metadata: {
  timestamp: messageData.timestamp,
  order,
  reply_to: messageData.context?.id || null
    }
  });
}

/**
 * Handle referral messages
 */
async function handleReferralMessage(io, messageData) {
  const { referral } = messageData;
  
  return await handleIncomingMessage({ io }, {
    room_id: messageData.room_id,
    user_id: messageData.user_id, // null for customer messages
    content_type: 'referral',
    content_text: `Referral from ${referral.source_type}: ${referral.source_id}`,
    wa_message_id: messageData.wa_message_id,
    metadata: {
  timestamp: messageData.timestamp,
  referral,
  reply_to: messageData.context?.id || null
    }
  });
}


