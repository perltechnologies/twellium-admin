import React, { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { inventoryApi } from '../../api/inventory';
import { format } from 'date-fns';

const UnitLookup = () => {
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const [searchValue, setSearchValue] = useState('');
    const [unit, setUnit] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Accept initial value from URL query param or navigation state
    useEffect(() => {
        const queryValue = searchParams.get('q') || location.state?.value || '';
        if (queryValue) {
            setSearchValue(queryValue);
            handleLookup(queryValue);
        }
    }, []);

    const handleLookup = async (value) => {
        const query = value || searchValue;
        if (!query.trim()) return;

        setLoading(true);
        setError(null);
        setUnit(null);
        try {
            const response = await inventoryApi.getUnitStatus(query.trim());
            const data = response.data?.data || null;
            if (data) {
                setUnit(data);
            } else {
                setError('No unit found for the given identifier');
            }
        } catch (err) {
            setError('Failed to look up unit. Please check the identifier and try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        handleLookup();
    };

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

    return (
        <div className="container-fluid">
            {/* Page Header */}
            <div className="row mb-4">
                <div className="col-12">
                    <div className="d-flex align-items-center">
                        <div>
                            <h4 className="mb-1">
                                <i className="ti ti-search me-2"></i>
                                Unit Lookup
                            </h4>
                            <p className="text-muted mb-0">Search for a unit by barcode or RFID number</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search Card */}
            <div className="row mb-4">
                <div className="col-12">
                    <div className="card">
                        <div className="card-body">
                            <form onSubmit={handleSubmit}>
                                <div className="row g-3 align-items-end">
                                    <div className="col-md-9">
                                        <label className="form-label">Barcode or RFID</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Enter barcode or RFID number..."
                                            value={searchValue}
                                            onChange={(e) => setSearchValue(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-md-3">
                                        <button
                                            type="submit"
                                            className="btn btn-primary w-100"
                                            disabled={loading || !searchValue.trim()}
                                        >
                                            <i className="ti ti-search me-2"></i>
                                            {loading ? 'Searching...' : 'Search'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="row mb-4">
                    <div className="col-12">
                        <div className="alert alert-danger d-flex align-items-center">
                            <i className="ti ti-alert-circle me-2 fs-4"></i>
                            {error}
                        </div>
                    </div>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            )}

            {/* Unit Details */}
            {unit && !loading && (
                <>
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
                </>
            )}
        </div>
    );
};

export default UnitLookup;
