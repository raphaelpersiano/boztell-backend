import express from 'express';
import { getAgents } from '../db.js';
import { 
  createUser, 
  updateUserData, 
  removeUser, 
  getUsersFiltered,
  getSingleUser 
} from '../services/userService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Get all users
router.get('/', async (req, res) => {
  try {
    const { role, is_active } = req.query;
    const filters = {};
    
    if (role) filters.role = role;
    if (is_active !== undefined) filters.is_active = is_active === 'true';

    const result = await getUsersFiltered(filters);
    
    if (result.success) {
      res.json({ success: true, data: result.users });
    } else {
      res.status(500).json({ success: false, error: result.message });
    }
  } catch (error) {
    logger.error({ error }, 'Failed to get users');
    res.status(500).json({ success: false, error: 'Failed to get users' });
  }
});

// Get single user
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getSingleUser(id);

    if (result.success) {
      res.json({ success: true, data: result.user });
    } else {
      res.status(404).json({ success: false, error: result.message });
    }
  } catch (error) {
    logger.error({ error }, 'Failed to get user');
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
});

// Create new user
router.post('/', async (req, res) => {
  try {
    const {
      email,
      name,
      phone,
      pin,
      role = 'agent',
      avatar_url,
      is_active = true
    } = req.body;

    if (!email || !name || !phone || !pin) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, name, phone, pin'
      });
    }

    const userData = {
      email,
      name,
      phone,
      pin,
      role,
      avatar_url,
      is_active
    };

    const result = await createUser(userData);

    if (result.success) {
      res.status(201).json({ success: true, data: result.user });
    } else {
      res.status(400).json({ success: false, error: result.message });
    }
  } catch (error) {
    logger.error({ error }, 'Failed to create user');
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

// Update user
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, role, avatar_url, is_active } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (is_active !== undefined) updates.is_active = is_active;

    const result = await updateUserData(id, updates);

    if (result.success) {
      res.json({ success: true, data: result.user });
    } else {
      res.status(404).json({ success: false, error: result.message });
    }
  } catch (error) {
    logger.error({ error }, 'Failed to update user');
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await removeUser(id);

    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(404).json({ success: false, error: result.message });
    }
  } catch (error) {
    logger.error({ error }, 'Failed to delete user');
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});

// Get agents only
router.get('/agents/list', async (req, res) => {
  try {
    const { rows } = await getAgents();
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error({ error }, 'Failed to get agents');
    res.status(500).json({ success: false, error: 'Failed to get agents' });
  }
});

export default router;