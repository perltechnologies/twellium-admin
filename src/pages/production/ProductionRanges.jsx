import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, RefreshCw, TrendingUp, BarChart3 } from 'lucide-react';
import { productionApi } from '../../api/production';

const ProductionRanges = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [formData, setFormData] = useState({ name: '', start_value: '', end_value: '' });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await productionApi.getProductionRanges({ page_size: 100 });
            const ranges = res.data?.data || res.data?.results || res.data || [];
            setData(ranges.sort((a, b) => a.start_value - b.start_value));
        } catch (err) {
            console.error('Failed to fetch ranges:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreate = () => {
        setCurrentItem(null);
        setFormData({ name: '', start_value: '', end_value: '' });
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
            await productionApi.deleteProductionRange(itemToDelete.id);
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
                start_value: parseFloat(formData.start_value),
                end_value: parseFloat(formData.end_value)
            };

            if (currentItem) {
                await productionApi.updateProductionRange(currentItem.id, payload);
            } else {
                await productionApi.createProductionRange(payload);
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to save range');
        } finally {
            setSubmitting(false);
        }
    };

    const getRangeColor = (index) => {
        const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
        return colors[index % colors.length];
    };

    const getRangeWidth = (range) => {
        if (!data.length) return 0;
        const min = Math.min(...data.map(r => r.start_value));
        const max = Math.max(...data.map(r => r.end_value));
        const total = max - min;
        return ((range.end_value - range.start_value) / total) * 100;
    };

    return (
        <>
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h4 className="mb-1">Production Ranges</h4>
                    <p className="text-muted mb-0">Define and manage production output ranges</p>
                </div>
                <button onClick={handleCreate} className="btn btn-primary shadow">
                    <Plus className="h-4 w-4 me-2" />
                    Add Range
                </button>
            </div>

            {/* Stats */}
            <div className="row g-3 mb-4">
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body">
                            <div className="d-flex align-items-center gap-3">
                                <div className="p-3 rounded bg-primary bg-opacity-10">
                                    <BarChart3 className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <div className="text-muted small">Total Ranges</div>
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
                                    <TrendingUp className="h-5 w-5 text-success" />
                                </div>
                                <div>
                                    <div className="text-muted small">Min Value</div>
                                    <h4 className="mb-0">
                                        {data.length ? Math.min(...data.map(r => r.start_value)).toLocaleString() : 0}
                                    </h4>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body">
                            <div className="d-flex align-items-center gap-3">
                                <div className="p-3 rounded bg-warning bg-opacity-10">
                                    <TrendingUp className="h-5 w-5 text-warning" />
                                </div>
                                <div>
                                    <div className="text-muted small">Max Value</div>
                                    <h4 className="mb-0">
                                        {data.length ? Math.max(...data.map(r => r.end_value)).toLocaleString() : 0}
                                    </h4>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Visual Range Display */}
            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-light">
                    <h6 className="mb-0">Range Visualization</h6>
                </div>
                <div className="card-body">
                    {loading ? (
                        <div className="text-center py-4">
                            <div className="spinner-border spinner-border-sm"></div>
                        </div>
                    ) : data.length === 0 ? (
                        <div className="text-center text-muted py-4">No ranges defined</div>
                    ) : (
                        <div className="vstack gap-3">
                            {data.map((range, idx) => (
                                <div key={range.id}>
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        <span className="fw-medium">{range.name}</span>
                                        <span className="text-muted small">
                                            {range.start_value.toLocaleString()} - {range.end_value.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="progress" style={{ height: '24px' }}>
                                        <div
                                            className="progress-bar"
                                            style={{
                                                width: `${getRangeWidth(range)}%`,
                                                backgroundColor: getRangeColor(idx)
                                            }}
                                        >
                                            <span className="small fw-medium">
                                                {(range.end_value - range.start_value).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="card border-0 shadow-sm">
                <div className="card-header bg-light d-flex align-items-center justify-content-between">
                    <h6 className="mb-0">All Ranges</h6>
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
                            <p className="mb-2">No production ranges found</p>
                            <button onClick={handleCreate} className="btn btn-sm btn-primary">
                                Create First Range
                            </button>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th style={{ width: '40px' }}>#</th>
                                        <th>Range Name</th>
                                        <th className="text-end">Start Value</th>
                                        <th className="text-end">End Value</th>
                                        <th className="text-end">Span</th>
                                        <th className="text-end" style={{ width: '120px' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((range, idx) => (
                                        <tr key={range.id}>
                                            <td>
                                                <div
                                                    className="rounded-circle d-inline-block"
                                                    style={{
                                                        width: '24px',
                                                        height: '24px',
                                                        backgroundColor: getRangeColor(idx)
                                                    }}
                                                ></div>
                                            </td>
                                            <td className="fw-medium">{range.name}</td>
                                            <td className="text-end">{range.start_value.toLocaleString()}</td>
                                            <td className="text-end">{range.end_value.toLocaleString()}</td>
                                            <td className="text-end">
                                                <span className="badge bg-light text-dark">
                                                    {(range.end_value - range.start_value).toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="text-end">
                                                <button
                                                    onClick={() => handleEdit(range)}
                                                    className="btn btn-sm btn-outline-primary me-1"
                                                    title="Edit"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(range)}
                                                    className="btn btn-sm btn-outline-danger"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
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
                                    {currentItem ? 'Edit Range' : 'Create New Range'}
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
                                        <label className="form-label">Range Name *</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                            placeholder="e.g., Low, Medium, High"
                                        />
                                    </div>
                                    <div className="row">
                                        <div className="col-md-6 mb-3">
                                            <label className="form-label">Start Value *</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="form-control"
                                                value={formData.start_value}
                                                onChange={(e) => setFormData({ ...formData, start_value: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="col-md-6 mb-3">
                                            <label className="form-label">End Value *</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="form-control"
                                                value={formData.end_value}
                                                onChange={(e) => setFormData({ ...formData, end_value: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>
                                    {formData.start_value && formData.end_value && (
                                        <div className="alert alert-info mb-0">
                                            <small>
                                                Range span: <strong>{(parseFloat(formData.end_value) - parseFloat(formData.start_value)).toLocaleString()}</strong>
                                            </small>
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
                                <p>Are you sure you want to delete the range <strong>{itemToDelete?.name}</strong>?</p>
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

export default ProductionRanges;
