import { logger } from '../utils/logger.js';
import { insertSystemEvent, getSystemEvents as getSystemEventsDb } from '../db.js';

/**
 * Handle WhatsApp system events (customer number changed, etc.)
 */
export async function handleSystemEvent(eventData) {
  const { system, room_id, sender_id, timestamp } = eventData;
  
  try {
    let eventType = 'unknown';
    let description = 'System event occurred';
    
    if (system) {
      if (system.customer_changed) {
        eventType = 'customer_changed';
        description = 'Customer number changed';
      } else if (system.user_changed) {
        eventType = 'user_changed';
        description = 'User information changed';
      } else if (system.wa_id_changed) {
        eventType = 'wa_id_changed';
        description = 'WhatsApp ID changed';
      }
    }
    
    // Log system event
    await insertSystemEvent({
      room_id,
      sender_id,
      event_type: eventType,
      description,
      event_data: system || {},
      timestamp: new Date(timestamp).toISOString()
    });
    
    logger.info({ 
      room_id, 
      sender_id, 
      event_type: eventType 
    }, 'System event processed');
    
    return { type: 'system_event', event_type: eventType, room_id };
    
  } catch (err) {
    logger.error({ err, room_id, sender_id }, 'Failed to handle system event');
    throw err;
  }
}



/**
 * Get recent system events for a room
 */
export async function getSystemEvents(roomId, limit = 50) {
  const { rows } = await getSystemEventsDb(roomId, limit);
  return rows.map(row => ({
    ...row,
    event_data: typeof row.event_data === 'string' 
      ? JSON.parse(row.event_data) 
      : row.event_data
  }));
}
