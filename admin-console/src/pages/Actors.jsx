import React, { useState, useEffect } from 'react';
import { Box, CheckCircle, XCircle, Eye, EyeOff, Search, ExternalLink } from 'lucide-react';
import { API_BASE_URL } from '../config';

const Actors = () => {
    const [actors, setActors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');

    const fetchActors = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const queryParams = new URLSearchParams({
                page,
                limit: 12,
                search
            });

            const response = await fetch(`${API_BASE_URL}/admin/actors?${queryParams}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            setActors(data.actors);
            setTotalPages(data.totalPages);
        } catch (error) {
            console.error('Failed to fetch actors:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchActors();
        }, 500);
        return () => clearTimeout(timer);
    }, [page, search]);

    const handleToggleVerify = async (actorId, currentStatus) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/admin/actors/${actorId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ isVerified: !currentStatus })
            });
            if (response.ok) fetchActors();
        } catch (error) {
            console.error('Error updating actor:', error);
        }
    };

    const handleTogglePublic = async (actorId, currentStatus) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/admin/actors/${actorId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ isPublic: !currentStatus })
            });
            if (response.ok) fetchActors();
        } catch (error) {
            console.error('Error updating actor:', error);
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Box className="w-6 h-6 text-purple-500" />
                    Global Actors
                </h1>
                <div className="relative">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search actors..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="bg-gray-800 text-white border border-gray-700 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-purple-500 w-64"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full text-center py-12 text-gray-500">
                        Loading actors...
                    </div>
                ) : actors.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-gray-500">
                        No actors found
                    </div>
                ) : (
                    actors.map((actor) => (
                        <div key={actor.actorId} className="bg-gray-800 rounded-xl border border-gray-700 p-6 hover:border-purple-500/50 transition-colors">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-2xl">
                                        {actor.icon || '🤖'}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white">{actor.name}</h3>
                                        <p className="text-sm text-gray-400">by {actor.userId?.username || 'System'}</p>
                                    </div>
                                </div>
                                {actor.isVerified && (
                                    <CheckCircle className="w-5 h-5 text-blue-400" title="Verified" />
                                )}
                            </div>

                            <p className="text-gray-400 text-sm mb-4 line-clamp-2 h-10">
                                {actor.description}
                            </p>

                            <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleToggleVerify(actor.actorId, actor.isVerified)}
                                        className={`p-2 rounded-lg transition-colors ${actor.isVerified
                                            ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                            }`}
                                        title={actor.isVerified ? "Unverify" : "Verify"}
                                    >
                                        <CheckCircle className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleTogglePublic(actor.actorId, actor.isPublic)}
                                        className={`p-2 rounded-lg transition-colors ${actor.isPublic
                                            ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                            }`}
                                        title={actor.isPublic ? "Make Private" : "Make Public"}
                                    >
                                        {actor.isPublic ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                                    </button>
                                </div>
                                <div className="text-xs text-gray-500">
                                    {actor.stats.runs} runs
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="mt-8 flex justify-center gap-2">
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

export default Actors;
