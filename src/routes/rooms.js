import express from 'express';
import { getRoomsByUser, getAllRoomsWithDetails } from '../db.js';
import { logger } from '../utils/logger.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

/**
 * Get rooms for the authenticated user
 * - Admin/Supervisor: Get all rooms
 * - Agent: Get only assigned rooms via room_participants
 */
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { user } = req;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    let rooms = [];
    let result;

    // Check user role
    if (user.role === 'admin' || user.role === 'supervisor') {
      // Admin and supervisor can see all rooms
      result = await getAllRoomsWithDetails();
      rooms = result.rows;
      
      logger.info(`Admin/Supervisor ${user.id} accessed all rooms`, {
        userId: user.id,
        role: user.role,
        roomCount: result.rowCount
      });
    } else if (user.role === 'agent') {
      // Agents only see assigned rooms
      result = await getRoomsByUser(user.id);
      rooms = result.rows;
      
      logger.info(`Agent ${user.id} accessed assigned rooms`, {
        userId: user.id,
        role: user.role,
        roomCount: result.rowCount
      });
    } else {
      return res.status(403).json({
        success: false,
        error: 'Invalid user role'
      });
    }

    // Response sudah dalam format yang benar dari database functions
    const transformedRooms = rooms;

    res.json({
      success: true,
      data: {
        rooms: transformedRooms,
        total_count: result.rowCount,
        user_role: user.role
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
 * Get specific room details (for both admin and assigned agents)
 */
router.get('/:roomId', authenticateUser, async (req, res) => {
  try {
    const { user } = req;
    const { roomId } = req.params;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    let hasAccess = false;

    // Check access permissions
    if (user.role === 'admin' || user.role === 'supervisor') {
      hasAccess = true;
    } else if (user.role === 'agent') {
      // Check if agent is assigned to this room
      const userRooms = await getRoomsByUser(user.id);
      hasAccess = userRooms.rows.some(room => room.room_id === roomId);
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this room'
      });
    }

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
 * Assign agent to room (add room participant)
 * Only admin/supervisor can assign agents to rooms
 */
router.post('/:roomId/assign', authenticateUser, async (req, res) => {
  try {
    const { user } = req;
    const { roomId } = req.params;
    const { user_id } = req.body;

    // Only admin/supervisor can assign agents
    if (user.role !== 'admin' && user.role !== 'supervisor') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only admin/supervisor can assign agents to rooms.'
      });
    }

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
      assigned_by: user.id,
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
        joined_at: participantData.joined_at,
        assigned_by: user.id
      }
    });
  } catch (error) {
    logger.error({ error }, 'Failed to assign user to room');
    res.status(500).json({ success: false, error: 'Failed to assign user to room' });
  }
});

/**
 * Unassign user from room (remove room participant by user_id)
 * Only admin/supervisor can unassign users from rooms
 */
router.delete('/:roomId/assign/:userId', authenticateUser, async (req, res) => {
  try {
    const { user } = req;
    const { roomId, userId } = req.params;

    // Only admin/supervisor can unassign users
    if (user.role !== 'admin' && user.role !== 'supervisor') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only admin/supervisor can unassign users from rooms.'
      });
    }

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
      unassigned_by: user.id,
      action: 'room_unassignment' 
    }, 'User unassigned from room successfully');

    res.json({ 
      success: true, 
      message: 'User unassigned from room successfully',
      data: {
        room_id: roomId,
        user_id: userId,
        unassigned_by: user.id
      }
    });
  } catch (error) {
    logger.error({ error }, 'Failed to unassign user from room');
    res.status(500).json({ success: false, error: 'Failed to unassign user from room' });
  }
});

/**
 * Remove room participant by participant ID
 * Only admin/supervisor can remove participants
 */
router.delete('/participants/:participantId', authenticateUser, async (req, res) => {
  try {
    const { user } = req;
    const { participantId } = req.params;

    // Only admin/supervisor can remove participants
    if (user.role !== 'admin' && user.role !== 'supervisor') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only admin/supervisor can remove room participants.'
      });
    }

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
      removed_by: user.id,
      action: 'participant_removal' 
    }, 'Room participant removed successfully');

    res.json({ 
      success: true, 
      message: 'Room participant removed successfully',
      data: {
        participant_id: participantId,
        removed_by: user.id,
        removed_participant: result.rows[0]
      }
    });
  } catch (error) {
    logger.error({ error }, 'Failed to remove room participant');
    res.status(500).json({ success: false, error: 'Failed to remove room participant' });
  }
});

/**
 * Get room participants (agents assigned to room)
 */
router.get('/:roomId/participants', authenticateUser, async (req, res) => {
  try {
    const { user } = req;
    const { roomId } = req.params;

    // Check access (admin/supervisor or assigned agent)
    let hasAccess = false;
    if (user.role === 'admin' || user.role === 'supervisor') {
      hasAccess = true;
    } else if (user.role === 'agent') {
      const userRooms = await getRoomsByUser(user.id);
      hasAccess = userRooms.rows.some(room => room.room_id === roomId);
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this room'
      });
    }

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