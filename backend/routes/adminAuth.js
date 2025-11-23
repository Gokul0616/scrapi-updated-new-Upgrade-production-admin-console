const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// Admin Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check if user is admin
        if (user.role !== 'admin') {
            logger.warn(`Non-admin user attempted admin login: ${email}`);
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Create token
        const token = jwt.sign(
            { userId: user._id, role: 'admin' },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        logger.info(`Admin logged in: ${email}`);
        res.json({ token, user: { email: user.email, role: user.role, username: user.username } });
    } catch (error) {
        logger.error('Admin login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin Signup (Protected or Secret Key based? For now, open but we'll add a secret key check if needed, or just rely on manual DB update for first admin. 
// User asked for "add signup in admin console", so we'll allow it but maybe with a special code or just open for now as requested)
router.post('/signup', async (req, res) => {
    try {
        const { email, password, username, adminSecret } = req.body;

        // Simple protection: require a secret code to create admin
        // In production, this should be an env var. For now, hardcode or check env.
        const REQUIRED_SECRET = process.env.ADMIN_SIGNUP_SECRET || 'admin123';

        if (adminSecret !== REQUIRED_SECRET) {
            return res.status(403).json({ error: 'Invalid admin secret code' });
        }

        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        user = new User({
            email,
            password: hashedPassword,
            username,
            role: 'admin'
        });

        await user.save();

        const token = jwt.sign(
            { userId: user._id, role: 'admin' },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        logger.info(`New admin registered: ${email}`);
        res.status(201).json({ token, user: { email: user.email, role: user.role } });

    } catch (error) {
        logger.error('Admin signup error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
