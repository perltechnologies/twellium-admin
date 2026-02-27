import React from 'react';
import { useNavigate } from 'react-router-dom';

const ModeSelection = () => {
    const navigate = useNavigate();

    return (
        <div className="d-flex align-items-center justify-content-center vh-100 bg-light">
            <div className="container" style={{ maxWidth: 900 }}>

                {/* Header */}
                <div className="text-center mb-5">
                    <img
                        src="/logo.jpeg"
                        alt="Twellium"
                        style={{ maxWidth: 141 }}
                        className="mb-3"
                    />
                    <h2 className="fw-bold mb-2">Select Mode</h2>
                    <p className="text-muted mb-0">Choose your operational environment to continue</p>
                </div>

                {/* Cards */}
                <div className="row g-4">

                    {/* Pre Production */}
                    <div className="col-md-6">
                        <div
                            className="card border h-100 text-center mode-card"
                            role="button"
                            onClick={() => navigate('/dashboard')}
                        >
                            <div className="card-body d-flex flex-column align-items-center justify-content-center p-5">
                                <div
                                    className="rounded-circle d-flex align-items-center justify-content-center mb-4 mode-icon mode-icon-primary"
                                    style={{ width: 80, height: 80 }}
                                >
                                    <i className="ti ti-building-factory-2 fs-1"></i>
                                </div>
                                <h4 className="fw-bold mb-2">Pre Production</h4>
                                <p className="text-muted fs-14 mb-4">
                                    Access the main production dashboard, stoppage logs, and reports management.
                                </p>
                                <span className="text-primary fw-medium d-inline-flex align-items-center">
                                    Enter Dashboard <i className="ti ti-arrow-right ms-2"></i>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Post Production */}
                    <div className="col-md-6">
                        <div
                            className="card border h-100 text-center mode-card"
                            role="button"
                            onClick={() => navigate('/post-production/production')}
                        >
                            <div className="card-body d-flex flex-column align-items-center justify-content-center p-5">
                                <div
                                    className="rounded-circle d-flex align-items-center justify-content-center mb-4 mode-icon mode-icon-success"
                                    style={{ width: 80, height: 80 }}
                                >
                                    <i className="ti ti-truck-delivery fs-1"></i>
                                </div>
                                <h4 className="fw-bold mb-2">Post Production</h4>
                                <p className="text-muted fs-14 mb-4">
                                    Manage barcode generation, warehouse scanning, and logistics.
                                </p>
                                <span className="text-success fw-medium d-inline-flex align-items-center">
                                    Enter Dashboard <i className="ti ti-arrow-right ms-2"></i>
                                </span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Scoped styles for hover effects */}
            <style>{`
                .mode-card {
                    transition: transform 0.25s ease, box-shadow 0.25s ease;
                    cursor: pointer;
                }
                .mode-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 .75rem 1.5rem rgba(18,38,63,.08);
                }
                .mode-icon {
                    transition: background-color 0.3s, color 0.3s, border-color 0.3s;
                    border: 1px solid;
                }
                .mode-icon-primary {
                    background-color: rgba(var(--bs-primary-rgb), .08);
                    color: var(--bs-primary);
                    border-color: rgba(var(--bs-primary-rgb), .2);
                }
                .mode-card:hover .mode-icon-primary {
                    background-color: var(--bs-primary);
                    color: #fff;
                    border-color: var(--bs-primary);
                }
                .mode-icon-success {
                    background-color: rgba(var(--bs-success-rgb), .08);
                    color: var(--bs-success);
                    border-color: rgba(var(--bs-success-rgb), .2);
                }
                .mode-card:hover .mode-icon-success {
                    background-color: var(--bs-success);
                    color: #fff;
                    border-color: var(--bs-success);
                }
            `}</style>
        </div>
    );
};

export default ModeSelection;
