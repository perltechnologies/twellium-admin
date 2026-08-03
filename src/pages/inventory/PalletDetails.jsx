import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { inventoryApi } from '../../api/inventory';
import { format } from 'date-fns';

const PalletDetails = () => {
    const { identifier } = useParams();
    const navigate = useNavigate();
    const [unit, setUnit] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDetails = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await inventoryApi.getUnitStatus(identifier);
                setUnit(response.data?.data || null);
            } catch (err) {
                setError('Failed to load pallet details');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        if (identifier) {
            fetchDetails();
        }
    }, [identifier]);

    const getStatusBadge = (status) => {
        const statusMap = {
            PRODUCTION: 'bg-soft-info text-info',
            WAREHOUSE: 'bg-soft-primary text-primary',
            QUALIFIED: 'bg-soft-success text-success',
            LOADING: 'bg-soft-warning text-warning',
            LOADED: 'bg-soft-success text-success',
            DAMAGED: 'bg-soft-danger text-danger',
        };
        const cls = statusMap[status] || 'bg-soft-secondary text-secondary';
        return <span className={`badge ${cls}`}>{status}</span>;
    };

    if (loading) {
        return (
            <div className="container-fluid">
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !unit) {
        return (
            <div className="container-fluid">
                <div className="alert alert-danger d-flex align-items-center">
                    <i className="ti ti-alert-circle me-2 fs-4"></i>
                    {error || 'Unit not found'}
                </div>
                <button className="btn btn-outline-secondary" onClick={() => navigate(-1)}>
                    <i className="ti ti-arrow-left me-1"></i>
                    Back
                </button>
            </div>
        );
    }

    return (
        <div className="container-fluid">
            {/* Page Header */}
            <div className="row mb-4">
                <div className="col-12">
                    <div className="d-flex align-items-center justify-content-between">
                        <div>
                            <h4 className="mb-1">
                                <i className="ti ti-box me-2"></i>
                                Pallet Details
                            </h4>
                            <p className="text-muted mb-0">Detailed information for unit {identifier}</p>
                        </div>
                        <button
                            className="btn btn-outline-secondary"
                            onClick={() => navigate(-1)}
                        >
                            <i className="ti ti-arrow-left me-1"></i>
                            Back
                        </button>
                    </div>
                </div>
            </div>

            {/* Unit Info Card */}
            <div className="row mb-4">
                <div className="col-12">
                    <div className="card">
                        <div className="card-header">
                            <h5 className="card-title mb-0">
                                <i className="ti ti-info-circle me-2"></i>
                                Unit Information
                            </h5>
                        </div>
                        <div className="card-body">
                            <div className="row g-3">
                                <div className="col-md-4">
                                    <label className="form-label text-muted small mb-0">Product</label>
                                    <p className="fw-semibold mb-0">{unit.product_name}</p>
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label text-muted small mb-0">Line</label>
                                    <p className="fw-semibold mb-0">{unit.pet_name}</p>
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label text-muted small mb-0">Quantity</label>
                                    <p className="fw-semibold mb-0">{unit.quantity}</p>
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label text-muted small mb-0">Barcode</label>
                                    <p className="fw-semibold mb-0"><code>{unit.current_barcode}</code></p>
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label text-muted small mb-0">RFID</label>
                                    <p className="fw-semibold mb-0">{unit.rfid_number || '—'}</p>
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label text-muted small mb-0">Internal ID</label>
                                    <p className="fw-semibold mb-0">{unit.internal_id || '—'}</p>
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label text-muted small mb-0">Status</label>
                                    <div>{getStatusBadge(unit.current_status)}</div>
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label text-muted small mb-0">Warehouse</label>
                                    <p className="fw-semibold mb-0">{unit.current_warehouse_name || '—'}</p>
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label text-muted small mb-0">Created</label>
                                    <p className="fw-semibold mb-0">
                                        {unit.created_at
                                            ? format(new Date(unit.created_at), 'dd MMM yyyy HH:mm')
                                            : '—'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Movement History */}
            <div className="row mb-4">
                <div className="col-12">
                    <div className="card">
                        <div className="card-header d-flex align-items-center justify-content-between">
                            <h5 className="card-title mb-0">
                                <i className="ti ti-history me-2"></i>
                                Movement History
                            </h5>
                            <span className="badge bg-soft-primary text-primary">
                                {unit.history?.length || 0} entries
                            </span>
                        </div>
                        <div className="card-body p-0">
                            {unit.history && unit.history.length > 0 ? (
                                <div className="table-responsive">
                                    <table className="table table-striped mb-0">
                                        <thead>
                                            <tr>
                                                <th>Stage</th>
                                                <th>Time</th>
                                                <th>Scanned By</th>
                                                <th>Warehouse</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {unit.history.map((entry) => (
                                                <tr key={entry.id}>
                                                    <td>{entry.stage}</td>
                                                    <td>
                                                        {entry.timestamp
                                                            ? format(new Date(entry.timestamp), 'dd MMM yyyy HH:mm')
                                                            : '—'}
                                                    </td>
                                                    <td>{entry.scanned_by_name || '—'}</td>
                                                    <td>{entry.warehouse || '—'}</td>
                                                    <td>{getStatusBadge(entry.status)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-4 text-muted">
                                    <i className="ti ti-history-off fs-1 d-block mb-2"></i>
                                    No movement history
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Labels */}
            <div className="row">
                <div className="col-12">
                    <div className="card">
                        <div className="card-header d-flex align-items-center justify-content-between">
                            <h5 className="card-title mb-0">
                                <i className="ti ti-tag me-2"></i>
                                Labels
                            </h5>
                            <span className="badge bg-soft-primary text-primary">
                                {unit.labels?.length || 0} labels
                            </span>
                        </div>
                        <div className="card-body p-0">
                            {unit.labels && unit.labels.length > 0 ? (
                                <div className="table-responsive">
                                    <table className="table table-striped mb-0">
                                        <thead>
                                            <tr>
                                                <th>Barcode</th>
                                                <th>Stage</th>
                                                <th>Active</th>
                                                <th>Created</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {unit.labels.map((label) => (
                                                <tr key={label.id}>
                                                    <td><code>{label.barcode}</code></td>
                                                    <td>{label.stage}</td>
                                                    <td>
                                                        {label.is_active ? (
                                                            <span className="badge bg-soft-success text-success">Active</span>
                                                        ) : (
                                                            <span className="badge bg-soft-secondary text-secondary">Inactive</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {label.created_at
                                                            ? format(new Date(label.created_at), 'dd MMM yyyy HH:mm')
                                                            : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-4 text-muted">
                                    <i className="ti ti-tag-off fs-1 d-block mb-2"></i>
                                    No labels found
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PalletDetails;
