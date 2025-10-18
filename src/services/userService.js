import { getUserById, getUsers, insertUser, updateUser, deleteUser } from '../db.js';

/**
 * User Authentication Service
 * Handles user authentication with PIN-based login for CRM
 */

/**
 * Authenticate user with phone/email and PIN
 */
export async function authenticateUser(identifier, pin) {
  try {
    // Find user by phone or email
    const filters = identifier.includes('@') 
      ? { email: identifier }
      : { phone: identifier };
    
    const result = await getUsers(filters);
    
    if (!result.rows || result.rows.length === 0) {
      return { success: false, message: 'User not found' };
    }
    
    const user = result.rows[0];
    
    // Validate PIN (6-digit integer)
    if (!pin || pin.toString().length !== 6) {
      return { success: false, message: 'PIN must be 6 digits' };
    }
    
    // Compare PIN (stored as integer)
    if (parseInt(pin) !== user.pin) {
      return { success: false, message: 'Invalid PIN' };
    }
    
    // Remove sensitive data from response
    const { pin: userPin, ...safeUser } = user;
    
    return {
      success: true,
      message: 'Authentication successful',
      user: safeUser
    };
    
  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, message: 'Authentication failed' };
  }
}

/**
 * Get user by ID for sender name lookup
 */
export async function getUserForMessage(userId) {
  try {
    const result = await getUserById(userId);
    
    if (!result.rows || result.rows.length === 0) {
      return null;
    }
    
    const user = result.rows[0];
    
    // Check if user is active
    if (!user.is_active) {
      return null;
    }
    
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role
    };
    
  } catch (error) {
    console.error('Get user for message error:', error);
    return null;
  }
}

/**
 * Create new user (for admin purposes)
 */
export async function createUser(userData) {
  try {
    // Validate required fields
    if (!userData.name || !userData.phone || !userData.email || !userData.pin) {
      return { success: false, message: 'Missing required fields: name, phone, email, pin' };
    }
    
    // Validate PIN is 6 digits
    if (userData.pin.toString().length !== 6) {
      return { success: false, message: 'PIN must be 6 digits' };
    }
    
    // Check if user already exists
    const existingByPhone = await getUsers({ phone: userData.phone });
    if (existingByPhone.rows && existingByPhone.rows.length > 0) {
      return { success: false, message: 'Phone number already exists' };
    }
    
    const existingByEmail = await getUsers({ email: userData.email });
    if (existingByEmail.rows && existingByEmail.rows.length > 0) {
      return { success: false, message: 'Email already exists' };
    }
    
    // Create user with all fields
    const userDataToInsert = {
      name: userData.name,
      phone: userData.phone,
      email: userData.email,
      pin: parseInt(userData.pin),
      role: userData.role || 'agent',
      avatar_url: userData.avatar_url || null,
      is_active: userData.is_active !== undefined ? userData.is_active : true
    };
    
    const result = await insertUser(userDataToInsert);
    
    if (result.rows && result.rows.length > 0) {
      const user = result.rows[0];
      const { pin, ...safeUser } = user;
      
      return {
        success: true,
        message: 'User created successfully',
        user: safeUser
      };
    }
    
    return { success: false, message: 'Failed to create user' };
    
  } catch (error) {
    console.error('Create user error:', error);
    return { success: false, message: 'Failed to create user' };
  }
}

/**
 * Update user PIN
 */
export async function updateUserPin(userId, oldPin, newPin) {
  try {
    // Get current user
    const result = await getUserById(userId);
    if (!result.rows || result.rows.length === 0) {
      return { success: false, message: 'User not found' };
    }
    
    const user = result.rows[0];
    
    // Validate old PIN
    if (parseInt(oldPin) !== user.pin) {
      return { success: false, message: 'Invalid current PIN' };
    }
    
    // Validate new PIN
    if (!newPin || newPin.toString().length !== 6) {
      return { success: false, message: 'New PIN must be 6 digits' };
    }
    
    // Update PIN
    const updateResult = await updateUser(userId, { pin: parseInt(newPin) });
    
    if (updateResult.rows && updateResult.rows.length > 0) {
      return {
        success: true,
        message: 'PIN updated successfully'
      };
    }
    
    return { success: false, message: 'Failed to update PIN' };
    
  } catch (error) {
    console.error('Update PIN error:', error);
    return { success: false, message: 'Failed to update PIN' };
  }
}

/**
 * Get all users (for admin)
 */
export async function getAllUsers() {
  try {
    const result = await getUsers();
    
    if (result.rows) {
      // Remove sensitive data
      const safeUsers = result.rows.map(user => {
        const { pin, ...safeUser } = user;
        return safeUser;
      });
      
      return {
        success: true,
        users: safeUsers
      };
    }
    
    return { success: false, message: 'Failed to get users' };
    
  } catch (error) {
    console.error('Get all users error:', error);
    return { success: false, message: 'Failed to get users' };
  }
}

/**
 * Update user (general update - used by both auth and users routes)
 */
export async function updateUserData(userId, updates) {
  try {
    // Remove PIN from updates if present (use updateUserPin for PIN changes)
    const { pin, ...safeUpdates } = updates;
    
    if (Object.keys(safeUpdates).length === 0) {
      return { success: false, message: 'No valid fields to update' };
    }
    
    const result = await updateUser(userId, safeUpdates);
    
    if (result.rows && result.rows.length > 0) {
      const user = result.rows[0];
      const { pin: userPin, ...safeUser } = user;
      
      return {
        success: true,
        message: 'User updated successfully',
        user: safeUser
      };
    }
    
    return { success: false, message: 'User not found' };
    
  } catch (error) {
    console.error('Update user error:', error);
    return { success: false, message: 'Failed to update user' };
  }
}

/**
 * Delete user
 */
export async function removeUser(userId) {
  try {
    const result = await deleteUser(userId);
    
    if (result.rowCount > 0) {
      return {
        success: true,
        message: 'User deleted successfully'
      };
    }
    
    return { success: false, message: 'User not found or already deleted' };
    
  } catch (error) {
    console.error('Delete user error:', error);
    return { success: false, message: 'Failed to delete user' };
  }
}

/**
 * Get users with filters (used by both auth and users routes)
 */
export async function getUsersFiltered(filters = {}) {
  try {
    const result = await getUsers(filters);
    
    if (result.rows) {
      // Remove PIN from all users
      const safeUsers = result.rows.map(user => {
        const { pin, ...safeUser } = user;
        return safeUser;
      });
      
      return {
        success: true,
        users: safeUsers
      };
    }
    
    return { success: false, message: 'Failed to get users' };
    
  } catch (error) {
    console.error('Get users filtered error:', error);
    return { success: false, message: 'Failed to get users' };
  }
}

/**
 * Get single user by ID (used by both auth and users routes)
 */
export async function getSingleUser(userId) {
  try {
    const result = await getUserById(userId);
    
    if (!result.rows || result.rows.length === 0) {
      return { success: false, message: 'User not found' };
    }
    
    const user = result.rows[0];
    const { pin, ...safeUser } = user;
    
    return {
      success: true,
      user: safeUser
    };
    
  } catch (error) {
    console.error('Get single user error:', error);
    return { success: false, message: 'Failed to get user' };
  }
}