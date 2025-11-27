import React, { useEffect, useState } from 'react';
import { Search, MoreHorizontal, CheckCircle, XCircle, Edit, Ban, Save, X } from 'lucide-react';
import { API_BASE_URL } from '../config';

const Users = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUser, setEditingUser] = useState(null);
    const [editForm, setEditForm] = useState({ plan: '', ramLimitMB: 0, creditsLimit: 0 });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/admin/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setUsers(data.users || []);
            }
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleBanUser = async (userId, shouldBan) => {
        if (!window.confirm(`Are you sure you want to ${shouldBan ? 'ban' : 'unban'} this user?`)) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/ban`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ ban: shouldBan })
            });
            if (response.ok) {
                fetchUsers();
            }
        } catch (error) {
            console.error('Failed to update user status:', error);
        }
    };

    const handleEditClick = (user) => {
        setEditingUser(user);
        setEditForm({
            plan: user.plan,
            ramLimitMB: user.usage?.ramLimitMB || 0,
            creditsLimit: user.usage?.creditsLimit || 0
        });
    };

    const handleSaveEdit = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/admin/users/${editingUser._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(editForm)
            });
            if (response.ok) {
                setEditingUser(null);
                fetchUsers();
            }
        } catch (error) {
            console.error('Failed to update user:', error);
        }
    };

    const filteredUsers = users.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-white">Users</h1>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-gray-800 text-white pl-10 pr-4 py-2 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                </div>
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-900/50 text-gray-400 uppercase">
                        <tr>
                            <th className="px-6 py-4">User</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Plan</th>
                            <th className="px-6 py-4">Limits</th>
                            <th className="px-6 py-4">Joined</th>
                            <th className="px-6 py-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {loading ? (
                            <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-500">Loading users...</td></tr>
                        ) : filteredUsers.length === 0 ? (
                            <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-500">No users found</td></tr>
                        ) : (
                            filteredUsers.map((user) => (
                                <tr key={user._id} className="hover:bg-gray-700/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 font-bold">
                                                {user.username[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-medium text-white">{user.username}</div>
                                                <div className="text-gray-500">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.isActive !== false ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
                                                <CheckCircle size={12} /> Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400">
                                                <XCircle size={12} /> Banned
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-gray-300 capitalize">{user.plan || 'Free'}</td>
                                    <td className="px-6 py-4 text-gray-400">
                                        <div>RAM: {user.usage?.ramLimitMB}MB</div>
                                        <div>Credits: ${user.usage?.creditsLimit}</div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleEditClick(user)}
                                                className="p-1 text-blue-400 hover:bg-blue-400/10 rounded"
                                                title="Edit User"
                                            >
                                                <Edit size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleBanUser(user._id, user.isActive !== false)}
                                                className={`p-1 rounded ${user.isActive !== false ? 'text-red-400 hover:bg-red-400/10' : 'text-green-400 hover:bg-green-400/10'}`}
                                                title={user.isActive !== false ? "Ban User" : "Unban User"}
                                            >
                                                <Ban size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Edit Modal */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 w-96 shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-white">Edit User</h2>
                            <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Plan</label>
                                <select
                                    value={editForm.plan}
                                    onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })}
                                    className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                                >
                                    <option value="free">Free</option>
                                    <option value="starter">Starter</option>
                                    <option value="scale">Scale</option>
                                    <option value="business">Business</option>
                                    <option value="enterprise">Enterprise</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">RAM Limit (MB)</label>
                                <input
                                    type="number"
                                    value={editForm.ramLimitMB}
                                    onChange={(e) => setEditForm({ ...editForm, ramLimitMB: parseInt(e.target.value) })}
                                    className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Credits Limit ($)</label>
                                <input
                                    type="number"
                                    value={editForm.creditsLimit}
                                    onChange={(e) => setEditForm({ ...editForm, creditsLimit: parseInt(e.target.value) })}
                                    className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setEditingUser(null)}
                                className="px-4 py-2 text-gray-400 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 flex items-center gap-2"
                            >
                                <Save size={18} /> Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Users;
