import express from 'express';
import { getRoomsByUser, getAllRoomsWithDetails } from '../db.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * Get all rooms or rooms by user_id
 * - Query param: user_id (optional) - filter rooms based on user role
 * - If user_id provided AND role = 'agent': returns rooms from room_participants (assigned rooms only)
 * - If user_id provided AND role = 'admin'/'supervisor': returns ALL rooms
 * - If no user_id: returns all rooms (public access)
 */
router.get('/', async (req, res) => {
  try {
    const { user_id } = req.query;

    // If user_id provided, check user role first
    if (user_id) {
      const { getUserById } = await import('../db.js');
      
      // Get user info to check role
      const userResult = await getUserById(user_id);
      
      if (!userResult || !userResult.rows || userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          user_id
        });
      }
      
      const user = userResult.rows[0];
      
      // If user is agent, get only assigned rooms from room_participants
      if (user.role === 'agent') {
        const result = await getRoomsByUser(user_id);
        
        logger.info('Agent accessed assigned rooms', {
          user_id,
          user_name: user.name,
          user_role: user.role,
          roomCount: result.rowCount
        });

        return res.json({
          success: true,
          data: {
            rooms: result.rows,
            total_count: result.rowCount,
            filtered_by: 'agent_assigned_rooms',
            user_id,
            user_role: user.role
          }
        });
      }
      
      // If user is admin/supervisor, return ALL rooms (ignore room_participants)
      logger.info('Admin/Supervisor accessed all rooms', {
        user_id,
        user_name: user.name,
        user_role: user.role
      });
    }

    // No filter OR admin/supervisor: get all rooms
    const result = await getAllRoomsWithDetails();
    const rooms = result.rows;
    
    logger.info('Accessed all rooms', {
      user_id: user_id || 'none',
      roomCount: result.rowCount
    });

    res.json({
      success: true,
      data: {
        rooms: rooms,
        total_count: result.rowCount,
        filtered_by: user_id ? 'admin_all_rooms' : 'public_all_rooms'
      }
    });

  } catch (error) {
    logger.error('Error getting rooms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get rooms',
      details: error.message
    });
  }
});

/**
 * Get specific room details
 */
router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;

    // Get room details
    const allRooms = await getAllRoomsWithDetails();
    const room = allRooms.rows.find(r => r.room_id === roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }

    const roomData = {
      room_id: room.room_id,
      phone: room.room_phone,
      title: room.room_title || 'Personal',
      created_at: room.room_created_at,
      updated_at: room.room_updated_at,
      leads_id: room.leads_id || null,
      leads_info: room.leads_info ? {
        id: room.leads_info.id,
        utm_id: room.leads_info.utm_id,
        leads_status: room.leads_info.leads_status,
        contact_status: room.leads_info.contact_status,
        name: room.leads_info.name,
        phone: room.leads_info.phone,
        outstanding: room.leads_info.outstanding,
        loan_type: room.leads_info.loan_type
      } : null,
      participants: room.participants || []
    };

    res.json({
      success: true,
      data: roomData
    });

  } catch (error) {
    logger.error('Error getting room details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get room details',
      details: error.message
    });
  }
});

/**
 * Assign user to room (add room participant)
 */
router.post('/:roomId/assign', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'user_id is required',
        note: 'Specify the user_id to assign to this room'
      });
    }

    // Import room participant functions
    const { getRoomById, checkRoomParticipant, addRoomParticipant, getUserById } = await import('../db.js');

    // Check if room exists
    const roomResult = await getRoomById(roomId);
    if (!roomResult || roomResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Check if user exists and get user info
    const userResult = await getUserById(user_id);
    if (!userResult || userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const targetUser = userResult.rows[0];

    // Check if user already assigned
    const participantCheck = await checkRoomParticipant(roomId, user_id);
    const isAlreadyAssigned = participantCheck.rows.length > 0;
    
    if (isAlreadyAssigned) {
      return res.status(409).json({ 
        success: false, 
        error: 'User already assigned to this room',
        room_id: roomId,
        user_id,
        user_name: targetUser.name
      });
    }

    // Add participant - insert new row in room_participants table
    const participantData = {
      room_id: roomId,
      user_id: user_id,
      joined_at: new Date().toISOString()
    };

    const result = await addRoomParticipant(participantData);

    logger.info({ 
      room_id: roomId, 
      user_id, 
      user_name: targetUser.name,
      user_role: targetUser.role,
      action: 'room_assignment' 
    }, 'User assigned to room successfully');

    res.json({ 
      success: true, 
      message: 'User assigned to room successfully',
      data: {
        room_id: roomId,
        user_id,
        user_name: targetUser.name,
        user_email: targetUser.email,
        user_role: targetUser.role,
        joined_at: participantData.joined_at
      }
    });
  } catch (error) {
    logger.error({ error }, 'Failed to assign user to room');
    res.status(500).json({ success: false, error: 'Failed to assign user to room' });
  }
});

/**
 * Unassign user from room (remove room participant by user_id)
 */
router.delete('/:roomId/assign/:userId', async (req, res) => {
  try {
    const { roomId, userId } = req.params;

    // Import room functions
    const { getRoomById, removeRoomParticipant } = await import('../db.js');

    // Check if room exists
    const roomResult = await getRoomById(roomId);
    if (!roomResult || roomResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Remove participant by room_id and user_id
    const result = await removeRoomParticipant(roomId, userId);

    if (result.rowCount === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not assigned to this room',
        room_id: roomId,
        user_id: userId
      });
    }

    logger.info({ 
      room_id: roomId, 
      user_id: userId,
      action: 'room_unassignment' 
    }, 'User unassigned from room successfully');

    res.json({ 
      success: true, 
      message: 'User unassigned from room successfully',
      data: {
        room_id: roomId,
        user_id: userId
      }
    });
  } catch (error) {
    logger.error({ error }, 'Failed to unassign user from room');
    res.status(500).json({ success: false, error: 'Failed to unassign user from room' });
  }
});

/**
 * Remove room participant by participant ID
 */
router.delete('/participants/:participantId', async (req, res) => {
  try {
    const { participantId } = req.params;

    // Import room functions
    const { removeRoomParticipantById } = await import('../db.js');

    // Remove participant by ID
    const result = await removeRoomParticipantById(participantId);

    if (result.rowCount === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Room participant not found',
        participant_id: participantId
      });
    }

    logger.info({ 
      participant_id: participantId,
      action: 'participant_removal' 
    }, 'Room participant removed successfully');

    res.json({ 
      success: true, 
      message: 'Room participant removed successfully',
      data: {
        participant_id: participantId,
        removed_participant: result.rows[0]
      }
    });
  } catch (error) {
    logger.error({ error }, 'Failed to remove room participant');
    res.status(500).json({ success: false, error: 'Failed to remove room participant' });
  }
});

/**
 * Get room participants
 */
router.get('/:roomId/participants', async (req, res) => {
  try {
    const { roomId } = req.params;

    // Import room functions
    const { getRoomById, getRoomParticipantsWithUsers } = await import('../db.js');

    // Check if room exists
    const roomResult = await getRoomById(roomId);
    if (!roomResult || roomResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    const participantsResult = await getRoomParticipantsWithUsers(roomId);

    res.json({ 
      success: true, 
      data: participantsResult.rows,
      room_id: roomId,
      total_participants: participantsResult.rows.length
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get room participants');
    res.status(500).json({ success: false, error: 'Failed to get room participants' });
  }
});

export default router;