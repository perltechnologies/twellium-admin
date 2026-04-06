import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, RefreshCw, Ruler, Package } from 'lucide-react';
import { productionApi } from '../../api/production';

const MeasuringUnits = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [formData, setFormData] = useState({ name: '', short_name: '', value: '' });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await productionApi.getMeasuringUnits({ page_size: 100 });
            const units = res.data?.data || res.data?.results || res.data || [];
            setData(units.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (err) {
            console.error('Failed to fetch units:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreate = () => {
        setCurrentItem(null);
        setFormData({ name: '', short_name: '', value: '' });
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
            await productionApi.deleteMeasuringUnit(itemToDelete.id);
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
                short_name: formData.short_name,
                value: parseFloat(formData.value)
            };

            if (currentItem) {
                await productionApi.updateMeasuringUnit(currentItem.id, payload);
            } else {
                await productionApi.createMeasuringUnit(payload);
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to save unit');
        } finally {
            setSubmitting(false);
        }
    };

    const getUnitIcon = (name) => {
        const n = name?.toLowerCase() || '';
        if (n.includes('kg') || n.includes('gram') || n.includes('weight')) return '⚖️';
        if (n.includes('liter') || n.includes('ml') || n.includes('volume')) return '🧪';
        if (n.includes('meter') || n.includes('cm') || n.includes('length')) return '📏';
        if (n.includes('piece') || n.includes('unit') || n.includes('count')) return '📦';
        return '📊';
    };

    const getCategoryColor = (name) => {
        const n = name?.toLowerCase() || '';
        if (n.includes('kg') || n.includes('gram')) return 'primary';
        if (n.includes('liter') || n.includes('ml')) return 'info';
        if (n.includes('meter') || n.includes('cm')) return 'warning';
        if (n.includes('piece') || n.includes('unit')) return 'success';
        return 'secondary';
    };

    return (
        <>
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h4 className="mb-1">Measuring Units</h4>
                    <p className="text-muted mb-0">Define and manage measurement units for production</p>
                </div>
                <button onClick={handleCreate} className="btn btn-primary shadow">
                    <Plus className="h-4 w-4 me-2" />
                    Add Unit
                </button>
            </div>

            {/* Stats */}
            <div className="row g-3 mb-4">
                <div className="col-md-6">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body">
                            <div className="d-flex align-items-center gap-3">
                                <div className="p-3 rounded bg-primary bg-opacity-10">
                                    <Ruler className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <div className="text-muted small">Total Units</div>
                                    <h4 className="mb-0">{data.length}</h4>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-md-6">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body">
                            <div className="d-flex align-items-center gap-3">
                                <div className="p-3 rounded bg-success bg-opacity-10">
                                    <Package className="h-5 w-5 text-success" />
                                </div>
                                <div>
                                    <div className="text-muted small">Categories</div>
                                    <h4 className="mb-0">
                                        {new Set(data.map(u => getCategoryColor(u.name))).size}
                                    </h4>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Units Grid */}
            <div className="row g-3 mb-4">
                {loading ? (
                    <div className="col-12 text-center py-5">
                        <div className="spinner-border"></div>
                    </div>
                ) : data.length === 0 ? (
                    <div className="col-12">
                        <div className="card border-0 shadow-sm">
                            <div className="card-body text-center py-5">
                                <div className="text-muted mb-3">No measuring units found</div>
                                <button onClick={handleCreate} className="btn btn-sm btn-primary">
                                    Create First Unit
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    data.map((unit) => (
                        <div key={unit.id} className="col-md-6 col-lg-4">
                            <div className="card border-0 shadow-sm h-100 hover-shadow">
                                <div className="card-body">
                                    <div className="d-flex align-items-start justify-content-between mb-3">
                                        <div className="d-flex align-items-center gap-2">
                                            <span style={{ fontSize: '2rem' }}>{getUnitIcon(unit.name)}</span>
                                            <div>
                                                <h6 className="mb-0">{unit.name}</h6>
                                                <span className={`badge bg-${getCategoryColor(unit.name)} bg-opacity-10 text-${getCategoryColor(unit.name)} mt-1`}>
                                                    {unit.short_name}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="d-flex align-items-center justify-content-between">
                                        <div>
                                            <div className="text-muted small">Value</div>
                                            <div className="h5 mb-0">{unit.value}</div>
                                        </div>
                                        <div className="btn-group btn-group-sm">
                                            <button
                                                onClick={() => handleEdit(unit)}
                                                className="btn btn-outline-primary"
                                                title="Edit"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(unit)}
                                                className="btn btn-outline-danger"
                                                title="Delete"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Table View */}
            <div className="card border-0 shadow-sm">
                <div className="card-header bg-light d-flex align-items-center justify-content-between">
                    <h6 className="mb-0">All Units</h6>
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
                                        <th style={{ width: '60px' }}>Icon</th>
                                        <th>Unit Name</th>
                                        <th>Short Name</th>
                                        <th className="text-end">Value</th>
                                        <th>Category</th>
                                        <th className="text-end" style={{ width: '120px' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((unit) => (
                                        <tr key={unit.id}>
                                            <td className="text-center" style={{ fontSize: '1.5rem' }}>
                                                {getUnitIcon(unit.name)}
                                            </td>
                                            <td className="fw-medium">{unit.name}</td>
                                            <td>
                                                <span className={`badge bg-${getCategoryColor(unit.name)} bg-opacity-10 text-${getCategoryColor(unit.name)}`}>
                                                    {unit.short_name}
                                                </span>
                                            </td>
                                            <td className="text-end">{unit.value}</td>
                                            <td>
                                                <span className={`badge bg-${getCategoryColor(unit.name)}`}>
                                                    {getCategoryColor(unit.name)}
                                                </span>
                                            </td>
                                            <td className="text-end">
                                                <button
                                                    onClick={() => handleEdit(unit)}
                                                    className="btn btn-sm btn-outline-primary me-1"
                                                    title="Edit"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(unit)}
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
                                    {currentItem ? 'Edit Unit' : 'Create New Unit'}
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
                                        <label className="form-label">Unit Name *</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                            placeholder="e.g., Kilogram, Liter, Meter"
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Short Name *</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={formData.short_name}
                                            onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
                                            required
                                            placeholder="e.g., kg, L, m"
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Value *</label>
                                        <input
                                            type="number"
                                            step="0.001"
                                            className="form-control"
                                            value={formData.value}
                                            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                            required
                                            placeholder="e.g., 1, 0.001, 1000"
                                        />
                                        <small className="text-muted">Base conversion value</small>
                                    </div>
                                    {formData.name && (
                                        <div className="alert alert-info mb-0">
                                            <div className="d-flex align-items-center gap-2">
                                                <span style={{ fontSize: '1.5rem' }}>{getUnitIcon(formData.name)}</span>
                                                <div>
                                                    <strong>{formData.name}</strong>
                                                    {formData.short_name && <span className="ms-2">({formData.short_name})</span>}
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

            <style jsx>{`
                .hover-shadow {
                    transition: all 0.3s ease;
                }
                .hover-shadow:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
                }
            `}</style>
        </>
    );
};

export default MeasuringUnits;
