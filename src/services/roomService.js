import { v4 as uuidv4 } from 'uuid';
import { getRoomById, getRoomByPhone as getRoomByPhoneDb, insertRoom, updateRoom, deleteRoom as deleteRoomDb, listRooms as listRoomsDb } from '../db.js';
import { logger } from '../utils/logger.js';

/**
 * Ensure room exists in database, create if not exists
 * Auto-creates lead if phone number doesn't exist in leads table
 * @param {string} phone - Customer phone number
 * @param {object} metadata - Optional room metadata (leads_id, title, etc.)
 * @param {object} io - Socket.IO instance for broadcasting new room event
 * @returns {object} Room data
 */
export async function ensureRoom(phone, metadata = {}, io = null) {
  try {
    // Check if room already exists by phone number
    const existingResult = await getRoomByPhoneDb(phone);
    
    if (existingResult && existingResult.rows && existingResult.rows.length > 0) {
      logger.debug({ phone }, 'Room already exists');
      return existingResult.rows[0];
    }
    
    // Check if lead exists for this phone number, create if not exists
    let leadsId = metadata.leads_id || null;
    
    if (!leadsId) {
      try {
        // Import leads functions
        const { getLeads, insertLead } = await import('../db.js');
        
        // Check if lead exists by phone
        const existingLeadResult = await getLeads({ phone: phone });
        
        if (existingLeadResult && existingLeadResult.rows && existingLeadResult.rows.length > 0) {
          // Lead exists, use existing lead ID
          leadsId = existingLeadResult.rows[0].id;
          logger.debug({ phone, leadsId }, 'Using existing lead for room');
        } else {
          // Create new lead for this phone number
          const leadData = {
            name: metadata.customer_name || `Customer ${phone}`,
            phone: phone,
            outstanding: 0,
            loan_type: metadata.loan_type || 'personal_loan',
            leads_status: 'cold',
            contact_status: 'contacted' // Since they're contacting via WhatsApp
          };
          
          const newLeadResult = await insertLead(leadData);
          
          if (newLeadResult && newLeadResult.rows && newLeadResult.rows.length > 0) {
            leadsId = newLeadResult.rows[0].id;
            logger.info({ 
              phone, 
              leadsId, 
              leadData 
            }, 'New lead created automatically for room');
          }
        }
      } catch (leadErr) {
        logger.warn({ err: leadErr, phone }, 'Failed to ensure lead exists, proceeding without leads_id');
        // Continue without leads_id - room can exist without lead relationship
      }
    }
    
    // Create new room with UUID id
    const roomTitle = metadata.title || (metadata.customer_name || 'Personal');
    
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
      leadsId,
      autoCreatedLead: !metadata.leads_id && leadsId
    }, 'New room created successfully with lead relationship');
    
    // NOTE: We don't emit 'new_room' event here anymore
    // Instead, we'll emit 'new_room_complete' from messageService after first message
    // This prevents race condition where room appears without last_message data
    
    logger.info({ 
      roomId: newRoom.id, 
      phone,
      title: roomTitle,
      note: 'Room created, waiting for first message to emit socket event'
    }, '📡 Room ready for first message event');
    
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
