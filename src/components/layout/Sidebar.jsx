import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
    const location = useLocation();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [openSubmenus, setOpenSubmenus] = useState({ production: true, configs: false, definitions: false });

    const toggleSubmenu = (key) => {
        setOpenSubmenus(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const navigation = [
        {
            section: 'Main Menu',
            items: [
                { name: 'Overview', icon: 'ti-dashboard', path: '/dashboard' },
                { name: 'Formulas', icon: 'ti-calculator', path: '/dashboard/formulas' },
            ],
        },
        {
            section: 'Production',
            items: [
                {
                    name: 'Production',
                    icon: 'ti-building-factory',
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
                    icon: 'ti-settings-cog',
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
                    icon: 'ti-database',
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
                { name: 'Products', icon: 'ti-package', path: '/dashboard/inventory/products' },
            ],
        },
        {
            section: 'User Management',
            items: [
                { name: 'Manage Users', icon: 'ti-users', path: '/dashboard/users' },
            ],
        },
    ];

    useEffect(() => {
        if (window.bootstrap) {
            const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            tooltipTriggerList.map(el => new window.bootstrap.Tooltip(el));
        }
    }, []);

    return (
            <div className="sidebar" id="sidebar">

                <div className="sidebar-logo">
                    <div>
                        <Link to="/dashboard" className="logo logo-normal">

                            <img src="/logo.jpeg" width={100} alt="Logo" />
                        </Link>

                        <Link to="/Dashboard" className="logo-small">
                            <img src="/logo.jpeg" width={100} alt="Logo" />
                        </Link>
                        <Link to="/Dashboard" className="dark-logo">
                            <img src="/logo.jpeg" width={100} alt="Logo" />
                        </Link>
                    </div>
                    <button className="sidenav-toggle-btn btn border-0 p-0 active" id="toggle_btn">
                        <i className="ti ti-arrow-bar-to-left"></i>
                    </button>
                    <button className="sidebar-close" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
                        <i className="ti ti-x align-middle"></i>
                    </button>
                </div>
                <div className="sidebar-inner" data-simplebar>
                    <div id="sidebar-menu" className="sidebar-menu">
                        <ul>
                            {navigation.map((section, idx) => (
                                <React.Fragment key={idx}>
                                    <li className="menu-title"><span>{section.section}</span></li>
                                    <li>
                                        <ul>
                                            {section.items.map((item) => (
                                                <li key={item.name} className={item.submenu ? 'submenu' : ''}>
                                                    {item.submenu ? (
                                                        <>
                                                            <a href="#" onClick={(e) => { e.preventDefault(); toggleSubmenu(item.key); }} className={openSubmenus[item.key] ? 'subdrop' : ''}>
                                                                <i className={`ti ${item.icon}`}></i>
                                                                <span>{item.name}</span>
                                                                <span className="menu-arrow"></span>
                                                            </a>
                                                            <ul style={{ display: openSubmenus[item.key] ? 'block' : 'none' }}>
                                                                {item.submenu.map((sub) => (
                                                                    <li key={sub.path}>
                                                                        <Link to={sub.path} className={location.pathname === sub.path ? 'active' : ''}>
                                                                            {sub.name}
                                                                        </Link>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </>
                                                    ) : (
                                                        <Link to={item.path} className={location.pathname === item.path ? 'active' : ''}>
                                                            <i className={`ti ${item.icon}`}></i>
                                                            <span>{item.name}</span>
                                                        </Link>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </li>
                                </React.Fragment>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
    );
};

export default Sidebar;