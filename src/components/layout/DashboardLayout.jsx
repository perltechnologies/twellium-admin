import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";

const DashboardLayout = () => {
    const [setOpenSubmenus] = useState({ production: true, configs: false, definitions: false });

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
        <div className="main-wrapper">
            {/* Header */}
            <TopBar/>

            {/* Sidebar */}
            <Sidebar/>

            {/* Page Wrapper */}
            <div className="page-wrapper">

                <div className="content pb-0">
                    <Outlet />
                </div>

                <footer className="footer d-block d-md-flex justify-content-between text-md-start text-center">
                    <p className="mb-md-0 mb-1">
                        Copyright © {new Date().getFullYear()} <span className="link-primary">Twellium</span>
                    </p>
                    <div className="d-flex align-items-center gap-2 footer-links justify-content-center justify-content-md-end">
                        <a href="#" onClick={(e) => e.preventDefault()}>About</a>
                        <a href="#" onClick={(e) => e.preventDefault()}>Terms</a>
                        <a href="#" onClick={(e) => e.preventDefault()}>Contact Us</a>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default DashboardLayout;
