const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define which transports the logger must use
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }),
];

// Add file transports based on environment
if (process.env.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: '/var/log/supervisor/backend-error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.uncolorize(),
        winston.format.json()
      ),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: '/var/log/supervisor/backend-combined.log',
      format: winston.format.combine(
        winston.format.uncolorize(),
        winston.format.json()
      ),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
} else {
  // Local development logging
  const logDir = path.join(process.cwd(), 'logs');
  // Ensure log directory exists (sync is fine here as it's startup)
  const fs = require('fs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'backend-error.log'),
      level: 'error',
      format: winston.format.combine(
        winston.format.uncolorize(),
        winston.format.json()
      ),
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'backend-combined.log'),
      format: winston.format.combine(
        winston.format.uncolorize(),
        winston.format.json()
      ),
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Create a stream object for Morgan HTTP logging
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
