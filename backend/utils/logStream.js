const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class LogStreamService {
    constructor(io) {
        this.io = io;
        this.watchers = new Map();
    }

    startStream(socketId, logType = 'combined') {
        // Determine log file path based on environment
        // In dev, we use local logs/ directory. In prod, we might use /var/log/supervisor/
        // For this implementation, we'll try to find the file from logger configuration

        let logFile;
        if (process.env.NODE_ENV === 'production') {
            logFile = logType === 'error'
                ? '/var/log/supervisor/backend-error.log'
                : '/var/log/supervisor/backend-combined.log';
        } else {
            // Local development logs
            const logDir = path.join(process.cwd(), 'logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            logFile = path.join(logDir, `backend-${logType}.log`);

            // Ensure file exists
            if (!fs.existsSync(logFile)) {
                fs.writeFileSync(logFile, '');
            }
        }

        try {
            // Send last 100 lines initially
            this.readLastLines(logFile, 100).then(lines => {
                this.io.to(socketId).emit('logs:history', lines);
            });

            // Watch for changes
            // fs.watch is tricky for files that are constantly written to (like logs)
            // A better approach for logs is often polling or using a library like 'tail'
            // For simplicity in this MVP, we'll use a simple polling mechanism or fs.watchFile

            let currentSize = fs.statSync(logFile).size;

            const watcher = fs.watchFile(logFile, { interval: 1000 }, (curr, prev) => {
                if (curr.mtime > prev.mtime) {
                    const newSize = curr.size;
                    const sizeDiff = newSize - currentSize;

                    if (sizeDiff > 0) {
                        const buffer = Buffer.alloc(sizeDiff);
                        const fd = fs.openSync(logFile, 'r');
                        fs.readSync(fd, buffer, 0, sizeDiff, currentSize);
                        fs.closeSync(fd);

                        const newContent = buffer.toString('utf8');
                        this.io.to(socketId).emit('logs:data', newContent);
                        currentSize = newSize;
                    } else if (sizeDiff < 0) {
                        // File was rotated or truncated
                        currentSize = newSize;
                        this.io.to(socketId).emit('logs:system', '--- Log file rotated ---');
                    }
                }
            });

            this.watchers.set(socketId, { watcher, logFile });
            logger.info(`Log stream started for socket ${socketId} on ${logFile}`);

        } catch (error) {
            logger.error('Failed to start log stream:', error);
            this.io.to(socketId).emit('logs:error', 'Failed to read log file');
        }
    }

    stopStream(socketId) {
        const session = this.watchers.get(socketId);
        if (session) {
            fs.unwatchFile(session.logFile);
            this.watchers.delete(socketId);
            logger.info(`Log stream stopped for socket ${socketId}`);
        }
    }

    async readLastLines(filePath, maxLines) {
        try {
            const data = await fs.promises.readFile(filePath, 'utf8');
            const lines = data.split('\n');
            return lines.slice(-maxLines).join('\n');
        } catch (error) {
            return `Error reading log history: ${error.message}`;
        }
    }
}

module.exports = LogStreamService;
