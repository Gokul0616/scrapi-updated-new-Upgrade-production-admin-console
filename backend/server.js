// Load environment variables first, before any other modules
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const cache = require('./utils/cache');
const metrics = require('./utils/metrics');
const backupManager = require('./utils/backup');
const errorMonitoring = require('./utils/errorMonitoring');
const { getConfig } = require('./config/environments');
const sslConfig = require('./config/ssl');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const logAggregation = require('./config/logAggregation'); // Phase 4
const performance = require('./config/performance'); // Phase 4

const app = express();
const PORT = process.env.PORT || 8001;

// Get environment configuration (Phase 3)
const envConfig = getConfig();

// Security: Add Helmet middleware
app.use(helmet());

// Trust proxy - required when running behind Kubernetes ingress or reverse proxy
// This allows Express to properly read X-Forwarded-* headers
app.set('trust proxy', true);

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5, // Max 5 attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true, // Don't count successful requests
  standardHeaders: true,
  legacyHeaders: false,
});

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO with CORS
// Use /api/socket.io path to match frontend and ingress routing
// Phase 3: Use environment-based CORS origins
const allowedOrigins = envConfig.corsOrigins.length > 0 
  ? envConfig.corsOrigins 
  : ['http://localhost:3000', 'http://localhost:3001'];

logger.info(`CORS Allowed Origins: ${JSON.stringify(allowedOrigins)}`);

const io = new Server(server, {
  path: '/api/socket.io',  // Match the path used by frontend
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true  // Allow Engine.IO protocol 3 for compatibility
});

// Make io accessible to routes
app.set('io', io);

// Initialize WebSocket utility
const { initializeSocket } = require('./utils/websocket');
initializeSocket(io);

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));

// Phase 4: Add compression middleware
app.use(performance.getCompressionMiddleware());

// Phase 4: Add response time middleware
app.use(performance.getResponseTimeMiddleware());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiting to all API routes
app.use('/api/', limiter);

// Apply strict rate limiting to authentication routes
app.use('/api/auth/', authLimiter);

