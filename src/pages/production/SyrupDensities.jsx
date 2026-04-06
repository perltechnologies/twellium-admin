import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, RefreshCw, Droplet, Beaker } from 'lucide-react';
import { productionApi } from '../../api/production';

const SyrupDensities = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [formData, setFormData] = useState({ name: '', value: '', unit: '' });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await productionApi.getSyrupDensities({ page_size: 100 });
            const densities = res.data?.data || res.data?.results || res.data || [];
            setData(densities.sort((a, b) => a.value - b.value));
        } catch (err) {
            console.error('Failed to fetch densities:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreate = () => {
        setCurrentItem(null);
        setFormData({ name: '', value: '', unit: 'g/mL' });
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
            await productionApi.deleteSyrupDensity(itemToDelete.id);
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
                value: parseFloat(formData.value),
                unit: formData.unit
            };

            if (currentItem) {
                await productionApi.updateSyrupDensity(currentItem.id, payload);
            } else {
                await productionApi.createSyrupDensity(payload);
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to save density');
        } finally {
            setSubmitting(false);
        }
    };

    const getDensityStatus = (value) => {
        if (value < 1.2) return { label: 'Light', color: 'info', icon: '💧' };
        if (value <= 1.35) return { label: 'Standard', color: 'success', icon: '✅' };
        return { label: 'Heavy', color: 'warning', icon: '🍯' };
    };

    const avgValue = data.length ? (data.reduce((sum, d) => sum + d.value, 0) / data.length).toFixed(3) : 0;

    return (
        <>
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h4 className="mb-1">Syrup Densities</h4>
                    <p className="text-muted mb-0">Manage syrup density standards for production</p>
                </div>
                <button onClick={handleCreate} className="btn btn-primary shadow">
                    <Plus className="h-4 w-4 me-2" />
                    Add Density
                </button>
            </div>

            {/* Stats */}
            <div className="row g-3 mb-4">
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body">
                            <div className="d-flex align-items-center gap-3">
                                <div className="p-3 rounded bg-primary bg-opacity-10">
                                    <Droplet className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <div className="text-muted small">Total Densities</div>
                                    <h4 className="mb-0">{data.length}</h4>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body">
                            <div className="d-flex align-items-center gap-3">
                                <div className="p-3 rounded bg-success bg-opacity-10">
                                    <Beaker className="h-5 w-5 text-success" />
                                </div>
                                <div>
                                    <div className="text-muted small">Average Density</div>
                                    <h4 className="mb-0">{avgValue} g/mL</h4>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body">
                            <div className="d-flex align-items-center gap-3">
                                <div className="p-3 rounded bg-info bg-opacity-10">
                                    <Droplet className="h-5 w-5 text-info" />
                                </div>
                                <div>
                                    <div className="text-muted small">Range</div>
                                    <h4 className="mb-0">
                                        {data.length ? `${Math.min(...data.map(d => d.value))} - ${Math.max(...data.map(d => d.value))}` : '0'}
                                    </h4>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Visual Cards */}
            <div className="row g-3 mb-4">
                {loading ? (
                    <div className="col-12 text-center py-5">
                        <div className="spinner-border"></div>
                    </div>
                ) : data.length === 0 ? (
                    <div className="col-12">
                        <div className="card border-0 shadow-sm">
                            <div className="card-body text-center py-5">
                                <div className="text-muted mb-3">No syrup densities found</div>
                                <button onClick={handleCreate} className="btn btn-sm btn-primary">
                                    Create First Density
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    data.map((density) => {
                        const status = getDensityStatus(density.value);
                        return (
                            <div key={density.id} className="col-md-6 col-lg-4">
                                <div className={`card border-${status.color} h-100 shadow-sm`}>
                                    <div className="card-body">
                                        <div className="text-center mb-3">
                                            <div style={{ fontSize: '3rem' }}>{status.icon}</div>
                                            <h5 className="mb-1">{density.name}</h5>
                                            <span className={`badge bg-${status.color}`}>{status.label}</span>
                                        </div>
                                        <div className="text-center mb-3">
                                            <div className="display-5 fw-bold text-primary">
                                                {density.value}
                                            </div>
                                            <div className="text-muted">{density.unit || 'g/mL'}</div>
                                        </div>
                                        <div className="d-flex gap-2 justify-content-center">
                                            <button
                                                onClick={() => handleEdit(density)}
                                                className="btn btn-sm btn-outline-primary"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(density)}
                                                className="btn btn-sm btn-outline-danger"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Table */}
            <div className="card border-0 shadow-sm">
                <div className="card-header bg-light d-flex align-items-center justify-content-between">
                    <h6 className="mb-0">All Densities</h6>
                    <button onClick={fetchData} className="btn btn-sm btn-outline-secondary" disabled={loading}>
                        <RefreshCw className={`h-4 w-4${loading ? ' spin' : ''}`} />
                    </button>
                </div>
                <div className="card-body p-0">
                    {!loading && data.length > 0 && (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th style={{ width: '60px' }}>Type</th>
                                        <th>Name</th>
                                        <th className="text-end">Value</th>
                                        <th>Unit</th>
                                        <th>Status</th>
                                        <th className="text-end" style={{ width: '120px' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((density) => {
                                        const status = getDensityStatus(density.value);
                                        return (
                                            <tr key={density.id}>
                                                <td className="text-center" style={{ fontSize: '1.5rem' }}>
                                                    {status.icon}
                                                </td>
                                                <td className="fw-medium">{density.name}</td>
                                                <td className="text-end">
                                                    <span className="badge bg-light text-dark fs-6">
                                                        {density.value}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="badge bg-secondary bg-opacity-10 text-secondary">
                                                        {density.unit || 'g/mL'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`badge bg-${status.color}`}>
                                                        {status.label}
                                                    </span>
                                                </td>
                                                <td className="text-end">
                                                    <button
                                                        onClick={() => handleEdit(density)}
                                                        className="btn btn-sm btn-outline-primary me-1"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(density)}
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
                                    {currentItem ? 'Edit Density' : 'Create New Density'}
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
                                        <label className="form-label">Density Name *</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                            placeholder="e.g., Standard Syrup, High Brix"
                                        />
                                    </div>
                                    <div className="row">
                                        <div className="col-md-8 mb-3">
                                            <label className="form-label">Density Value *</label>
                                            <input
                                                type="number"
                                                step="0.001"
                                                className="form-control"
                                                value={formData.value}
                                                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                                required
                                                placeholder="e.g., 1.28"
                                            />
                                            <small className="text-muted">Typical range: 1.2 - 1.4 g/mL</small>
                                        </div>
                                        <div className="col-md-4 mb-3">
                                            <label className="form-label">Unit *</label>
                                            <select
                                                className="form-select"
                                                value={formData.unit}
                                                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                                required
                                            >
                                                <option value="g/mL">g/mL</option>
                                                <option value="kg/L">kg/L</option>
                                            </select>
                                        </div>
                                    </div>
                                    {formData.value && (
                                        <div className={`alert alert-${getDensityStatus(parseFloat(formData.value)).color}`}>
                                            <div className="d-flex align-items-center gap-2">
                                                <span style={{ fontSize: '1.5rem' }}>
                                                    {getDensityStatus(parseFloat(formData.value)).icon}
                                                </span>
                                                <div>
                                                    <strong>{getDensityStatus(parseFloat(formData.value)).label}</strong> density syrup
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

export default SyrupDensities;
