import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { socket } from '../services/socket';

const Terminal = () => {
    const terminalRef = useRef(null);
    const xtermRef = useRef(null);
    const fitAddonRef = useRef(null);

    useEffect(() => {
        // Initialize xterm
        const term = new XTerm({
            cursorBlink: true,
            theme: {
                background: '#161e2d',
                foreground: '#f2f3f3',
                cursor: '#ff9900',
            },
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            fontSize: 14,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        if (terminalRef.current) {
            term.open(terminalRef.current);
            fitAddon.fit();
            xtermRef.current = term;
            fitAddonRef.current = fitAddon;
        }

        // Connect socket
        if (!socket.connected) {
            socket.connect();
        }

        // Terminal events
        term.onData((data) => {
            socket.emit('terminal:input', data);
        });

        // Socket events
        socket.emit('terminal:create');

        socket.on('terminal:data', (data) => {
            term.write(data);
        });

        // Handle resize
        const handleResize = () => {
            fitAddon.fit();
            if (term.cols && term.rows) {
                socket.emit('terminal:resize', { cols: term.cols, rows: term.rows });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            socket.off('terminal:data');
            socket.emit('terminal:kill');
            term.dispose();
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return (
        <div className="h-[calc(100vh-140px)] bg-[#161e2d] rounded-lg overflow-hidden border border-gray-700 shadow-lg flex flex-col">
            <div className="bg-[#232f3e] px-4 py-2 flex items-center justify-between border-b border-gray-700">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="ml-2 text-sm text-gray-400 font-mono">admin@scrapi-backend:~</span>
                </div>
                <div className="text-xs text-gray-500">Connected via WebSocket</div>
            </div>
            <div className="flex-1 p-4" ref={terminalRef}></div>
        </div>
    );
};

export default Terminal;
