import React, { useEffect, useState } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import { Users, Activity, Server, AlertCircle } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, color }) => (
    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-400">{title}</h3>
            <div className={`p-2 rounded-lg bg-${color}-500/10`}>
                <Icon className={`w-5 h-5 text-${color}-400`} />
            </div>
        </div>
        <div className="text-2xl font-bold text-white">{value}</div>
    </div>
);

import { API_BASE_URL } from '../config';

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/admin/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        } finally {
            setLoading(false);
        }
    };

    // Mock data for charts if API doesn't return history
    const chartData = [
        { name: '00:00', users: 400, runs: 240 },
        { name: '04:00', users: 300, runs: 139 },
        { name: '08:00', users: 200, runs: 980 },
        { name: '12:00', users: 278, runs: 390 },
        { name: '16:00', users: 189, runs: 480 },
        { name: '20:00', users: 239, runs: 380 },
        { name: '23:59', users: 349, runs: 430 },
    ];

    if (loading) return <div className="p-8">Loading dashboard...</div>;

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                <div className="text-sm text-gray-400">Last updated: {new Date().toLocaleTimeString()}</div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Users"
                    value={stats?.users?.total || 0}
                    icon={Users}
                    color="blue"
                />
                <StatCard
                    title="Active Runs"
                    value={stats?.runs?.running || 0}
                    icon={Activity}
                    color="green"
                />
                <StatCard
                    title="System Uptime"
                    value={`${Math.floor((stats?.system?.uptime || 0) / 3600)}h`}
                    icon={Server}
                    color="purple"
                />
                <StatCard
                    title="Failed Runs"
                    value={stats?.runs?.failed || 0}
                    icon={AlertCircle}
                    color="red"
                />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <h3 className="text-lg font-medium text-white mb-4">Traffic Overview</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                                <XAxis dataKey="name" stroke="#9ca3af" />
                                <YAxis stroke="#9ca3af" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }}
                                />
                                <Area type="monotone" dataKey="users" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                                <Area type="monotone" dataKey="runs" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <h3 className="text-lg font-medium text-white mb-4">Run Performance</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                                <XAxis dataKey="name" stroke="#9ca3af" />
                                <YAxis stroke="#9ca3af" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }}
                                />
                                <Legend />
                                <Line type="monotone" dataKey="runs" stroke="#f59e0b" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
