import { getUserById } from '../db.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware to authenticate user based on user_id
 * Expects x-user-id header or user_id in request body
 */
export async function authenticateUser(req, res, next) {
  try {
    const userId = req.headers['x-user-id'] || req.body.user_id || req.query.user_id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Provide user_id in x-user-id header, request body, or query parameter.'
      });
    }

    // Get user by ID
    const result = await getUserById(userId);
    
    if (result.rowCount === 0) {
      logger.warn('Authentication failed - user not found', { userId });
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = result.rows[0];
    
    // Check if user is active
    if (!user.is_active) {
      logger.warn('Authentication failed - inactive user', { userId: user.id });
      return res.status(401).json({
        success: false,
        error: 'User account is inactive'
      });
    }

    // Add user to request object
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      is_active: user.is_active,
      created_at: user.created_at
    };

    logger.info('User authenticated successfully', {
      userId: user.id,
      role: user.role,
      endpoint: req.originalUrl
    });

    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      details: error.message
    });
  }
}

/**
 * Middleware to check if user has required role
 */
export function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      logger.warn('Access denied - insufficient role', {
        userId: req.user.id,
        userRole,
        requiredRoles: allowedRoles,
        endpoint: req.originalUrl
      });
      
      return res.status(403).json({
        success: false,
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}`
      });
    }

    next();
  };
}

/**
 * Middleware for admin-only endpoints
 */
export const requireAdmin = requireRole('admin');

/**
 * Middleware for admin and supervisor endpoints
 */
export const requireAdminOrSupervisor = requireRole(['admin', 'supervisor']);

/**
 * Optional authentication - sets user if user_id provided but doesn't fail if not
 */
export async function optionalAuth(req, res, next) {
  try {
    const userId = req.headers['x-user-id'] || req.body.user_id || req.query.user_id;
    
    if (userId) {
      const result = await getUserById(userId);
      if (result.rowCount > 0 && result.rows[0].is_active) {
        const user = result.rows[0];
        req.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          is_active: user.is_active,
          created_at: user.created_at
        };
      }
    }

    next();
  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    // Don't fail the request, just continue without user
    next();
  }
}