const pty = require('node-pty');
const os = require('os');
const logger = require('./logger');

class TerminalService {
    constructor(io) {
        this.io = io;
        this.sessions = new Map();
        this.shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    }

    createSession(socketId) {
        try {
            const ptyProcess = pty.spawn(this.shell, [], {
                name: 'xterm-color',
                cols: 80,
                rows: 30,
                cwd: process.env.HOME,
                env: process.env
            });

            this.sessions.set(socketId, ptyProcess);

            // Handle data from pty
            ptyProcess.onData((data) => {
                this.io.to(socketId).emit('terminal:data', data);
            });

            ptyProcess.onExit(() => {
                this.sessions.delete(socketId);
                this.io.to(socketId).emit('terminal:exit');
            });

            logger.info(`Terminal session created for socket ${socketId}`);
            return ptyProcess;
        } catch (error) {
            logger.error('Failed to create terminal session:', error);
            throw error;
        }
    }

    write(socketId, data) {
        const session = this.sessions.get(socketId);
        if (session) {
            session.write(data);
        }
    }

    resize(socketId, cols, rows) {
        const session = this.sessions.get(socketId);
        if (session) {
            session.resize(cols, rows);
        }
    }

    killSession(socketId) {
        const session = this.sessions.get(socketId);
        if (session) {
            session.kill();
            this.sessions.delete(socketId);
            logger.info(`Terminal session killed for socket ${socketId}`);
        }
    }
}

module.exports = TerminalService;