// Request logging and metrics middleware
app.use((req, res, next) => {
  logger.http(`${req.method} ${req.path} - IP: ${req.ip}`);
  
  // Record metrics
  const startTime = Date.now();
  res.on('finish', () => {
    const success = res.statusCode < 400;
    metrics.recordRequest(req.path, success);
  });
  
  next();
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URL, {
  dbName: process.env.DB_NAME || 'scrapi',
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(async () => {
  logger.info('MongoDB connected successfully');
  
  // Initialize log aggregation (Phase 4)
  try {
    logAggregation.init();
    logger.info('Log aggregation service initialized');
  } catch (error) {
    logger.warn('Log aggregation initialization failed:', error.message);
  }
  
  // Initialize error monitoring (Phase 3)
  try {
    await errorMonitoring.init();
    logger.info('Error monitoring initialized');
  } catch (error) {
    logger.warn('Error monitoring initialization failed:', error.message);
  }
  
  // Initialize SSL config (Phase 3)
  const sslOptions = sslConfig.init();
  if (sslOptions) {
    logger.info('SSL/TLS configuration loaded');
  }
  
  // Initialize backup manager
  try {
    await backupManager.init();
    logger.info('Backup manager initialized');
  } catch (error) {
    logger.warn('Backup manager initialization failed:', error.message);
  }
  
  // Initialize Redis cache
  try {
    await cache.connect();
    logger.info('Redis cache connected');
  } catch (error) {
    logger.warn('Redis cache connection failed:', error.message);
  }
  
  // Auto-sync actors from registry
  const syncActors = require('./actors/syncActors');
  await syncActors();
})
.catch(err => {
  logger.error('MongoDB connection error:', err.message);
  process.exit(1);
});

// WebSocket Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication error'));
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

// WebSocket Connection Handler
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id} (User: ${socket.userId})`);
  
  // Join user-specific room
  socket.join(`user:${socket.userId}`);
  
  // Handle disconnection
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
  
  // Handle subscription to specific run
  socket.on('subscribe:run', (runId) => {
    socket.join(`run:${runId}`);
    logger.debug(`Client ${socket.id} subscribed to run:${runId}`);
  });
  
  // Handle unsubscription from run
  socket.on('unsubscribe:run', (runId) => {
    socket.leave(`run:${runId}`);
    logger.debug(`Client ${socket.id} unsubscribed from run:${runId}`);
  });
});

// Swagger Documentation (Phase 3: Environment-based)
if (envConfig.enableSwagger) {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Scrapi API Documentation'
  }));
  logger.info('Swagger documentation enabled at /api/docs');
} else {
  logger.info('Swagger documentation disabled (production mode)');
}

// Import routes
const actorRoutes = require('./routes/actors');
const runRoutes = require('./routes/runs');
const scraperRoutes = require('./routes/scrapers');
const authRoutes = require('./routes/auth');
const scrapedDataRoutes = require('./routes/scrapedData');
const notificationRoutes = require('./routes/notifications');
const issuesRoutes = require('./routes/issues');
const adminRoutes = require('./routes/admin');
const infrastructureRoutes = require('./routes/infrastructure'); // Phase 3
const phase4Routes = require('./routes/phase4'); // Phase 4
const chatbotRoutes = require('./routes/chatbot'); // AI Chatbot

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/actors', actorRoutes);
app.use('/api/runs', runRoutes);
app.use('/api/scrapers', scraperRoutes);
app.use('/api/scraped-data', scrapedDataRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/issues', issuesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/infrastructure', infrastructureRoutes); // Phase 3
app.use('/api/phase4', phase4Routes); // Phase 4
app.use('/api/chatbot', chatbotRoutes); // AI Chatbot

// Basic health check
app.get('/api/', (req, res) => {
  res.json({ message: 'Scrapi Backend API Running' });
});

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 *       503:
 *         description: Service is unhealthy
 */
app.get('/api/health', async (req, res) => {
  try {
    // Check MongoDB
    const mongoState = mongoose.connection.readyState;
    const mongoHealth = mongoState === 1 ? 'connected' : 'disconnected';
    
    // Check if we can ping MongoDB
    await mongoose.connection.db.admin().ping();
    
    // Check Redis cache
    const redisHealth = cache.isConnected ? 'connected' : 'disconnected';
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        mongodb: mongoHealth,
        redis: redisHealth,
        websocket: 'up',
        api: 'up'
      },
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: '1.0.0'
    });
  } catch (error) {
    logger.error('Health check failed:', error.message);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Error monitoring middleware (Phase 3)
app.use(errorMonitoring.expressMiddleware());

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Server error:', {
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method
  });
  
  // Don't expose error details in production
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

// Graceful shutdown handling
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, closing gracefully...');
  
  // Close HTTP server
  server.close(() => {
    logger.info('HTTP server closed');
  });
  
  // Close MongoDB connection
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (err) {
    logger.error('Error closing MongoDB:', err.message);
  }
  
  // Close Redis cache
  try {
    await cache.disconnect();
    logger.info('Redis cache disconnected');
  } catch (err) {
    logger.error('Error closing Redis:', err.message);
  }
  
  // Close Socket.IO
  io.close(() => {
    logger.info('Socket.IO server closed');
  });
  
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Use server.listen instead of app.listen for Socket.IO
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`Scrapi backend running on http://0.0.0.0:${PORT}`);
  logger.info(`WebSocket server ready for connections`);
  logger.info(`Environment: ${envConfig.name}`);
  logger.info(`Log level: ${envConfig.logLevel}`);
  logger.info(`SSL/TLS: ${sslConfig.isEnabled() ? 'Enabled' : 'Disabled'}`);
  logger.info(`Caching: ${envConfig.cacheEnabled ? 'Enabled' : 'Disabled'}`);
  logger.info(`Error monitoring: ${errorMonitoring.sentryEnabled ? 'Sentry' : 'Local'}`);
});

// Export io for use in other files
module.exports = { io };
