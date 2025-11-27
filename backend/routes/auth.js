const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

// Base URL for assets (use env var or default to current server)
const BASE_URL = process.env.BACKEND_URL || 'http://localhost:8001';

const profile1 = `${BASE_URL}/resources/image/profile1.png`;
const profile2 = `${BASE_URL}/resources/image/profile2.png`;
const profile3 = `${BASE_URL}/resources/image/profile3.png`;
const profile4 = `${BASE_URL}/resources/image/profile4.png`;
const profile5 = `${BASE_URL}/resources/image/profile5.png`;

// Rate limiting is now handled globally in server.js

// Avatar options
const AVATAR_OPTIONS = [
  profile1,
  profile2,
  profile3,
  profile4,
  profile5
];

// Helper function to get random avatar
const getRandomAvatar = () => {
  return AVATAR_OPTIONS[Math.floor(Math.random() * AVATAR_OPTIONS.length)];
};

// Register with validation (rate limiting handled globally)
router.post('/register',
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be between 3 and 30 characters')
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Username can only contain letters, numbers, underscores and hyphens'),
    body('email')
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    body('name')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Name must not exceed 100 characters')
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { name, username, email, password } = req.body;

      // Check if user exists
      const existingUser = await User.findOne({ $or: [{ email }, { username }] });
      if (existingUser) {
        if (existingUser.email === email) {
          return res.status(400).json({ error: 'Email already registered' });
        }
        if (existingUser.username === username) {
          return res.status(400).json({ error: 'Username already taken' });
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user with random avatar
      const user = new User({
        username,
        email,
        password: hashedPassword,
        fullName: name || username,
        avatar: getRandomAvatar()
      });

      await user.save();

      // Create JWT token with 30 days expiration
      const token = jwt.sign(
        { userId: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      logger.info(`New user registered: ${user.username} (${user.email})`);

      res.status(201).json({
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          avatar: user.avatar,
          plan: user.plan
        }
      });
    } catch (error) {
      logger.error('Registration error:', error.message);
      res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
  });

// Login with validation (rate limiting handled globally)
router.post('/login',
  [
    body('email')
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { email, password } = req.body;

      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        logger.warn(`Failed login attempt for non-existent user: ${email}`);
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Check if user is banned
      if (user.isActive === false) {
        logger.warn(`Login attempt by banned user: ${email}`);
        return res.status(403).json({ error: 'Your account has been suspended. Please contact support.' });
      }

      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        logger.warn(`Failed login attempt for user: ${email} - incorrect password`);
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Create JWT token with 30 days expiration
      const token = jwt.sign(
        { userId: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      logger.info(`User logged in: ${user.username} (${user.email})`);

      res.json({
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          avatar: user.avatar,
          plan: user.plan
        }
      });
    } catch (error) {
      logger.error('Login error:', error.message);
      res.status(500).json({ error: 'Login failed. Please try again.' });
    }
  });

// Get current user profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        avatar: user.avatar,
        plan: user.plan,
        organization: user.organization,
        notifications: user.notifications
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { username, fullName, organization } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if username is taken by another user
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username, _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(400).json({ error: 'Username already taken' });
      }
      user.username = username;
    }

    if (fullName !== undefined) user.fullName = fullName;
    if (organization !== undefined) user.organization = organization;

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        organization: user.organization,
        avatar: user.avatar,
        plan: user.plan
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update avatar
router.put('/avatar', authMiddleware, async (req, res) => {
  try {
    const { avatar } = req.body;

    if (!avatar) {
      return res.status(400).json({ error: 'Avatar URL is required' });
    }

    // Validate that the avatar is one of the allowed options
    if (!AVATAR_OPTIONS.includes(avatar)) {
      return res.status(400).json({ error: 'Invalid avatar URL' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.avatar = avatar;
    await user.save();

    res.json({
      message: 'Avatar updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        avatar: user.avatar,
        plan: user.plan
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get available avatars
router.get('/avatars', authMiddleware, async (req, res) => {
  res.json({ avatars: AVATAR_OPTIONS });
});

// Change password
router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Please provide current and new password' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash and save new password
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API Token Management
router.post('/api-tokens', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Token name is required' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate random token
    const token = jwt.sign(
      { userId: user._id, type: 'api-token' },
      process.env.JWT_SECRET,
      { expiresIn: '365d' }
    );

    user.apiTokens.push({ name, token });
    await user.save();

    res.status(201).json({ message: 'API token created', token: { name, token } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api-tokens', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Mask tokens for security
    const maskedTokens = user.apiTokens.map(t => ({
      name: t.name,
      token: `${t.token.slice(0, 8)}...${t.token.slice(-4)}`,
      createdAt: t.createdAt,
      lastUsed: t.lastUsed
    }));

    res.json({ tokens: maskedTokens });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/api-tokens/:tokenId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.apiTokens = user.apiTokens.filter(t => t._id.toString() !== req.params.tokenId);
    await user.save();

    res.json({ message: 'API token deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Notification preferences
router.put('/notifications', authMiddleware, async (req, res) => {
  try {
    const { email, platform, actorRuns, billing } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (email !== undefined) user.notifications.email = email;
    if (platform !== undefined) user.notifications.platform = platform;
    if (actorRuns !== undefined) user.notifications.actorRuns = actorRuns;
    if (billing !== undefined) user.notifications.billing = billing;

    await user.save();

    res.json({ message: 'Notification preferences updated', notifications: user.notifications });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
