const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const logger = require('../utils/logger');

const adminAuthMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'No authentication token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if token is for admin
        if (decoded.role !== 'admin' && decoded.role !== 'superadmin') {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }

        const admin = await Admin.findById(decoded.userId).select('-password');

        if (!admin) {
            return res.status(401).json({ error: 'Admin not found' });
        }

        req.admin = admin;
        req.userId = decoded.userId;
        next();
    } catch (error) {
        logger.error('Admin auth error:', error.message);
        res.status(401).json({ error: 'Authentication failed' });
    }
};

module.exports = adminAuthMiddleware;
