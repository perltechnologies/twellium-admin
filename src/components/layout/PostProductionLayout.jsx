import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import TopBar from './TopBar';
import Sidebar from './Sidebar';

const postProductionNav = [
    {
        section: 'Post-Production',
        items: [
            { name: 'Dashboard', icon: 'ti-dashboard', path: '/post-production' },
            { name: 'Overview', icon: 'ti-chart-bar', path: '/post-production/overview' },
            { name: 'Production Mode', icon: 'ti-building-factory', path: '/post-production/production' },
            { name: 'Warehouse Flow', icon: 'ti-building-warehouse', path: '/post-production/warehouse' },
        ],
    },
    {
        section: 'Logistics',
        items: [
            { name: 'Loading & Dispatch', icon: 'ti-truck-delivery', path: '/post-production/logistics/dispatch' },
            { name: 'Vehicles', icon: 'ti-truck', path: '/post-production/logistics/vehicles' },
            { name: 'Drivers', icon: 'ti-id-badge-2', path: '/post-production/logistics/drivers' },
        ],
    },
    {
        section: 'Tools',
        items: [
            { name: 'Activity Logs', icon: 'ti-clipboard-list', path: '/post-production/activity-logs' },
            { name: 'Reprint Labels', icon: 'ti-printer', path: '/post-production/reprint' },
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
