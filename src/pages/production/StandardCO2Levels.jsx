import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, RefreshCw, Cloud, Droplets, Activity } from 'lucide-react';
import { productionApi } from '../../api/production';

const StandardCO2Levels = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [formData, setFormData] = useState({ name: '', value: '' });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await productionApi.getStandardCO2s({ page_size: 100 });
            const levels = res.data?.data || res.data?.results || res.data || [];
            setData(levels.sort((a, b) => a.value - b.value));
        } catch (err) {
            console.error('Failed to fetch CO2 levels:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreate = () => {
        setCurrentItem(null);
        setFormData({ name: '', value: '' });
        setError('');
        setIsModalOpen(true);
    };

    const handleEdit = (item) => {
        setCurrentItem(item);
        setFormData(item);
        setError('');
        setIsModalOpen(true);
    };

    const handleDelete = (item) => {
        setItemToDelete(item);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            await productionApi.deleteStandardCO2(itemToDelete.id);
            setDeleteModalOpen(false);
            setItemToDelete(null);
            fetchData();
        } catch (err) {
            console.error('Failed to delete:', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            const payload = {
                name: formData.name,
                value: parseFloat(formData.value)
            };

            if (currentItem) {
                await productionApi.updateStandardCO2(currentItem.id, payload);
            } else {
                await productionApi.createStandardCO2(payload);
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to save CO2 level');
        } finally {
            setSubmitting(false);
        }
    };

    const getLevelStatus = (value) => {
        if (value < 3.5) return { label: 'Low', color: 'warning', icon: '⬇️' };
        if (value <= 4.5) return { label: 'Optimal', color: 'success', icon: '✅' };
        return { label: 'High', color: 'danger', icon: '⬆️' };
    };

    const avgValue = data.length ? (data.reduce((sum, d) => sum + d.value, 0) / data.length).toFixed(2) : 0;
    const minValue = data.length ? Math.min(...data.map(d => d.value)) : 0;
    const maxValue = data.length ? Math.max(...data.map(d => d.value)) : 0;

    return (
        <>
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h4 className="mb-1">Standard CO2 Levels</h4>
                    <p className="text-muted mb-0">Manage CO2 carbonation standards for production</p>
                </div>
                <button onClick={handleCreate} className="btn btn-primary shadow">
                    <Plus className="h-4 w-4 me-2" />
                    Add Level
                </button>
            </div>

            {/* Stats */}
            <div className="row g-3 mb-4">
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body">
                            <div className="d-flex align-items-center gap-3">
                                <div className="p-3 rounded bg-primary bg-opacity-10">
                                    <Cloud className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <div className="text-muted small">Total Levels</div>
                                    <h4 className="mb-0">{data.length}</h4>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body">
                            <div className="d-flex align-items-center gap-3">
                                <div className="p-3 rounded bg-success bg-opacity-10">
                                    <Activity className="h-5 w-5 text-success" />
                                </div>
                                <div>
                                    <div className="text-muted small">Average</div>
                                    <h4 className="mb-0">{avgValue} g/L</h4>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body">
                            <div className="d-flex align-items-center gap-3">
                                <div className="p-3 rounded bg-info bg-opacity-10">
                                    <Droplets className="h-5 w-5 text-info" />
                                </div>
                                <div>
                                    <div className="text-muted small">Min Level</div>
                                    <h4 className="mb-0">{minValue} g/L</h4>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body">
                            <div className="d-flex align-items-center gap-3">
                                <div className="p-3 rounded bg-warning bg-opacity-10">
                                    <Droplets className="h-5 w-5 text-warning" />
                                </div>
                                <div>
                                    <div className="text-muted small">Max Level</div>
                                    <h4 className="mb-0">{maxValue} g/L</h4>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Visual Levels */}
            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-light">
                    <h6 className="mb-0">CO2 Level Visualization</h6>
                </div>
                <div className="card-body">
                    {loading ? (
                        <div className="text-center py-4">
                            <div className="spinner-border spinner-border-sm"></div>
                        </div>
                    ) : data.length === 0 ? (
                        <div className="text-center text-muted py-4">No CO2 levels defined</div>
                    ) : (
                        <div className="row g-3">
                            {data.map((level) => {
                                const status = getLevelStatus(level.value);
                                return (
                                    <div key={level.id} className="col-md-4">
                                        <div className={`card border-${status.color} h-100`}>
                                            <div className="card-body text-center">
                                                <div className="mb-2" style={{ fontSize: '2rem' }}>{status.icon}</div>
                                                <h5 className="mb-1">{level.name}</h5>
                                                <div className="display-6 fw-bold text-primary mb-2">
                                                    {level.value}
                                                    <small className="fs-6 text-muted ms-1">g/L</small>
                                                </div>
                                                <span className={`badge bg-${status.color}`}>{status.label}</span>
                                                <div className="mt-3">
                                                    <button
                                                        onClick={() => handleEdit(level)}
                                                        className="btn btn-sm btn-outline-primary me-1"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(level)}
                                                        className="btn btn-sm btn-outline-danger"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="card border-0 shadow-sm">
                <div className="card-header bg-light d-flex align-items-center justify-content-between">
                    <h6 className="mb-0">All CO2 Levels</h6>
                    <button onClick={fetchData} className="btn btn-sm btn-outline-secondary" disabled={loading}>
                        <RefreshCw className={`h-4 w-4${loading ? ' spin' : ''}`} />
                    </button>
                </div>
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border"></div>
                        </div>
                    ) : data.length === 0 ? (
                        <div className="text-center py-5 text-muted">
                            <p className="mb-2">No CO2 levels found</p>
                            <button onClick={handleCreate} className="btn btn-sm btn-primary">
                                Create First Level
                            </button>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th>Name</th>
                                        <th className="text-end">Value (g/L)</th>
                                        <th>Status</th>
                                        <th className="text-end" style={{ width: '120px' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((level) => {
                                        const status = getLevelStatus(level.value);
                                        return (
                                            <tr key={level.id}>
                                                <td className="fw-medium">
                                                    <span className="me-2">{status.icon}</span>
                                                    {level.name}
                                                </td>
                                                <td className="text-end">
                                                    <span className="badge bg-light text-dark fs-6">
                                                        {level.value}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`badge bg-${status.color}`}>
                                                        {status.label}
                                                    </span>
                                                </td>
                                                <td className="text-end">
                                                    <button
                                                        onClick={() => handleEdit(level)}
                                                        className="btn btn-sm btn-outline-primary me-1"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(level)}
                                                        className="btn btn-sm btn-outline-danger"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">
                                    {currentItem ? 'Edit CO2 Level' : 'Create New CO2 Level'}
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setIsModalOpen(false)}
                                ></button>
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="modal-body">
                                    {error && (
                                        <div className="alert alert-danger">{error}</div>
                                    )}
                                    <div className="mb-3">
                                        <label className="form-label">Level Name *</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                            placeholder="e.g., Standard, High Carbonation"
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">CO2 Value (g/L) *</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-control"
                                            value={formData.value}
                                            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                            required
                                            placeholder="e.g., 4.0"
                                        />
                                        <small className="text-muted">Typical range: 3.5 - 4.5 g/L</small>
                                    </div>
                                    {formData.value && (
                                        <div className={`alert alert-${getLevelStatus(parseFloat(formData.value)).color}`}>
                                            <div className="d-flex align-items-center gap-2">
                                                <span style={{ fontSize: '1.5rem' }}>
                                                    {getLevelStatus(parseFloat(formData.value)).icon}
                                                </span>
                                                <div>
                                                    <strong>{getLevelStatus(parseFloat(formData.value)).label}</strong> carbonation level
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="modal-footer">
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => setIsModalOpen(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                                        {submitting ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2"></span>
                                                Saving...
                                            </>
                                        ) : (
                                            currentItem ? 'Update' : 'Create'
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModalOpen && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Confirm Delete</h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setDeleteModalOpen(false)}
                                ></button>
                            </div>
                            <div className="modal-body">
                                <p>Are you sure you want to delete <strong>{itemToDelete?.name}</strong>?</p>
                                <p className="text-muted mb-0">This action cannot be undone.</p>
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setDeleteModalOpen(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={confirmDelete}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default StandardCO2Levels;
