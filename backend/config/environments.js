/**
 * Environment Configuration
 * Phase 3: Infrastructure - Multi-environment Support
 */

const environments = {
  development: {
    name: 'development',
    logLevel: 'debug',
    corsOrigins: ['http://localhost:3000', 'http://localhost:3001'],
    enableSwagger: true,
    enableDebugRoutes: true,
    rateLimitMultiplier: 10, // More lenient in dev
    cacheEnabled: false,
  },

  staging: {
    name: 'staging',
    logLevel: 'info',
    corsOrigins: [
      process.env.STAGING_FRONTEND_URL,
      process.env.FRONTEND_URL,
      'https://staging.your-domain.com',
    ].filter(Boolean),
    enableSwagger: true,
    enableDebugRoutes: true,
    rateLimitMultiplier: 2, // Slightly lenient in staging
    cacheEnabled: true,
  },

  production: {
    name: 'production',
    logLevel: process.env.LOG_LEVEL || 'info',
    corsOrigins: (process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [
      'http://localhost:3000',
      'http://localhost:3001'
    ]).flat().filter(Boolean).filter((value, index, self) => self.indexOf(value) === index), // Remove duplicates
    enableSwagger: false, // Disable in production for security
    enableDebugRoutes: false,
    rateLimitMultiplier: 1, // Strict in production
    cacheEnabled: true,
  },
};

/**
 * Get current environment configuration
 */
function getConfig() {
  const env = process.env.NODE_ENV || 'development';

  if (!environments[env]) {
    console.warn(`Unknown environment: ${env}, defaulting to development`);
    return environments.development;
  }

  return environments[env];
}

/**
 * Check if running in specific environment
 */
function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function isStaging() {
  return process.env.NODE_ENV === 'staging';
}

function isDevelopment() {
  return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
}

module.exports = {
  environments,
  getConfig,
  isProduction,
  isStaging,
  isDevelopment,
};
