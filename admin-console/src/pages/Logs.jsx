import React, { useEffect, useState, useRef } from 'react';
import { socket } from '../services/socket';
import { Play, Square, Download, Trash2, Filter } from 'lucide-react';

const Logs = () => {
    const [logs, setLogs] = useState([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [logType, setLogType] = useState('combined'); // 'combined' or 'error'
    const logsEndRef = useRef(null);

    useEffect(() => {
        if (!socket.connected) {
            socket.connect();
        }

        socket.on('logs:history', (history) => {
            setLogs(history.split('\n'));
        });

        socket.on('logs:data', (data) => {
            setLogs((prev) => [...prev, ...data.split('\n')]);
        });

        socket.on('logs:system', (msg) => {
            setLogs((prev) => [...prev, `[SYSTEM] ${msg}`]);
        });

        return () => {
            socket.off('logs:history');
            socket.off('logs:data');
            socket.off('logs:system');
            if (isStreaming) {
                socket.emit('logs:unsubscribe');
            }
        };
    }, []);

    useEffect(() => {
        // Auto-scroll to bottom
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const toggleStream = () => {
        if (isStreaming) {
            socket.emit('logs:unsubscribe');
        } else {
            socket.emit('logs:subscribe', logType);
        }
        setIsStreaming(!isStreaming);
    };

    const clearLogs = () => {
        setLogs([]);
    };

    const downloadLogs = () => {
        const element = document.createElement("a");
        const file = new Blob([logs.join('\n')], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = `scrapi-logs-${new Date().toISOString()}.txt`;
        document.body.appendChild(element);
        element.click();
    };

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Toolbar */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 rounded-t-lg">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <select
                            value={logType}
                            onChange={(e) => setLogType(e.target.value)}
                            className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2"
                            disabled={isStreaming}
                        >
                            <option value="combined">Combined Logs</option>
                            <option value="error">Error Logs</option>
                        </select>
                    </div>
                    <button
                        onClick={toggleStream}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isStreaming
                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                    >
                        {isStreaming ? <><Square size={16} /> Stop Stream</> : <><Play size={16} /> Start Stream</>}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={clearLogs}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                        title="Clear Console"
                    >
                        <Trash2 size={18} />
                    </button>
                    <button
                        onClick={downloadLogs}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                        title="Download Logs"
                    >
                        <Download size={18} />
                    </button>
                </div>
            </div>

            {/* Log Viewer */}
            <div className="flex-1 overflow-auto p-4 bg-[#1e1e1e] font-mono text-sm">
                {logs.map((log, index) => (
                    <div key={index} className="whitespace-pre-wrap break-all hover:bg-[#2d2d2d] px-2 py-0.5 text-gray-300">
                        {log}
                    </div>
                ))}
                <div ref={logsEndRef} />
            </div>
        </div>
    );
};

export default Logs;
