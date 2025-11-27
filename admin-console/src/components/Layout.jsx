import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Terminal,
    FileText,
    Settings,
    LogOut,
    Menu,
    X,
    Users,
    Box,
    Play
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const Layout = ({ children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const location = useLocation();
    const navigate = useNavigate();

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: Users, label: 'Users', path: '/users' },
        { icon: Play, label: 'Runs', path: '/runs' },
        { icon: Box, label: 'Actors', path: '/actors' },
        { icon: Terminal, label: 'Terminal', path: '/terminal' },
        { icon: FileText, label: 'Logs', path: '/logs' },
        { icon: Settings, label: 'Settings', path: '/settings' },
    ];

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-[#f2f3f3] flex flex-col">
            {/* Top Navigation Bar */}
            <header className="bg-[#232f3e] text-white h-14 flex items-center px-4 justify-between shrink-0 z-50">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-1 hover:bg-[#3c4a5d] rounded"
                    >
                        <Menu size={24} />
                    </button>
                    <div className="font-bold text-lg flex items-center gap-2">
                        <span className="text-[#ff9900]">Scrapi</span>
                        <span>Admin Console</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-sm">Admin User</div>
                    <button
                        onClick={handleLogout}
                        className="text-sm hover:text-[#ff9900]"
                    >
                        Sign Out
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <aside
                    className={cn(
                        "bg-white border-r border-gray-200 w-64 flex-shrink-0 transition-all duration-300 ease-in-out flex flex-col",
                        !isSidebarOpen && "-ml-64"
                    )}
                >
                    <nav className="flex-1 py-4">
                        <div className="px-4 mb-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Services
                        </div>
                        <ul>
                            {navItems.map((item) => {
                                const isActive = location.pathname === item.path;
                                return (
                                    <li key={item.path}>
                                        <Link
                                            to={item.path}
                                            className={cn(
                                                "flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors",
                                                isActive
                                                    ? "bg-[#f2f3f3] text-[#0073bb] border-l-4 border-[#0073bb]"
                                                    : "text-[#161e2d] hover:bg-[#f2f3f3] hover:text-[#161e2d] border-l-4 border-transparent"
                                            )}
                                        >
                                            <item.icon size={18} />
                                            {item.label}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>

                    <div className="p-4 border-t border-gray-200">
                        <div className="text-xs text-gray-500">
                            Region: us-east-1
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 overflow-auto p-6">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default Layout;
