import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import TopBar from './TopBar';
import Sidebar from './Sidebar';

const postProductionNav = [
    {
        section: 'Overview',
        items: [
            { name: 'Dashboard', icon: 'ti-dashboard', path: '/post-production' },
            { name: 'Plant Overview', icon: 'ti-chart-dots-3', path: '/post-production/analytics/plant-overview' },
            { name: 'Inventory Overview', icon: 'ti-chart-bar', path: '/post-production/overview' },
        ],
    },
    {
        section: 'Production',
        items: [
            { name: 'Production Mode', icon: 'ti-building-factory', path: '/post-production/production' },
            { name: 'Bulk Barcodes', icon: 'ti-barcode', path: '/post-production/analytics/bulk-barcodes' },
            { name: 'Warehouse Flow', icon: 'ti-building-warehouse', path: '/post-production/warehouse' },
        ],
    },
    {
        section: 'Analytics',
        items: [
            { name: 'Batch Traceability', icon: 'ti-git-branch', path: '/post-production/analytics/batch-traceability' },
            { name: 'Product Analysis', icon: 'ti-chart-pie', path: '/post-production/analytics/product-analysis' },
            { name: 'Pet Performance', icon: 'ti-trophy', path: '/post-production/analytics/pet-performance' },
            { name: 'Trend Analysis', icon: 'ti-trending-up', path: '/post-production/analytics/trends' },
            { name: 'Live Dashboard', icon: 'ti-activity', path: '/post-production/analytics/live-dashboard' },
        ],
    },
    {
        section: 'Logistics',
        items: [
            { name: 'Loading & Dispatch', icon: 'ti-truck-delivery', path: '/post-production/logistics/dispatch' },
            { name: 'Vehicle Dispatch', icon: 'ti-map-pin', path: '/post-production/analytics/vehicle-dispatch' },
            { name: 'Vehicles', icon: 'ti-truck', path: '/post-production/logistics/vehicles' },
            { name: 'Drivers', icon: 'ti-id-badge-2', path: '/post-production/logistics/drivers' },
        ],
    },
    {
        section: 'Tools',
        items: [
            { name: 'Activity Logs', icon: 'ti-clipboard-list', path: '/post-production/activity-logs' },
            { name: 'Reprint Labels', icon: 'ti-printer', path: '/post-production/reprint' },
            { name: 'Batch Scan', icon: 'ti-scan', path: '/post-production/batch-scan' },
            { name: 'Unit Lookup', icon: 'ti-search', path: '/post-production/lookup' },
            { name: 'Manage Stages', icon: 'ti-settings', path: '/post-production/manage-stages' },
        ],
    },
];

const PostProductionLayout = () => {
    return (
        <div className="main-wrapper">
            <TopBar />
            <Sidebar navigation={postProductionNav} logoLink="/post-production" />

            <div className="page-wrapper">
                <div className="content pb-0">
                    <React.Suspense fallback={
                        <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '400px' }}>
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    }>
                        <Outlet />
                    </React.Suspense>
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

export default PostProductionLayout;
