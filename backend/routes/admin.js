const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const backupManager = require('../utils/backup');
const cache = require('../utils/cache');
const metrics = require('../utils/metrics');
const User = require('../models/User');
const Run = require('../models/Run');

/**
 * @swagger
 * /api/admin/metrics:
 *   get:
 *     summary: Get application metrics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Application metrics
 *       401:
 *         description: Unauthorized
 */
router.get('/metrics', auth, async (req, res) => {
  try {
    const metricsData = metrics.getMetrics();
    res.json(metricsData);
  } catch (error) {
    logger.error('Failed to get metrics:', error.message);
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
});

/**
 * @swagger
 * /api/admin/metrics/prometheus:
 *   get:
 *     summary: Get Prometheus format metrics
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Metrics in Prometheus format
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
router.get('/metrics/prometheus', async (req, res) => {
  try {
    const prometheusMetrics = metrics.getPrometheusMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(prometheusMetrics);
  } catch (error) {
    logger.error('Failed to get Prometheus metrics:', error.message);
    res.status(500).send('# Error retrieving metrics');
  }
});

/**
 * @swagger
 * /api/admin/backup:
 *   post:
 *     summary: Create database backup
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Backup created successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Backup failed
 */
router.post('/backup', auth, async (req, res) => {
  try {
    const backup = await backupManager.createBackup();
    logger.info(`Backup created: ${backup.name}`);
    res.json({
      success: true,
      backup: backup
    });
  } catch (error) {
    logger.error('Backup creation failed:', error.message);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

/**
 * @swagger
 * /api/admin/backup/list:
 *   get:
 *     summary: List all backups
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of backups
 *       401:
 *         description: Unauthorized
 */
router.get('/backup/list', auth, async (req, res) => {
  try {
    const backups = await backupManager.listBackups();
    res.json({ backups });
  } catch (error) {
    logger.error('Failed to list backups:', error.message);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

/**
 * @swagger
 * /api/admin/backup/restore:
 *   post:
 *     summary: Restore from backup
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - backupName
 *             properties:
 *               backupName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Restore successful
 *       400:
 *         description: Invalid backup name
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Restore failed
 */
router.post('/backup/restore', auth, async (req, res) => {
  try {
    const { backupName } = req.body;

    if (!backupName) {
      return res.status(400).json({ error: 'Backup name is required' });
    }

    const result = await backupManager.restoreBackup(backupName);
    logger.info(`Database restored from: ${backupName}`);
    res.json(result);
  } catch (error) {
    logger.error('Restore failed:', error.message);
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

/**
 * @swagger
 * /api/admin/cache/clear:
 *   post:
 *     summary: Clear application cache
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/cache/clear', auth, async (req, res) => {
  try {
    await cache.flushAll();
    logger.info('Cache cleared by admin');
    res.json({ success: true, message: 'Cache cleared successfully' });
  } catch (error) {
    logger.error('Failed to clear cache:', error.message);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

/**
 * @swagger
 * /api/admin/cache/stats:
 *   get:
 *     summary: Get cache statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache statistics
 *       401:
 *         description: Unauthorized
 */
router.get('/cache/stats', auth, async (req, res) => {
  try {
    const stats = await cache.getStats();
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get cache stats:', error.message);
    res.status(500).json({ error: 'Failed to retrieve cache statistics' });
  }
});

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Get application statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Application statistics
 *       401:
 *         description: Unauthorized
 */
router.get('/stats', auth, async (req, res) => {
  try {
    // Get user statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({
      lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    });

    // Get run statistics
    const totalRuns = await Run.countDocuments();
    const completedRuns = await Run.countDocuments({ status: 'completed' });
    const failedRuns = await Run.countDocuments({ status: 'failed' });
    const runningRuns = await Run.countDocuments({ status: 'running' });

    // Update metrics
    metrics.updateUserMetrics(totalUsers, activeUsers);

    res.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        registrations: metrics.metrics.users.registrations
      },
      runs: {
        total: totalRuns,
        completed: completedRuns,
        failed: failedRuns,
        running: runningRuns,
        successRate: totalRuns > 0 ? ((completedRuns / totalRuns) * 100).toFixed(2) : 0
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version
      }
    });
  } catch (error) {
    logger.error('Failed to get stats:', error.message);
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

module.exports = router;
