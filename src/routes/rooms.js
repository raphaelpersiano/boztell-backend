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
router.get('/rooms', authenticateUser, async (req, res) => {
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
router.get('/rooms/:roomId', authenticateUser, async (req, res) => {
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
      hasAccess = userRooms.rows.some(room => room.id === roomId);
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this room'
      });
    }

    // Get room details
    const allRooms = await getAllRoomsWithDetails();
    const room = allRooms.rows.find(r => r.id === roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }

    const roomData = {
      room_id: room.id,
      phone: room.phone,
      title: room.title || 'Personal',
      created_at: room.created_at,
      updated_at: room.updated_at,
      leads_info: room.leads ? {
        id: room.leads.id,
        name: room.leads.name,
        company: room.leads.company,
        status: room.leads.status
      } : null,
      participants: room.room_participants?.map(participant => ({
        user_id: participant.user_id,
        joined_at: participant.joined_at,
        user_info: participant.users ? {
          id: participant.users.id,
          name: participant.users.name,
          email: participant.users.email,
          role: participant.users.role
        } : null
      })) || []
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

export default router;