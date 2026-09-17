import React from 'react';
import { Outlet } from 'react-router-dom';
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import PageAccessBoundary from '../auth/PageAccessBoundary';

const DashboardLayout = () => {
    return (
        <div className="main-wrapper">
            {/* Header */}
            <TopBar/>

            {/* Sidebar */}
            <Sidebar/>

            {/* Page Wrapper */}
            <div className="page-wrapper">

                <div className="content pb-0">
                    <PageAccessBoundary>
                        <Outlet />
                    </PageAccessBoundary>
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
