import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    Activity,
    Factory,
    Warehouse,
    Truck,
    Menu,
    X,
    LogOut,
    User,
    ChevronLeft,
    ClipboardList,
    Printer,
    Smartphone
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const PostProductionLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const { logout, user } = useAuth();
    const navigate = useNavigate();

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { path: '/post-production', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/post-production/overview', icon: Activity, label: 'Overview' },
        { path: '/post-production/production', icon: Factory, label: 'Production Mode' },
        { path: '/post-production/warehouse', icon: Warehouse, label: 'Warehouse Flow' },
        { path: '/post-production/logistics/dispatch', icon: Truck, label: 'Loading & Dispatch' },
        { path: '/post-production/activity-logs', icon: ClipboardList, label: 'Activity Logs' },
        { path: '/post-production/reprint', icon: Printer, label: 'Reprint Labels' },
        { path: '/post-production/logistics/vehicles', icon: Truck, label: 'Vehicles' },
        { path: '/post-production/logistics/drivers', icon: User, label: 'Drivers' },
    ];

    return (
        <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
            {/* Sidebar */}
            <motion.aside
                initial={false}
                animate={{
                    width: isSidebarOpen ? 280 : 80,
                    transition: { duration: 0.3, ease: "easeInOut" }
                }}
                className="relative h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-20 shadow-xl"
            >
                {/* Header */}
                <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800">
                    <AnimatePresence mode='wait'>
                        {isSidebarOpen ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-500"
                            >
                                Post Production
                            </motion.div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="mx-auto"
                            >
                                <LayoutDashboard className="w-8 h-8 text-blue-600" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Nav Items */}
                <div className="flex-1 py-6 px-3 space-y-2 overflow-y-auto">
                    {/* Back to Mode Selection */}
                    <button
                        onClick={() => navigate('/mode-selection')}
                        className="w-full flex items-center p-3 rounded-lg mb-6 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6 min-w-[24px]" />
                        {isSidebarOpen && (
                            <motion.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="ml-3 font-medium whitespace-nowrap"
                            >
                                Switch Mode
                            </motion.span>
                        )}
                    </button>

                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/post-production'}
                            className={({ isActive }) => `
                                flex items-center p-3 rounded-xl transition-all duration-200 group
                                ${isActive
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                                }
                            `}
                        >
                            <item.icon className={`w-6 h-6 min-w-[24px] transition-colors ${isSidebarOpen ? '' : 'mx-auto'
                                }`} />

                            {isSidebarOpen && (
                                <motion.span
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="ml-3 whitespace-nowrap"
                                >
                                    {item.label}
                                </motion.span>
                            )}
                        </NavLink>
                    ))}
                </div>

                {/* Footer / User Profile */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                    <div className={`flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
                        {isSidebarOpen && (
                            <div className="flex items-center space-x-3 overflow-hidden">
                                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                                    <User className="w-6 h-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                        {user?.username || 'Admin'}
                                    </p>
                                    <p className="text-xs text-slate-500 truncate">Online</p>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleLogout}
                            className={`p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors ${!isSidebarOpen && 'mx-auto'}`}
                            title="Logout"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Collapse Button */}
                <button
                    onClick={toggleSidebar}
                    className="absolute top-6 -right-3 w-6 h-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center shadow-lg text-slate-500 hover:text-blue-600 transition-colors"
                >
                    {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                </button>
            </motion.aside>

            {/* Main Content Area */}
            <main className="flex-1 relative overflow-y-auto">
                <div className="p-6 md:p-8 max-w-[1600px] mx-auto min-h-full">
                    <React.Suspense fallback={
                        <div className="flex items-center justify-center h-full text-blue-500">
                            Loading...
                        </div>
                    }>
                        <Outlet />
                    </React.Suspense>
                </div>
            </main>
        </div>
    );
};

export default PostProductionLayout;
