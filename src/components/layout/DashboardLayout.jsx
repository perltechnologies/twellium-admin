import React, { useState } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    LayoutDashboard,
    Box,
    Factory,
    Truck,
    ShieldCheck,
    Smartphone,
    Settings,
    LogOut,
    Menu,
    X,
    Search,
    Bell,
    ChevronDown,
    ClipboardCheck,
    Package,
    User
} from 'lucide-react';
import { cn, Button } from '../ui';
import { motion, AnimatePresence } from 'framer-motion';

const Sidebar = ({ isOpen, isMobile, onClose }) => {
    const location = useLocation();
    const { logout } = useAuth();
    const [openSubmenus, setOpenSubmenus] = useState({
        production: true
    });

    const toggleSubmenu = (key) => {
        setOpenSubmenus(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const navigation = [
        { name: 'Overview', icon: LayoutDashboard, path: '/dashboard' },
        {
            name: 'Production',
            icon: Factory,
            key: 'production',
            submenu: [
                { name: 'Reports', path: '/dashboard/production' },
                { name: 'Materials', path: '/dashboard/production/materials' },
                { name: 'Meter Readings', path: '/dashboard/production/meters' },
                { name: 'Pets', path: '/dashboard/production/pets' },
                { name: 'Batches', path: '/dashboard/production/batches' },
                { name: 'Shifts', path: '/dashboard/production/shifts' },
            ]
        },
        { name: 'Quality Control', icon: ClipboardCheck, path: '/dashboard/quality' },
        { name: 'Inventory', icon: Package, path: '/dashboard/inventory' },
        { name: 'Logistics', icon: Truck, path: '/dashboard/logistics' },
        { name: 'Settings', icon: Settings, path: '/dashboard/settings' },
    ];

    const NavItem = ({ item }) => {
        const isActive = location.pathname === item.path || (item.submenu && location.pathname.startsWith('/dashboard/' + item.key));
        const hasSubmenu = !!item.submenu;
        const isOpen = openSubmenus[item.key];

        return (
            <div className="mb-1">
                <button
                    onClick={() => hasSubmenu ? toggleSubmenu(item.key) : null}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors group ${isActive && !hasSubmenu
                        ? 'bg-blue-600/10 text-blue-400'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                        }`}
                >
                    {hasSubmenu ? (
                        <div className="flex items-center gap-3">
                            <item.icon className={`h-5 w-5 ${isActive ? 'text-blue-400' : 'group-hover:text-slate-100'}`} />
                            <span className="font-medium text-sm">{item.name}</span>
                        </div>
                    ) : (
                        <Link to={item.path} className="flex items-center gap-3 w-full">
                            <item.icon className={`h-5 w-5 ${isActive ? 'text-blue-400' : 'group-hover:text-slate-100'}`} />
                            <span className="font-medium text-sm">{item.name}</span>
                        </Link>
                    )}

                    {hasSubmenu && (
                        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    )}
                </button>

                {hasSubmenu && isOpen && (
                    <div className="ml-9 mt-1 space-y-1 border-l border-slate-800 pl-2">
                        {item.submenu.map((subItem) => (
                            <Link
                                key={subItem.path}
                                to={subItem.path}
                                className={`block px-3 py-2 rounded-lg text-sm transition-colors ${location.pathname === subItem.path
                                    ? 'text-blue-400 font-medium bg-blue-600/5'
                                    : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                {subItem.name}
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <aside className={`
            fixed top-0 left-0 z-40 h-screen bg-slate-950 border-r border-slate-800 transition-transform duration-300 ease-in-out w-64
            ${isMobile && !isOpen ? '-translate-x-full' : 'translate-x-0'}
            ${!isMobile ? 'translate-x-0' : ''}
        `}>
            <div className="h-16 flex items-center px-6 border-b border-slate-800">
                <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center mr-3 font-bold text-white">T</div>
                <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                    Twellium
                </span>
                {isMobile && (
                    <button onClick={onClose} className="ml-auto text-slate-400">
                        <X className="h-5 w-5" />
                    </button>
                )}
            </div>

            <div className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-8rem)]">
                {navigation.map((item) => (
                    <NavItem key={item.name} item={item} />
                ))}
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800 bg-slate-950">
                <div className="flex items-center gap-3 mb-4 px-2">
                    <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center">
                        <User className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">Admin User</p>
                        <p className="text-xs text-slate-500 truncate">admin@twellium.com</p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={logout}
                >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                </Button>
            </div>
        </aside>
    );
};

const DashboardLayout = () => {
    const { user } = useAuth();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 flex">
            {/* Sidebar */}
            <Sidebar
                isOpen={mobileMenuOpen}
                isMobile={window.innerWidth < 768}
                onClose={() => setMobileMenuOpen(false)}
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 md:pl-64 transition-all duration-300">
                {/* Header */}
                <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between px-6 z-10 sticky top-0">
                    <div className="flex items-center gap-4">
                        <button
                            className="md:hidden p-2 text-slate-400"
                            onClick={() => setMobileMenuOpen(true)}
                        >
                            <Menu className="h-6 w-6" />
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="relative p-2 text-slate-400 hover:text-emerald-400 transition-colors">
                            <Bell className="h-5 w-5" />
                        </button>
                    </div>
                </header>

                {/* Scrollable Content */}
                <main className="flex-1 overflow-y-auto p-6 md:p-8 scroll-smooth">
                    <div className="max-w-7xl mx-auto space-y-8">
                        <Outlet />
                    </div>
                </main>
            </div>

            {/* Mobile Overlay */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 md:hidden"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}
        </div>
    );
};

export default DashboardLayout;
