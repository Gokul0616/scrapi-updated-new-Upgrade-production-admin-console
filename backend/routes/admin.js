const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const logger = require('../utils/logger');
const backupManager = require('../utils/backup');
const cache = require('../utils/cache');
const metrics = require('../utils/metrics');
const User = require('../models/User');
const Run = require('../models/Run');

// ... (swagger docs omitted for brevity)

// Get all users
router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ users });
  } catch (error) {
    logger.error('Failed to fetch users:', error.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/metrics', adminAuth, async (req, res) => {
  try {
    const metricsData = metrics.getMetrics();
    res.json(metricsData);
  } catch (error) {
    logger.error('Failed to get metrics:', error.message);
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
});

// ... (other routes updated to use adminAuth)

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

router.post('/backup', adminAuth, async (req, res) => {
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

router.get('/backup/list', adminAuth, async (req, res) => {
  try {
    const backups = await backupManager.listBackups();
    res.json({ backups });
  } catch (error) {
    logger.error('Failed to list backups:', error.message);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

router.post('/backup/restore', adminAuth, async (req, res) => {
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

router.post('/cache/clear', adminAuth, async (req, res) => {
  try {
    await cache.flushAll();
    logger.info('Cache cleared by admin');
    res.json({ success: true, message: 'Cache cleared successfully' });
  } catch (error) {
    logger.error('Failed to clear cache:', error.message);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

router.get('/cache/stats', adminAuth, async (req, res) => {
  try {
    const stats = await cache.getStats();
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get cache stats:', error.message);
    res.status(500).json({ error: 'Failed to retrieve cache statistics' });
  }
});

router.get('/stats', adminAuth, async (req, res) => {
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
