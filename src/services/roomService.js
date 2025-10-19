import { v4 as uuidv4 } from 'uuid';
import { getRoomById, getRoomByPhone as getRoomByPhoneDb, insertRoom, updateRoom, deleteRoom as deleteRoomDb, listRooms as listRoomsDb } from '../db.js';
import { logger } from '../utils/logger.js';

/**
 * Ensure room exists in database, create if not exists
 * @param {string} phone - Customer phone number
 * @param {object} metadata - Optional room metadata (leads_id, title, etc.)
 * @returns {object} Room data
 */
export async function ensureRoom(phone, metadata = {}) {
  try {
    // Check if room already exists by phone number
    const existingResult = await getRoomByPhoneDb(phone);
    
    if (existingResult && existingResult.rows && existingResult.rows.length > 0) {
      logger.debug({ phone }, 'Room already exists');
      return existingResult.rows[0];
    }
    
    // Create new room with UUID id
    const roomTitle = metadata.title || 'Personal';
    const leadsId = metadata.leads_id || null;
    
    const roomData = {
      id: uuidv4(), // Generate UUID for room ID
      leads_id: leadsId,
      phone: phone,
      title: roomTitle,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const insertResult = await insertRoom(roomData);
    
    if (!insertResult || !insertResult.rows || insertResult.rows.length === 0) {
      throw new Error('Failed to create new room - no data returned');
    }
    
    const newRoom = insertResult.rows[0];
    
    logger.info({ 
      roomId: newRoom.id,
      phone,
      roomTitle,
      leadsId 
    }, 'New room created successfully');
    
    return newRoom;
    
  } catch (err) {
    logger.error({ err, phone }, 'Failed to ensure room exists');
    throw err;
  }
}

/**
 * Update room metadata
 * @param {string} roomId 
 * @param {object} updates - Update fields (title, leads_id, phone)
 * @returns {object} Updated room
 */
export async function updateRoomMetadata(roomId, updates) {
  try {
    if (!updates.title && !updates.leads_id && !updates.phone) {
      throw new Error('No valid fields to update');
    }
    
    const updateData = {};
    if (updates.title) updateData.title = updates.title;
    if (updates.leads_id) updateData.leads_id = updates.leads_id;
    if (updates.phone) updateData.phone = updates.phone;
    
    const result = await updateRoom(roomId, updateData);
    
    if (!result || !result.rows || result.rows.length === 0) {
      throw new Error(`Room ${roomId} not found`);
    }
    
    logger.debug({ roomId }, 'Room metadata updated');
    return result.rows[0];
    
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
    const result = await getRoomById(roomId);
    return (result && result.rows && result.rows.length > 0) ? result.rows[0] : null;
  } catch (err) {
    logger.error({ err, roomId }, 'Failed to get room');
    throw err;
  }
}

/**
 * Get room by phone number
 * @param {string} phone 
 * @returns {object|null} Room data or null if not found
 */
export async function getRoomByPhone(phone) {
  try {
    const result = await getRoomByPhoneDb(phone);
    return (result && result.rows && result.rows.length > 0) ? result.rows[0] : null;
  } catch (err) {
    logger.error({ err, phone }, 'Failed to get room by phone');
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
    const result = await listRoomsDb(options);
    return (result && result.rows) ? result.rows : [];
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
    const result = await deleteRoomDb(roomId);
    
    if (!result || result.rowCount === 0) {
      throw new Error(`Room ${roomId} not found`);
    }
    
    logger.info({ roomId }, 'Room and associated messages deleted');
    return true;
    
  } catch (err) {
    logger.error({ err, roomId }, 'Failed to delete room');
    throw err;
  }
}
