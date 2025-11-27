import React, { useState, useEffect } from 'react';
import { Terminal, Play, XCircle, RefreshCw, Filter } from 'lucide-react';
import { API_BASE_URL } from '../config';

const Runs = () => {
    const [runs, setRuns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [userIdFilter, setUserIdFilter] = useState('');

    const fetchRuns = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const queryParams = new URLSearchParams({
                page,
                limit: 10,
                ...(statusFilter && { status: statusFilter }),
                ...(userIdFilter && { userId: userIdFilter })
            });

            const response = await fetch(`${API_BASE_URL}/admin/runs?${queryParams}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            setRuns(data.runs);
            setTotalPages(data.totalPages);
        } catch (error) {
            console.error('Failed to fetch runs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRuns();
    }, [page, statusFilter, userIdFilter]);

    const handleStopRun = async (runId) => {
        if (!confirm('Are you sure you want to stop this run?')) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/admin/runs/${runId}/stop`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                fetchRuns();
            } else {
                alert('Failed to stop run');
            }
        } catch (error) {
            console.error('Failed to stop run:', error);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'succeeded': return 'text-green-400';
            case 'failed': return 'text-red-400';
            case 'running': return 'text-blue-400';
            case 'queued': return 'text-yellow-400';
            case 'aborted': return 'text-gray-400';
            default: return 'text-gray-400';
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Terminal className="w-6 h-6 text-blue-500" />
                    Global Runs
                </h1>
                <button
                    onClick={fetchRuns}
                    className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                >
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>

            <div className="mb-6 flex gap-4">
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                >
                    <option value="">All Statuses</option>
                    <option value="running">Running</option>
                    <option value="queued">Queued</option>
                    <option value="succeeded">Succeeded</option>
                    <option value="failed">Failed</option>
                    <option value="aborted">Aborted</option>
                </select>
                <input
                    type="text"
                    placeholder="Filter by User ID"
                    value={userIdFilter}
                    onChange={(e) => setUserIdFilter(e.target.value)}
                    className="bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                />
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-900/50 text-gray-400 text-sm uppercase">
                        <tr>
                            <th className="px-6 py-4">Run ID</th>
                            <th className="px-6 py-4">User</th>
                            <th className="px-6 py-4">Actor</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Duration</th>
                            <th className="px-6 py-4">Started</th>
                            <th className="px-6 py-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {loading ? (
                            <tr>
                                <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                                    Loading runs...
                                </td>
                            </tr>
                        ) : runs.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                                    No runs found
                                </td>
                            </tr>
                        ) : (
                            runs.map((run) => (
                                <tr key={run.runId} className="hover:bg-gray-700/50 transition-colors">
                                    <td className="px-6 py-4 font-mono text-sm text-gray-300">
                                        {run.runId}
                                    </td>
                                    <td className="px-6 py-4 text-gray-300">
                                        {run.userId?.email || 'Unknown'}
                                    </td>
                                    <td className="px-6 py-4 text-gray-300">
                                        {run.actorName}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`flex items-center gap-2 ${getStatusColor(run.status)}`}>
                                            <span className="w-2 h-2 rounded-full bg-current"></span>
                                            {run.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-300">
                                        {run.duration || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-gray-400 text-sm">
                                        {new Date(run.startedAt).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        {['running', 'queued'].includes(run.status) && (
                                            <button
                                                onClick={() => handleStopRun(run.runId)}
                                                className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-400/10 transition-colors"
                                                title="Stop Run"
                                            >
                                                <XCircle className="w-5 h-5" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-6 flex justify-center gap-2">
                <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-700"
                >
                    Previous
                </button>
                <span className="px-4 py-2 text-gray-400">
                    Page {page} of {totalPages}
                </span>
                <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-700"
                >
                    Next
                </button>
            </div>
        </div>
    );
};

export default Runs;
