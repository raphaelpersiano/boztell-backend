import express from 'express';
import { 
  authenticateUser, 
  getUserForMessage, 
  createUser, 
  updateUserPin, 
  getUsersFiltered,
  getSingleUser,
  removeUser 
} from '../services/userService.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * Authenticate user with phone/email and PIN
 */
router.post('/login', async (req, res) => {
  try {
    const { identifier, pin } = req.body;
    
    if (!identifier || !pin) {
      return res.status(400).json({
        success: false,
        message: 'Phone/email and PIN are required'
      });
    }
    
    const result = await authenticateUser(identifier, pin);
    
    if (result.success) {
      return res.json(result);
    } else {
      return res.status(401).json(result);
    }
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/auth/user/:id
 * Get user info by ID (for message sender lookup)
 */
router.get('/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await getUserForMessage(id);
    
    if (user) {
      res.json({
        success: true,
        user
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/users
 * Create new user (admin only)
 */
router.post('/users', async (req, res) => {
  try {
    const userData = req.body;
    
    const result = await createUser(userData);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
    
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/auth/users
 * Get all users (admin only)
 */
router.get('/users', async (req, res) => {
  try {
    const { role, is_active } = req.query;
    const filters = {};
    
    if (role) filters.role = role;
    if (is_active) filters.is_active = is_active === 'true';
    
    const result = await getUsersFiltered(filters);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
    
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * PUT /api/auth/user/:id/pin
 * Update user PIN
 */
router.put('/user/:id/pin', async (req, res) => {
  try {
    const { id } = req.params;
    const { oldPin, newPin } = req.body;
    
    if (!oldPin || !newPin) {
      return res.status(400).json({
        success: false,
        message: 'Old PIN and new PIN are required'
      });
    }
    
    const result = await updateUserPin(id, oldPin, newPin);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
    
  } catch (error) {
    console.error('Update PIN error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/auth/user/:id
 * Delete user (admin only)
 */
router.delete('/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await removeUser(id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
    
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/validate-session
 * Validate if user session is still valid (for frontend)
 */
router.post('/validate-session', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    const user = await getUserForMessage(userId);
    
    if (user) {
      res.json({
        success: true,
        message: 'Session valid',
        user
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid session'
      });
    }
    
  } catch (error) {
    console.error('Validate session error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;