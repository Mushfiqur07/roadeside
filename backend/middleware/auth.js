const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mongoose = require('mongoose');

// Maintenance settings access (shared quick getter)
const settingsSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true, collection: 'settings' });
const Setting = mongoose.models.Setting || mongoose.model('Setting', settingsSchema);
async function getMaintenanceStatus() {
  try {
    const doc = await Setting.findOne({ key: 'maintenanceMode' });
    return !!doc?.value;
  } catch {
    return false;
  }
}

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      console.log('❌ authenticateToken: No token provided');
      return res.status(401).json({ 
        message: 'Access token is required',
        success: false 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    console.log('🔍 authenticateToken: Token decoded:', { userId: decoded.userId, role: decoded.role });
    
    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      console.log('❌ authenticateToken: User not found for ID:', decoded.userId);
      return res.status(401).json({ 
        message: 'Invalid token - user not found',
        success: false 
      });
    }

    console.log('🔍 authenticateToken: User found:', { name: user.name, role: user.role, id: user._id });
    
    // If token has role but user doesn't (for backward compatibility)
    if (decoded.role && !user.role) {
      console.log('🔧 authenticateToken: Setting user role from token:', decoded.role);
      user.role = decoded.role;
    }

    if (!user.isActive) {
      console.log('❌ authenticateToken: User account is deactivated:', user.name);
      return res.status(401).json({ 
        message: 'Account is deactivated',
        success: false 
      });
    }

    console.log('✅ authenticateToken: Authentication successful for user:', user.name, 'Role:', user.role);

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('❌ authenticateToken error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: 'Invalid token',
        success: false 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token expired',
        success: false 
      });
    }
    
    return res.status(500).json({ 
      message: 'Authentication error',
      success: false 
    });
  }
};

// Middleware to check if user has specific role
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required',
        success: false 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Access denied. Required role: ${roles.join(' or ')}`,
        success: false 
      });
    }

    next();
  };
};

// Middleware to check if user is admin
const requireAdmin = requireRole('admin');

// Middleware to check if user is mechanic or admin
const requireMechanic = requireRole('mechanic', 'admin');

// Middleware to check if user owns the resource or is admin
const requireOwnershipOrAdmin = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required',
        success: false 
      });
    }

    // Admin can access everything
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user owns the resource
    const resourceUserId = req.body[resourceUserIdField] || 
                          req.params[resourceUserIdField] || 
                          req.query[resourceUserIdField];

    if (!resourceUserId) {
      return res.status(400).json({ 
        message: 'Resource user ID not found',
        success: false 
      });
    }

    if (req.user._id.toString() !== resourceUserId.toString()) {
      return res.status(403).json({ 
        message: 'Access denied. You can only access your own resources',
        success: false 
      });
    }

    next();
  };
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireMechanic,
  requireOwnershipOrAdmin,
  optionalAuth
};

// Global maintenance guard (non-admins blocked when maintenance is ON)
module.exports.maintenanceGuard = async (req, res, next) => {
  try {
    const isMaintenance = await getMaintenanceStatus();
    if (!isMaintenance) return next();

    // Allow admins and admin endpoints
    if (req.user?.role === 'admin') return next();

    // Allow health and maintenance status endpoints
    const allowedPaths = ['/api/health', '/api/status/maintenance'];
    if (allowedPaths.includes(req.path)) return next();

    return res.status(503).json({
      success: false,
      message: 'Service under maintenance. Please try again later.',
      data: { maintenance: true }
    });
  } catch (e) {
    return res.status(503).json({ success: false, message: 'Service temporarily unavailable' });
  }
};
