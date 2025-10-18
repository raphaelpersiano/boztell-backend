import { logger } from '../utils/logger.js';
import { updateMessageStatus as updateMessageStatusDb, insertStatusHistory, getMessageByWaId, getMessageStats as getMessageStatsDb } from '../db.js';

/**
 * Handle WhatsApp message status updates (sent, delivered, read, failed)
 */
export async function handleMessageStatus(status, metadata) {
  const { id: wa_message_id, status: messageStatus, timestamp, recipient_id } = status;
  
  try {
    // Update message status in database
    const messageRows = await updateMessageStatusDb(
      wa_message_id,
      messageStatus,
      new Date(parseInt(timestamp) * 1000).toISOString()
    );
    
    // Log status history if message was found
    if (messageRows.rows.length > 0) {
      await insertStatusHistory({
        message_id: messageRows.rows[0].id,
        status: messageStatus,
        timestamp: new Date(parseInt(timestamp) * 1000).toISOString(),
        recipient_id,
        metadata: metadata || {}
      }).catch(err => {
        // Non-critical, don't throw
        logger.warn({ err, message_id: messageRows.rows[0].id }, 'Failed to log status history');
      });
    }
    
    // Emit status update to relevant room
    const messageResult = await getMessageByWaId(wa_message_id);
    const roomId = messageResult.rows[0]?.room_id;
    if (roomId) {
      // You can emit status updates to the room if needed
      // io.to(`room:${roomId}`).emit('message:status_update', { wa_message_id, status: messageStatus });
    }
    
    logger.debug({ wa_message_id, status: messageStatus }, 'Message status updated');
    
    return { type: 'status_update', wa_message_id, status: messageStatus };
    
  } catch (err) {
    logger.error({ err, wa_message_id, status: messageStatus }, 'Failed to handle message status');
    throw err;
  }
}



/**
 * Get message delivery statistics for a room
 */
export async function getMessageStats(roomId, limit = 100) {
  const { rows } = await getMessageStatsDb(roomId, limit);
  return rows[0];
}
