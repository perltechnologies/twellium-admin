import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Factory, Truck, ArrowRight, Building2 } from 'lucide-react';

const ModeSelection = () => {
    const navigate = useNavigate();

    return (
        <div className="d-flex align-items-center justify-content-center min-vh-100 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            <div className="container" style={{ maxWidth: 1000 }}>

                {/* Header */}
                <div className="text-center mb-5 animate__animated animate__fadeInDown">

                    <img
                        src="/logo.jpeg"
                        alt="Twellium"
                        style={{ maxWidth: 140 }}
                        className="mb-3"
                    />
                    <h2 className="fw-bold mb-2 text-slate-900 dark:text-white">Select Mode</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-0">Choose your operational environment to continue</p>
                </div>

                {/* Cards */}
                <div className="row g-4">

                    {/* Pre Production */}
                    <div className="col-md-6">
                        <div
                            className="card border-0 h-100 shadow-sm mode-card cursor-pointer animate__animated animate__fadeInLeft"
                            role="button"
                            onClick={() => navigate('/dashboard')}
                            style={{
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                borderRadius: '16px'
                            }}
                        >
                            <div className="card-body d-flex flex-column align-items-center justify-content-center p-5">
                                <div
                                    className="rounded-2xl d-flex align-items-center justify-content-center mb-4 mode-icon mode-icon-primary"
                                    style={{ 
                                        width: 88, 
                                        height: 88,
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    <Factory className="h-10 w-10" />
                                </div>
                                <h4 className="fw-bold mb-2 text-slate-900 dark:text-white">Pre Production</h4>
                                <p className="text-slate-500 dark:text-slate-400 text-center mb-4">
                                    Access the main production dashboard, stoppage logs, and reports management.
                                </p>
                                <span className="text-primary fw-semibold d-inline-flex align-items-center mt-auto">
                                    Enter Dashboard <ArrowRight className="h-4 w-4 ms-2" />
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Post Production */}
                    <div className="col-md-6">
                        <div
                            className="card border-0 h-100 shadow-sm mode-card cursor-pointer animate__animated animate__fadeInRight"
                            role="button"
                            onClick={() => navigate('/post-production/production')}
                            style={{
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                borderRadius: '16px'
                            }}
                        >
                            <div className="card-body d-flex flex-column align-items-center justify-content-center p-5">
                                <div
                                    className="rounded-2xl d-flex align-items-center justify-content-center mb-4 mode-icon mode-icon-success"
                                    style={{ 
                                        width: 88, 
                                        height: 88,
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    <Truck className="h-10 w-10" />
                                </div>
                                <h4 className="fw-bold mb-2 text-slate-900 dark:text-white">Post Production</h4>
                                <p className="text-slate-500 dark:text-slate-400 text-center mb-4">
                                    Manage barcode generation, warehouse scanning, and logistics.
                                </p>
                                <span className="text-success fw-semibold d-inline-flex align-items-center mt-auto">
                                    Enter Dashboard <ArrowRight className="h-4 w-4 ms-2" />
                                </span>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Additional Info */}
                <div className="text-center mt-5 animate__animated animate__fadeIn">
                    <p className="text-slate-400 dark:text-slate-500 mb-0" style={{ fontSize: '0.875rem' }}>
                        Copyright © {new Date().getFullYear()} Twellium. All rights reserved.
                    </p>
                </div>
            </div>

            {/* Scoped styles for hover effects */}
            <style>{`
                .mode-card {
                    background: white;
                }
                .mode-card:hover {
                    transform: translateY(-8px);
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1) !important;
                }
                [data-bs-theme="dark"] .mode-card {
                    background: #1e293b;
                }
                [data-bs-theme="dark"] .mode-card:hover {
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3) !important;
                }
                .mode-icon {
                    transition: all 0.3s ease;
                    border: 2px solid;
                }
                .mode-icon-primary {
                    background-color: rgba(37, 99, 235, 0.08);
                    color: #2563eb;
                    border-color: rgba(37, 99, 235, 0.2);
                }
                .mode-card:hover .mode-icon-primary {
                    background-color: #2563eb;
                    color: #fff;
                    border-color: #2563eb;
                    transform: scale(1.1);
                }
                .mode-icon-success {
                    background-color: rgba(22, 163, 74, 0.08);
                    color: #16a34a;
                    border-color: rgba(22, 163, 74, 0.2);
                }
                .mode-card:hover .mode-icon-success {
                    background-color: #16a34a;
                    color: #fff;
                    border-color: #16a34a;
                    transform: scale(1.1);
                }
                .cursor-pointer {
                    cursor: pointer;
                }
            `}</style>
        </div>
    );
};

export default ModeSelection;
