/**
 * Authentication Middleware
 * Verifies JWT tokens and checks user roles
 */

import { supabaseAdmin } from '../supabase.js';

/**
 * Middleware to authenticate requests using Supabase JWT
 * Attaches user object to req.user if valid
 */
export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid authorization header'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }

    // Fetch user role from user_roles table
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError) {
      console.error('Error fetching user role:', roleError);
      // Default to viewer if no role found
      user.role = 'viewer';
    } else {
      user.role = roleData?.role || 'viewer';
    }

    // Attach user to request object
    req.user = user;
    req.accessToken = token;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication failed'
    });
  }
}

/**
 * Middleware factory to check if user has required role(s)
 * Must be used after authenticate middleware
 * @param {...string} allowedRoles - Roles that are allowed to access the route
 * @returns {Function} Express middleware function
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
      });
    }

    next();
  };
}

/**
 * Middleware to require admin role
 * Convenience wrapper for requireRole('admin')
 */
export const requireAdmin = requireRole('admin');

/**
 * Middleware to require surveyor role (or admin)
 * Convenience wrapper for requireRole('admin', 'surveyor')
 */
export const requireSurveyor = requireRole('admin', 'surveyor');

/**
 * Middleware to require client role (or admin/surveyor)
 * Convenience wrapper for requireRole('admin', 'surveyor', 'client')
 */
export const requireClient = requireRole('admin', 'surveyor', 'client');
