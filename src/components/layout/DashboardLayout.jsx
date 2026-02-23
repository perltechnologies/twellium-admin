import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../ui';
import {
    LayoutDashboard,
    Factory,
    Settings,
    LogOut,
    Menu,
    X,
    Search,
    Bell,
    ChevronDown,
    ChevronRight,
    Package,
    User,
    Database,
    Calculator,
    Sun,
    Moon,
    Maximize,
    PanelLeftClose,
    PanelLeftOpen,
} from 'lucide-react';

// ─── Sidebar ───────────────────────────────────────────────────────
const Sidebar = ({ isOpen, isCollapsed, isMobile, onClose, onToggleCollapse }) => {
    const location = useLocation();
    const [openSubmenus, setOpenSubmenus] = useState({
        production: true,
        definitions: false,
        inventory: false,
        configs: false,
    });

    const toggleSubmenu = (key) => {
        setOpenSubmenus(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const navigation = [
        {
            section: 'Main Menu',
            items: [
                { name: 'Overview', icon: LayoutDashboard, path: '/dashboard' },
                { name: 'Formulas', icon: Calculator, path: '/dashboard/formulas' },
            ],
        },
        {
            section: 'Production',
            items: [
                {
                    name: 'Production',
                    icon: Factory,
                    key: 'production',
                    submenu: [
                        { name: 'Reports', path: '/dashboard/production' },
                        { name: 'Stoppage Logs', path: '/dashboard/production/stoppages' },
                        { name: 'Incident Categories', path: '/dashboard/production/incident-categories' },
                        { name: 'Downtime Categories', path: '/dashboard/production/downtime-categories' },
                        { name: 'Downtime Sub-Categories', path: '/dashboard/production/downtime-sub-categories' },
                        { name: 'Meter Readings', path: '/dashboard/production/meters' },
                        { name: 'Pets / Lines', path: '/dashboard/production/pets' },
                        { name: 'Shifts', path: '/dashboard/production/shifts' },
                    ],
                },
            ],
        },
        {
            section: 'Configurations',
            items: [
                {
                    name: 'Production Configs',
                    icon: Settings,
                    key: 'configs',
                    submenu: [
                        { name: 'Production Ranges', path: '/dashboard/production/configs/ranges' },
                        { name: 'Measuring Units', path: '/dashboard/production/configs/units' },
                        { name: 'Standard CO2', path: '/dashboard/production/configs/co2' },
                        { name: 'Syrup Densities', path: '/dashboard/production/configs/densities' },
                        { name: 'Dilution Ratios', path: '/dashboard/production/configs/ratios' },
                        { name: 'Syrup Concentrations', path: '/dashboard/production/configs/concentrations' },
                        { name: 'Bottles Per Pack', path: '/dashboard/production/configs/bottles-per-pack' },
                        { name: 'Line Speeds', path: '/dashboard/production/configs/line-speeds' },
                    ],
                },
                {
                    name: 'Material Lookups',
                    icon: Database,
                    key: 'definitions',
                    submenu: [
                        { name: 'Suppliers', path: '/dashboard/definitions/suppliers' },
                        { name: 'Preform Colors', path: '/dashboard/definitions/preform-colors' },
                        { name: 'Cap Types', path: '/dashboard/definitions/cap-types' },
                        { name: 'Cap Colors', path: '/dashboard/definitions/cap-colors' },
                        { name: 'Label Sizes', path: '/dashboard/definitions/label-product-sizes' },
                        { name: 'Label Names', path: '/dashboard/definitions/label-names' },
                        { name: 'Shrink Sizes', path: '/dashboard/definitions/shrink-product-sizes' },
                        { name: 'Pack Sizes', path: '/dashboard/definitions/pack-sizes' },
                        { name: 'Shrink Names', path: '/dashboard/definitions/shrink-names' },
                        { name: 'Preform Sizes (g)', path: '/dashboard/definitions/preform-sizes' },
                        { name: 'Cage Quantities', path: '/dashboard/definitions/cage-quantities' },
                        { name: 'Cap Box Qtys', path: '/dashboard/definitions/cap-box-quantities' },
                    ],
                },
            ],
        },
        {
            section: 'Inventory',
            items: [
                {
                    name: 'Inventory',
                    icon: Package,
                    key: 'inventory',
                    submenu: [
                        { name: 'Products', path: '/dashboard/inventory/products' },
                    ],
                },
            ],
        },
        {
            section: 'User Management',
            items: [
                { name: 'Manage Users', icon: User, path: '/dashboard/users' },
            ],
        },
    ];

    const isSubmenuActive = (item) => {
        if (item.submenu) {
            return item.submenu.some(sub => location.pathname === sub.path);
        }
        return false;
    };

    return (
        <>
            {/* Mobile overlay */}
            {isMobile && isOpen && (
                <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
            )}

            <aside
                className={cn(
                    'fixed top-0 left-0 z-50 h-screen bg-white dark:bg-[#030318] border-r border-crm-border dark:border-[#161641] transition-all duration-300 ease-in-out flex flex-col',
                    isCollapsed && !isMobile ? 'w-[70px]' : 'w-[240px]',
                    isMobile && !isOpen ? '-translate-x-full' : 'translate-x-0',
                )}
            >
                {/* Logo Area */}
                <div className="h-[56px] flex items-center justify-between px-4 border-b border-crm-border dark:border-[#161641] flex-shrink-0">
                    {!isCollapsed ? (
                        <Link to="/dashboard" className="flex items-center gap-2.5 no-underline">
                            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">T</div>
                    <span className="text-15 font-bold text-[#1f2020] dark:text-[#d9dcff]">Twellium</span>
                        </Link>
                    ) : (
                        <Link to="/dashboard" className="mx-auto">
                            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">T</div>
                        </Link>
                    )}
                    {!isMobile && !isCollapsed && (
                        <button
                            onClick={onToggleCollapse}
                            className="p-1 text-[#9d9d9d] hover:text-[#1f2020] dark:text-[#828997] dark:hover:text-[#d9dcff] transition-colors"
                        >
                            <PanelLeftClose className="h-4 w-4" />
                        </button>
                    )}
                    {!isMobile && isCollapsed && (
                        <button
                            onClick={onToggleCollapse}
                            className="mx-auto mt-2 p-1 text-[#9d9d9d] hover:text-[#1f2020] dark:text-[#828997] dark:hover:text-[#d9dcff] transition-colors"
                        >
                            <PanelLeftOpen className="h-4 w-4" />
                        </button>
                    )}
                    {isMobile && (
                        <button onClick={onClose} className="p-1 text-[#9d9d9d]">
                            <X className="h-5 w-5" />
                        </button>
                    )}
                </div>

                {/* Sidebar Menu */}
                <div className="sidebar-inner flex-1 overflow-y-auto py-2">
                    <nav className="sidebar-menu">
                        {navigation.map((section, sIdx) => (
                            <div key={sIdx}>
                                {/* Section Title */}
                                {!isCollapsed && (
                                    <div className="menu-title">{section.section}</div>
                                )}
                                {isCollapsed && <div className="my-2 mx-3 border-t border-[#e2e8f0] dark:border-[#161641]" />}

                                <ul className="space-y-0.5 px-2">
                                    {section.items.map((item) => {
                                        const hasSubmenu = !!item.submenu;
                                        const isActive = !hasSubmenu && location.pathname === item.path;
                                        const isSubActive = hasSubmenu && isSubmenuActive(item);
                                        const isSubOpen = openSubmenus[item.key];

                                        return (
                                            <li key={item.name}>
                                                {hasSubmenu ? (
                                                    <>
                                                        <button
                                                            onClick={() => toggleSubmenu(item.key)}
                                                            className={cn(
                                                                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[15px] font-bold transition-colors',
                                                                isSubActive
                                                                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-600/10'
                                                                    : 'text-[#5a5b5b] dark:text-[#97aac1] hover:text-blue-600 dark:hover:text-blue-400 hover:bg-[#f7f8f9] dark:hover:bg-[#0c0c20]',
                                                            )}
                                                        >
                                                            <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                                                            {!isCollapsed && (
                                                                <>
                                                                    <span className="flex-1 text-left truncate">{item.name}</span>
                                                                    <ChevronRight className={cn('h-3.5 w-3.5 transition-transform duration-200', isSubOpen && 'rotate-90')} />
                                                                </>
                                                            )}
                                                        </button>
                                                        {isSubOpen && !isCollapsed && (
                                                            <ul className="mt-0.5 ml-[30px] border-l border-[#e2e8f0] dark:border-[#161641] pl-3 space-y-0.5">
                                                                {item.submenu.map((sub) => (
                                                                    <li key={sub.path}>
                                                                        <Link
                                                                            to={sub.path}
                                                                            className={cn(
                                                                                'block px-3 py-2 rounded-md text-sm font-medium transition-colors',
                                                                                location.pathname === sub.path
                                                                                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-600/5'
                                                                                    : 'text-[#707070] dark:text-[#828997] hover:text-blue-600 dark:hover:text-blue-400',
                                                                            )}
                                                                        >
                                                                            {sub.name}
                                                                        </Link>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </>
                                                ) : (
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
                                                        {!isCollapsed && <span className="truncate">{item.name}</span>}
                                                    </Link>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))}
                    </nav>
                </div>
            </aside>
        </>
    );
};

// ─── Header ────────────────────────────────────────────────────────
const Header = ({ onMenuClick }) => {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [showNotifications, setShowNotifications] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const notifRef = useRef(null);
    const profileRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false);
            if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };

    return (
        <header className="h-[56px] bg-white dark:bg-[#030318] border-b border-[#e2e8f0] dark:border-[#161641] flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
            {/* Left */}
            <div className="flex items-center gap-3">
                <button
                    className="md:hidden p-2 text-[#707070] hover:text-[#1f2020] dark:text-[#828997] rounded-lg hover:bg-[#f7f8f9] dark:hover:bg-[#0c0c20] transition-colors"
                    onClick={onMenuClick}
                >
                    <Menu className="h-5 w-5" />
                </button>

                <div className="hidden md:flex items-center relative">
                    <input
                        type="text"
                        placeholder="Search Keyword"
                        className="w-56 lg:w-72 pl-9 pr-3 py-2 text-sm bg-[#f7f8f9] dark:bg-[#0c0c20] border border-[#e2e8f0] dark:border-[#161641] rounded-lg text-[#1f2020] dark:text-[#d9dcff] placeholder:text-[#9d9d9d] focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                    />
                    <Search className="absolute left-3 h-4 w-4 text-[#9d9d9d]" />
                </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-1">
                <button
                    onClick={handleFullscreen}
                    className="hidden md:flex p-2 text-[#707070] hover:text-[#1f2020] dark:text-[#828997] dark:hover:text-[#d9dcff] rounded-lg hover:bg-[#f7f8f9] dark:hover:bg-[#0c0c20] transition-colors"
                    title="Toggle Fullscreen"
                >
                    <Maximize className="h-[18px] w-[18px]" />
                </button>

                <button
                    onClick={toggleTheme}
                    className="p-2 text-[#707070] hover:text-yellow-500 dark:text-[#828997] dark:hover:text-yellow-400 rounded-lg hover:bg-[#f7f8f9] dark:hover:bg-[#0c0c20] transition-colors"
                    title="Toggle theme"
                >
                    {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
                </button>

                <div className="hidden md:block w-px h-6 bg-[#e2e8f0] dark:bg-[#161641] mx-2" />

                {/* Notifications */}
                <div className="relative" ref={notifRef}>
                    <button
                        onClick={() => { setShowNotifications(v => !v); setShowProfile(false); }}
                        className="relative p-2 text-[#707070] hover:text-[#1f2020] dark:text-[#828997] dark:hover:text-[#d9dcff] rounded-lg hover:bg-[#f7f8f9] dark:hover:bg-[#0c0c20] transition-colors"
                    >
                        <Bell className="h-[18px] w-[18px] animate-ring" />
                        <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
                    </button>

                    {showNotifications && (
                        <div className="dropdown-animate absolute right-0 mt-2 w-80 bg-white dark:bg-[#030318] border border-[#e2e8f0] dark:border-[#161641] rounded-xl shadow-lg overflow-hidden">
                            <div className="px-4 py-3 border-b border-[#e2e8f0] dark:border-[#161641]">
                <h6 className="text-base font-semibold text-[#1f2020] dark:text-[#d9dcff]">Notifications</h6>
                            </div>
                            <div className="max-h-72 overflow-y-auto">
                                <div className="px-4 py-8 text-center text-[#9d9d9d] text-sm">No new notifications</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* User Profile */}
                <div className="relative" ref={profileRef}>
                    <button
                        onClick={() => { setShowProfile(v => !v); setShowNotifications(false); }}
                        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#f7f8f9] dark:hover:bg-[#0c0c20] transition-colors ml-1"
                    >
                        <div className="h-8 w-8 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center border border-blue-200 dark:border-blue-800">
                            <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="hidden md:block text-left">
                            <p className="text-sm font-medium text-[#1f2020] dark:text-[#d9dcff] leading-none">{user?.username || 'Admin'}</p>
                            <p className="text-xs text-[#9d9d9d] leading-none mt-0.5">Administrator</p>
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
                                        <p className="text-xs text-[#9d9d9d]">Administrator</p>
                                    </div>
                                </div>
                            </div>
                            <div className="py-1">
                                <Link to="/dashboard/settings" className="flex items-center gap-2 px-4 py-2 text-sm text-[#707070] dark:text-[#828997] hover:text-blue-600 dark:hover:text-blue-400 hover:bg-[#f7f8f9] dark:hover:bg-[#0c0c20] transition-colors" onClick={() => setShowProfile(false)}>
                                    <Settings className="h-4 w-4" /> Settings
                                </Link>
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
    );
};

// ─── Footer ────────────────────────────────────────────────────────
const Footer = () => (
    <footer className="py-2 px-5 flex flex-col md:flex-row items-center justify-between text-sm text-[#707070] border-t border-[#e2e8f0] dark:border-[#161641]">
        <p className="mb-1 md:mb-0">
            Copyright © {new Date().getFullYear()}{' '}
            <span className="text-blue-600 font-medium">Twellium</span>
        </p>
        <div className="flex items-center gap-4">
            <span className="hover:text-[#1f2020] dark:hover:text-[#d9dcff] cursor-pointer transition-colors">About</span>
            <span className="hover:text-[#1f2020] dark:hover:text-[#d9dcff] cursor-pointer transition-colors">Terms</span>
            <span className="hover:text-[#1f2020] dark:hover:text-[#d9dcff] cursor-pointer transition-colors">Contact Us</span>
        </div>
    </footer>
);

// ─── Layout ────────────────────────────────────────────────────────
const DashboardLayout = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const sidebarWidth = isMobile ? 0 : sidebarCollapsed ? 70 : 240;

    return (
        <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#030318] text-[#707070] dark:text-[#828997]">
            <Sidebar
                isOpen={mobileMenuOpen}
                isCollapsed={sidebarCollapsed}
                isMobile={isMobile}
                onClose={() => setMobileMenuOpen(false)}
                onToggleCollapse={() => setSidebarCollapsed(c => !c)}
            />

            <div className="flex flex-col min-h-screen transition-all duration-300" style={{ marginLeft: sidebarWidth }}>
                <Header onMenuClick={() => setMobileMenuOpen(true)} />

                <main className="flex-1 p-4 md:p-6">
                    <div className="max-w-[1400px] mx-auto">
                        <Outlet />
                    </div>
                </main>

                <Footer />
            </div>
        </div>
    );
};

export default DashboardLayout;
