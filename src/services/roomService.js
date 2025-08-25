import { query } from '../db.js';
import { logger } from '../utils/logger.js';

/**
 * Ensure room exists in database, create if not exists
 * @param {string} roomId - Usually the customer phone number
 * @param {object} metadata - Optional room metadata (customer info, etc.)
 * @returns {object} Room data
 */
export async function ensureRoom(roomId, metadata = {}) {
  try {
    // Check if room already exists
    const checkSql = `
      SELECT * FROM rooms 
      WHERE id = $1 
      LIMIT 1;
    `;
    
    const { rows: existingRooms } = await query(checkSql, [roomId]);
    
    if (existingRooms.length > 0) {
      logger.debug({ roomId }, 'Room already exists');
      return existingRooms[0];
    }
    
    // Create new room
    const insertSql = `
      INSERT INTO rooms (
        id, 
        external_id,
        title,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING *;
    `;
    
    const roomTitle = metadata.customerName || `Customer ${roomId}`;
    const externalId = metadata.externalId || roomId;
    
    const { rows: newRooms } = await query(insertSql, [
      roomId,
      externalId,
      roomTitle
    ]);
    
    const newRoom = newRooms[0];
    
    logger.info({ 
      roomId, 
      roomTitle,
      externalId 
    }, 'New room created successfully');
    
    return newRoom;
    
  } catch (err) {
    logger.error({ err, roomId }, 'Failed to ensure room exists');
    throw err;
  }
}

/**
 * Update room metadata
 * @param {string} roomId 
 * @param {object} updates - Update fields (title, external_id)
 * @returns {object} Updated room
 */
export async function updateRoomMetadata(roomId, updates) {
  try {
    const setParts = [];
    const params = [roomId];
    
    if (updates.title) {
      setParts.push(`title = $${params.length + 1}`);
      params.push(updates.title);
    }
    
    if (updates.external_id) {
      setParts.push(`external_id = $${params.length + 1}`);
      params.push(updates.external_id);
    }
    
    if (setParts.length === 0) {
      throw new Error('No valid fields to update');
    }
    
    setParts.push(`updated_at = NOW()`);
    
    const sql = `
      UPDATE rooms 
      SET ${setParts.join(', ')}
      WHERE id = $1
      RETURNING *;
    `;
    
    const { rows } = await query(sql, params);
    
    if (rows.length === 0) {
      throw new Error(`Room ${roomId} not found`);
    }
    
    logger.debug({ roomId }, 'Room metadata updated');
    return rows[0];
    
  } catch (err) {
    logger.error({ err, roomId }, 'Failed to update room metadata');
    throw err;
  }
}

/**
 * Get room by ID
 * @param {string} roomId 
 * @returns {object|null} Room data or null if not found
 */
export async function getRoom(roomId) {
  try {
    const sql = `SELECT * FROM rooms WHERE id = $1 LIMIT 1`;
    const { rows } = await query(sql, [roomId]);
    
    return rows.length > 0 ? rows[0] : null;
  } catch (err) {
    logger.error({ err, roomId }, 'Failed to get room');
    throw err;
  }
}

/**
 * List all rooms with optional filtering
 * @param {object} options - Filter options
 * @returns {array} Array of rooms
 */
export async function listRooms(options = {}) {
  try {
    let sql = `
      SELECT r.*, 
             COUNT(m.id) as message_count,
             MAX(m.created_at) as last_message_at
      FROM rooms r
      LEFT JOIN messages m ON r.id = m.room_id
    `;
    
    const conditions = [];
    const params = [];
    
    if (options.title) {
      conditions.push(`r.title ILIKE $${params.length + 1}`);
      params.push(`%${options.title}%`);
    }
    
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    sql += `
      GROUP BY r.id
      ORDER BY last_message_at DESC NULLS LAST, r.created_at DESC
    `;
    
    if (options.limit) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }
    
    const { rows } = await query(sql, params);
    return rows;
    
  } catch (err) {
    logger.error({ err, options }, 'Failed to list rooms');
    throw err;
  }
}

/**
 * Delete room and all associated messages
 * @param {string} roomId 
 * @returns {boolean} Success status
 */
export async function deleteRoom(roomId) {
  try {
    // Delete messages first (due to foreign key)
    await query(`DELETE FROM messages WHERE room_id = $1`, [roomId]);
    
    // Delete room
    const { rowCount } = await query(`DELETE FROM rooms WHERE id = $1`, [roomId]);
    
    if (rowCount === 0) {
      throw new Error(`Room ${roomId} not found`);
    }
    
    logger.info({ roomId }, 'Room and associated messages deleted');
    return true;
    
  } catch (err) {
    logger.error({ err, roomId }, 'Failed to delete room');
    throw err;
  }
}
