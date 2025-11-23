import React, { useEffect, useState } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import { Users, Activity, Server, AlertCircle } from 'lucide-react';
import { getApiUrl } from '../services/api';

const StatCard = ({ title, value, icon: Icon, color }) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500">{title}</h3>
            <div className={`p-2 rounded-full bg-${color}-100`}>
                <Icon className={`w-5 h-5 text-${color}-600`} />
            </div>
        </div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
);

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
            const response = await fetch(getApiUrl('/api/admin/stats'), {
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
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-[#161e2d]">Dashboard</h1>
                <div className="text-sm text-gray-500">Last updated: {new Date().toLocaleTimeString()}</div>
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
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Traffic Overview</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Area type="monotone" dataKey="users" stackId="1" stroke="#0073bb" fill="#0073bb" fillOpacity={0.1} />
                                <Area type="monotone" dataKey="runs" stackId="1" stroke="#ff9900" fill="#ff9900" fillOpacity={0.1} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Run Performance</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="runs" stroke="#ff9900" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
