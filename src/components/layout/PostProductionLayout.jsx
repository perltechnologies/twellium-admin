import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
    Factory,
    Warehouse,
    Truck,
    Menu,
    X,
    LogOut,
    User,
    ChevronLeft,
    Search,
    Bell,
    Sun,
    Moon,
    Maximize,
    ChevronDown,
    Settings,
    PanelLeftClose,
    PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../ui';

const PostProductionLayout = () => {
    const { logout, user } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
    const [showProfile, setShowProfile] = useState(false);
    const profileRef = useRef(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const handler = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const navItems = [
        { path: '/post-production/production', icon: Factory, label: 'Production' },
        { path: '/post-production/warehouse', icon: Warehouse, label: 'Warehouse' },
        { path: '/post-production/loading', icon: Truck, label: 'Loading' },
    ];

    const sidebarWidth = isMobile ? 0 : sidebarCollapsed ? 70 : 240;

    const handleFullscreen = () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
    };

    return (
        <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#030318] text-[#707070] dark:text-[#828997]">
            {/* Mobile overlay */}
            {isMobile && mobileMenuOpen && (
                <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setMobileMenuOpen(false)} />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    'fixed top-0 left-0 z-50 h-screen bg-white dark:bg-[#030318] border-r border-[#e2e8f0] dark:border-[#161641] transition-all duration-300 ease-in-out flex flex-col',
                    sidebarCollapsed && !isMobile ? 'w-[70px]' : 'w-[240px]',
                    isMobile && !mobileMenuOpen ? '-translate-x-full' : 'translate-x-0',
                )}
            >
                {/* Logo */}
                <div className="h-[56px] flex items-center justify-between px-4 border-b border-[#e2e8f0] dark:border-[#161641] flex-shrink-0">
                    {!sidebarCollapsed ? (
                        <Link to="/post-production/production" className="flex items-center gap-2.5 no-underline">
                            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">T</div>
                            <span className="text-15 font-bold text-[#1f2020] dark:text-[#d9dcff]">Post Prod</span>
                        </Link>
                    ) : (
                        <Link to="/post-production/production" className="mx-auto">
                            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">T</div>
                        </Link>
                    )}
                    {!isMobile && !sidebarCollapsed && (
                        <button onClick={() => setSidebarCollapsed(true)} className="p-1 text-[#9d9d9d] hover:text-[#1f2020] dark:hover:text-[#d9dcff] transition-colors">
                            <PanelLeftClose className="h-4 w-4" />
                        </button>
                    )}
                    {!isMobile && sidebarCollapsed && (
                        <button onClick={() => setSidebarCollapsed(false)} className="mx-auto mt-2 p-1 text-[#9d9d9d] hover:text-[#1f2020] dark:hover:text-[#d9dcff] transition-colors">
                            <PanelLeftOpen className="h-4 w-4" />
                        </button>
                    )}
                    {isMobile && (
                        <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-[#9d9d9d]">
                            <X className="h-5 w-5" />
                        </button>
                    )}
                </div>

                {/* Nav */}
                <div className="sidebar-inner flex-1 overflow-y-auto py-4 px-2">
                    {/* Back link */}
                    <button
                        onClick={() => navigate('/mode-selection')}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[15px] font-bold text-[#5a5b5b] dark:text-[#97aac1] hover:text-blue-600 dark:hover:text-blue-400 hover:bg-[#f7f8f9] dark:hover:bg-[#0c0c20] transition-colors mb-4"
                    >
                        <ChevronLeft className="h-[18px] w-[18px] flex-shrink-0" />
                        {!sidebarCollapsed && <span>Switch Mode</span>}
                    </button>

                    {!sidebarCollapsed && <div className="menu-title">Post Production</div>}
                    {sidebarCollapsed && <div className="my-2 mx-3 border-t border-[#e2e8f0] dark:border-[#161641]" />}

                    <ul className="space-y-0.5">
                        {navItems.map((item) => {
                            const isActive = location.pathname === item.path;
                            return (
                                <li key={item.path}>
                                    <Link
                                        to={item.path}
                                        className={cn(
                                            'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[15px] font-bold transition-colors',
                                            isActive
                                                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-600/10'
                                                : 'text-[#5a5b5b] dark:text-[#97aac1] hover:text-blue-600 dark:hover:text-blue-400 hover:bg-[#f7f8f9] dark:hover:bg-[#0c0c20]',
                                        )}
                                    >
                                        <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                                        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </aside>

            {/* Page Wrapper */}
            <div className="flex flex-col min-h-screen transition-all duration-300" style={{ marginLeft: sidebarWidth }}>
                {/* Header */}
                <header className="h-[56px] bg-white dark:bg-[#030318] border-b border-[#e2e8f0] dark:border-[#161641] flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        <button className="md:hidden p-2 text-[#707070] rounded-lg hover:bg-[#f7f8f9] dark:hover:bg-[#0c0c20] transition-colors" onClick={() => setMobileMenuOpen(true)}>
                            <Menu className="h-5 w-5" />
                        </button>
                        <div className="hidden md:flex items-center relative">
                            <input type="text" placeholder="Search Keyword" className="w-56 lg:w-72 pl-9 pr-3 py-2 text-sm bg-[#f7f8f9] dark:bg-[#0c0c20] border border-[#e2e8f0] dark:border-[#161641] rounded-lg text-[#1f2020] dark:text-[#d9dcff] placeholder:text-[#9d9d9d] focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all" />
                            <Search className="absolute left-3 h-4 w-4 text-[#9d9d9d]" />
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={handleFullscreen} className="hidden md:flex p-2 text-[#707070] hover:text-[#1f2020] dark:text-[#828997] dark:hover:text-[#d9dcff] rounded-lg hover:bg-[#f7f8f9] dark:hover:bg-[#0c0c20] transition-colors" title="Fullscreen">
                            <Maximize className="h-[18px] w-[18px]" />
                        </button>
                        <button onClick={toggleTheme} className="p-2 text-[#707070] hover:text-yellow-500 dark:text-[#828997] dark:hover:text-yellow-400 rounded-lg hover:bg-[#f7f8f9] dark:hover:bg-[#0c0c20] transition-colors">
                            {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
                        </button>
                        <div className="hidden md:block w-px h-6 bg-[#e2e8f0] dark:bg-[#161641] mx-2" />
                        <div className="relative" ref={profileRef}>
                            <button onClick={() => setShowProfile(v => !v)} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#f7f8f9] dark:hover:bg-[#0c0c20] transition-colors ml-1">
                                <div className="h-8 w-8 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center border border-blue-200 dark:border-blue-800">
                                    <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="hidden md:block text-left">
                                    <p className="text-sm font-medium text-[#1f2020] dark:text-[#d9dcff] leading-none">{user?.username || 'Admin'}</p>
                                    <p className="text-xs text-[#9d9d9d] leading-none mt-0.5">Post Prod</p>
                                </div>
                                <ChevronDown className="hidden md:block h-3.5 w-3.5 text-[#9d9d9d]" />
                            </button>
                            {showProfile && (
                                <div className="dropdown-animate absolute right-0 mt-2 w-56 bg-white dark:bg-[#030318] border border-[#e2e8f0] dark:border-[#161641] rounded-xl shadow-lg overflow-hidden">
                                    <div className="p-3 bg-[#f7f8f9] dark:bg-[#0c0c20] rounded-lg m-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center border border-blue-200 dark:border-blue-800">
                                                <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-[#1f2020] dark:text-[#d9dcff]">{user?.username || 'Admin'}</p>
                                                <p className="text-xs text-[#9d9d9d]">Post Production</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="border-t border-[#e2e8f0] dark:border-[#161641] py-1">
                                        <button onClick={logout} className="flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors w-full">
                                            <LogOut className="h-4 w-4" /> Sign Out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 p-4 md:p-6">
                    <div className="max-w-[1400px] mx-auto">
                        <React.Suspense fallback={
                            <div className="flex items-center justify-center h-64 text-blue-500 text-sm">Loading...</div>
                        }>
                            <Outlet />
                        </React.Suspense>
                    </div>
                </main>

                {/* Footer */}
                <footer className="py-2 px-5 flex flex-col md:flex-row items-center justify-between text-sm text-[#707070] border-t border-[#e2e8f0] dark:border-[#161641]">
                    <p className="mb-1 md:mb-0">Copyright © {new Date().getFullYear()} <span className="text-blue-600 font-medium">Twellium</span></p>
                    <div className="flex items-center gap-4">
                        <span className="hover:text-[#1f2020] dark:hover:text-[#d9dcff] cursor-pointer transition-colors">About</span>
                        <span className="hover:text-[#1f2020] dark:hover:text-[#d9dcff] cursor-pointer transition-colors">Terms</span>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default PostProductionLayout;
