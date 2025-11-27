const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// JWT secret is required - fail loudly if not set
if (!process.env.JWT_SECRET) {
  logger.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Find user
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      logger.warn(`Authentication failed: User not found for token userId: ${decoded.userId}`);
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if user is banned
    if (user.isActive === false) {
      logger.warn(`Access attempt by banned user: ${user.email}`);
      return res.status(403).json({ error: 'Your account has been suspended' });
    }

    // Attach user to request
    req.user = user;
    req.userId = decoded.userId;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      logger.warn('Invalid JWT token provided');
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      logger.warn('Expired JWT token provided');
      return res.status(401).json({ error: 'Token expired' });
    }
    logger.error('Auth middleware error:', error.message);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

module.exports = authMiddleware;
