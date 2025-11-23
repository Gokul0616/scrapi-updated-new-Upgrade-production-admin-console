const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const Admin = require('../models/Admin');
const authMiddleware = require('../middleware/auth'); // We can reuse this or create specific admin middleware
const logger = require('../utils/logger');

// Admin Register
router.post('/register',
    [
        body('name').trim().notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Please provide a valid email'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ error: errors.array()[0].msg });
            }

            const { name, email, password, secretKey } = req.body;

            // Simple protection for admin registration
            // In production, you might want to disable public registration or require a secret key
            // For now, let's assume we want to allow it but maybe log it heavily

            // Check if admin exists
            let admin = await Admin.findOne({ email });
            if (admin) {
                return res.status(400).json({ error: 'Admin already exists' });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            admin = new Admin({
                name,
                email,
                password: hashedPassword
            });

            await admin.save();

            // Create token
            const token = jwt.sign(
                { userId: admin._id, role: 'admin' },
                process.env.JWT_SECRET,
                { expiresIn: '1d' }
            );

            logger.info(`New admin registered: ${email}`);

            res.status(201).json({
                token,
                admin: {
                    id: admin._id,
                    name: admin.name,
                    email: admin.email,
                    role: admin.role
                }
            });
        } catch (error) {
            logger.error('Admin registration error:', error.message);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// Admin Login
router.post('/login',
    [
        body('email').isEmail().withMessage('Please provide a valid email'),
        body('password').exists().withMessage('Password is required')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ error: errors.array()[0].msg });
            }

            const { email, password } = req.body;

            // Check for admin
            const admin = await Admin.findOne({ email });
            if (!admin) {
                return res.status(400).json({ error: 'Invalid credentials' });
            }

            // Check password
            const isMatch = await bcrypt.compare(password, admin.password);
            if (!isMatch) {
                return res.status(400).json({ error: 'Invalid credentials' });
            }

            // Update last login
            admin.lastLogin = Date.now();
            await admin.save();

            // Create token
            const token = jwt.sign(
                { userId: admin._id, role: admin.role },
                process.env.JWT_SECRET,
                { expiresIn: '1d' }
            );

            logger.info(`Admin logged in: ${email}`);

            res.json({
                token,
                admin: {
                    id: admin._id,
                    name: admin.name,
                    email: admin.email,
                    role: admin.role
                }
            });
        } catch (error) {
            logger.error('Admin login error:', error.message);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// Get Current Admin
router.get('/me', require('../middleware/adminAuth'), async (req, res) => {
    try {
        const admin = await Admin.findById(req.userId).select('-password');
        if (!admin) {
            return res.status(404).json({ error: 'Admin not found' });
        }
        res.json(admin);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
