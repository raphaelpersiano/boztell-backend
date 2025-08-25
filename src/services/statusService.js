import { logger } from '../utils/logger.js';
import { query } from '../db.js';

/**
 * Handle WhatsApp message status updates (sent, delivered, read, failed)
 */
export async function handleMessageStatus(status, metadata) {
  const { id: wa_message_id, status: messageStatus, timestamp, recipient_id } = status;
  
  try {
    // Update message status in database
    await updateMessageStatus({
      wa_message_id,
      status: messageStatus,
      timestamp: parseInt(timestamp) * 1000,
      recipient_id,
      metadata
    });
    
    // Emit status update to relevant room
    const roomId = await getRoomIdByMessageId(wa_message_id);
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
 * Update message status in database
 */
async function updateMessageStatus({ wa_message_id, status, timestamp, recipient_id, metadata }) {
  const sql = `
    UPDATE messages 
    SET 
      status = $2,
      status_timestamp = $3,
      updated_at = NOW()
    WHERE wa_message_id = $1
    RETURNING id, room_id;
  `;
  
  const { rows } = await query(sql, [wa_message_id, status, new Date(timestamp)]);
  
  // Also log status history if needed
  if (rows.length > 0) {
    await logStatusHistory({
      message_id: rows[0].id,
      status,
      timestamp: new Date(timestamp),
      recipient_id,
      metadata
    });
  }
  
  return rows[0];
}

/**
 * Log status history for analytics
 */
async function logStatusHistory({ message_id, status, timestamp, recipient_id, metadata }) {
  const sql = `
    INSERT INTO message_status_history (
      message_id, status, timestamp, recipient_id, metadata, created_at
    ) VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT DO NOTHING;
  `;
  
  try {
    await query(sql, [
      message_id, 
      status, 
      timestamp, 
      recipient_id,
      JSON.stringify(metadata || {})
    ]);
  } catch (err) {
    // Non-critical, don't throw
    logger.warn({ err, message_id }, 'Failed to log status history');
  }
}

/**
 * Get room ID by WhatsApp message ID
 */
async function getRoomIdByMessageId(wa_message_id) {
  const sql = `SELECT room_id FROM messages WHERE wa_message_id = $1 LIMIT 1`;
  const { rows } = await query(sql, [wa_message_id]);
  return rows[0]?.room_id || null;
}

/**
 * Get message delivery statistics for a room
 */
export async function getMessageStats(roomId, limit = 100) {
  const sql = `
    SELECT 
      COUNT(*) as total_messages,
      COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
      COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_count,
      COUNT(CASE WHEN status = 'read' THEN 1 END) as read_count,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count
    FROM messages 
    WHERE room_id = $1 
    AND wa_message_id IS NOT NULL
    AND created_at > NOW() - INTERVAL '24 hours'
    LIMIT $2;
  `;
  
  const { rows } = await query(sql, [roomId, limit]);
  return rows[0];
}
