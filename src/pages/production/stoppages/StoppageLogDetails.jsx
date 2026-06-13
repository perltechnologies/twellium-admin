import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productionApi } from '../../../api/production';

const StoppageLogDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [log, setLog] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLog = async () => {
            try {
                const res = await productionApi.getStoppage(id);
                setLog(res.data?.data || res.data);
            } catch (err) {
                console.error("Failed to load stoppage log", err);
            } finally {
                setLoading(false);
            }
        };
        fetchLog();
    }, [id]);

    if (loading) return (
        <div className="d-flex align-items-center justify-content-center min-vh-50">
            <div className="text-center">
                <div className="spinner-border text-primary mb-3" role="status"></div>
                <p className="text-muted">Loading details...</p>
            </div>
        </div>
    );
    
    if (!log) return (
        <div className="d-flex align-items-center justify-content-center min-vh-50">
            <div className="text-center">
                <i className="ti ti-alert-circle fs-1 text-danger mb-3 d-block"></i>
                <p className="text-danger fw-medium">Log not found</p>
            </div>
        </div>
    );

    return (
        <>
            {/* Header */}
            <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
                <button className="btn btn-outline-secondary" onClick={() => navigate('/dashboard/production/stoppages')}>
                    <i className="ti ti-arrow-left me-2"></i>Back to List
                </button>
                <div className="d-flex gap-2">
                    <button className="btn btn-primary" onClick={() => navigate(`/dashboard/production/stoppages/${id}/edit`)}>
                        <i className="ti ti-edit me-2"></i>Edit Log
                    </button>
                </div>
            </div>

            {/* Title Card */}
            <div className="card mb-4">
                <div className="card-body">
                    <div className="d-flex align-items-center gap-3">
                        <div className="h-12 w-12 rounded-circle bg-warning bg-opacity-10 d-flex align-items-center justify-content-center">
                            <i className="ti ti-alert-triangle fs-4 text-warning"></i>
                        </div>
                        <div>
                            <h4 className="mb-1">Stoppage Log #{log.id}</h4>
                            <p className="text-muted mb-0">
                                <i className="ti ti-calendar me-1"></i>
                                {new Date(log.log_date).toLocaleDateString()} • Hour {log.hour_index}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Cards Grid */}
            <div className="row g-4 mb-4">
                <div className="col-md-4">
                    <div className="card h-100">
                        <div className="card-header">
                            <h6 className="mb-0"><i className="ti ti-file-text me-2 text-primary"></i>Report Info</h6>
                        </div>
                        <div className="card-body">
                            <div className="row g-3">
                                <div className="col-12">
                                    <label className="text-xs text-muted text-uppercase fw-semibold">Report Code</label>
                                    <p className="mb-0 fw-medium">{log.report_code || '-'}</p>
                                </div>
                                <div className="col-12">
                                    <label className="text-xs text-muted text-uppercase fw-semibold">PET Name</label>
                                    <p className="mb-0 fw-medium">{log.pet_name || '-'}</p>
                                </div>
                                <div className="col-12">
                                    <label className="text-xs text-muted text-uppercase fw-semibold">Created By</label>
                                    <p className="mb-0 fw-medium">{log.created_by?.full_name || log.created_by?.username || '-'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-md-4">
                    <div className="card h-100">
                        <div className="card-header">
                            <h6 className="mb-0"><i className="ti ti-activity me-2 text-info"></i>Performance</h6>
                        </div>
                        <div className="card-body">
                            <div className="row g-3">
                                <div className="col-12">
                                    <label className="text-xs text-muted text-uppercase fw-semibold">Efficiency</label>
                                    <p className="mb-0 fw-medium text-info">{log.efficiency}%</p>
                                </div>
                                <div className="col-12">
                                    <label className="text-xs text-muted text-uppercase fw-semibold">Bottles Produced</label>
                                    <p className="mb-0 fw-medium">{log.bottles_produced?.toLocaleString() || '-'}</p>
                                </div>
                                <div className="col-12">
                                    <label className="text-xs text-muted text-uppercase fw-semibold">Downtime</label>
                                    <p className="mb-0 fw-medium text-warning">{log.downtime_minutes} min</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-md-4">
                    <div className="card h-100">
                        <div className="card-header">
                            <h6 className="mb-0"><i className="ti ti-user me-2 text-success"></i>Details</h6>
                        </div>
                        <div className="card-body">
                            <div className="row g-3">
                                <div className="col-12">
                                    <label className="text-xs text-muted text-uppercase fw-semibold">Comments</label>
                                    <p className="mb-0 fw-medium">{log.comments || 'No comments'}</p>
                                </div>
                                <div className="col-12">
                                    <label className="text-xs text-muted text-uppercase fw-semibold">Log Time</label>
                                    <p className="mb-0 fw-medium">{log.log_time || '-'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Incidents Table */}
            <div className="card">
                <div className="card-header d-flex align-items-center justify-content-between">
                    <h6 className="mb-0"><i className="ti ti-layers me-2"></i>Incidents</h6>
                </div>
                <div className="card-body p-0">
                    {log.incidents && log.incidents.length > 0 ? (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th>ID</th>
                                        <th>Description</th>
                                        <th>Time</th>
                                        <th>Category</th>
                                        <th>Sub-Category</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {log.incidents.map((incident, idx) => (
                                        <tr key={incident.id || idx}>
                                            <td>{incident.id}</td>
                                            <td className="fw-medium">{incident.incident_description || '-'}</td>
                                            <td>{incident.incident_time || '-'}</td>
                                            <td>
                                                {incident.downtime_category_name && (
                                                    <span className="badge bg-soft-warning text-warning">{incident.downtime_category_name}</span>
                                                )}
                                            </td>
                                            <td>{incident.sub_downtime_category_name || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-5">
                            <i className="ti ti-layers-off fs-1 text-muted mb-3 d-block"></i>
                            <p className="text-muted mb-0">No incidents recorded</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default StoppageLogDetails;
