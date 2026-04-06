import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, RefreshCw } from 'lucide-react';

const SimpleConfigPage = ({ 
    title, 
    description,
    api,
    columns,
    formFields,
    formatValue = (val) => val
}) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [formData, setFormData] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.list({ page_size: 100 });
            const items = res.data?.data || res.data?.results || res.data || [];
            setData(items);
        } catch (err) {
            console.error('Failed to fetch:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreate = () => {
        setCurrentItem(null);
        const initialData = {};
        formFields.forEach(f => initialData[f.name] = f.defaultValue || '');
        setFormData(initialData);
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
            await api.delete(itemToDelete.id);
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
            const payload = { ...formData };
            formFields.forEach(f => {
                if (f.type === 'number' && payload[f.name]) {
                    payload[f.name] = parseFloat(payload[f.name]);
                }
            });

            if (currentItem) {
                await api.update(currentItem.id, payload);
            } else {
                await api.create(payload);
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to save');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h4 className="mb-1">{title}</h4>
                    {description && <p className="text-muted mb-0 small">{description}</p>}
                </div>
                <button onClick={handleCreate} className="btn btn-primary btn-sm">
                    <Plus className="h-4 w-4 me-1" />
                    Add New
                </button>
            </div>

            <div className="card">
                <div className="card-header bg-white d-flex align-items-center justify-content-between">
                    <h6 className="mb-0">{data.length} {data.length === 1 ? 'Item' : 'Items'}</h6>
                    <button onClick={fetchData} className="btn btn-sm btn-light" disabled={loading}>
                        <RefreshCw className={`h-4 w-4${loading ? ' spin' : ''}`} />
                    </button>
                </div>
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border spinner-border-sm"></div>
                        </div>
                    ) : data.length === 0 ? (
                        <div className="text-center py-5 text-muted">
                            <p className="mb-2">No items found</p>
                            <button onClick={handleCreate} className="btn btn-sm btn-primary">
                                Create First Item
                            </button>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead className="table-light">
                                    <tr>
                                        {columns.map((col) => (
                                            <th key={col.accessor} className={col.align === 'right' ? 'text-end' : ''}>
                                                {col.header}
                                            </th>
                                        ))}
                                        <th className="text-end" style={{ width: '100px' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((item) => (
                                        <tr key={item.id}>
                                            {columns.map((col) => (
                                                <td key={col.accessor} className={col.align === 'right' ? 'text-end' : ''}>
                                                    {formatValue(item[col.accessor], col.accessor, item)}
                                                </td>
                                            ))}
                                            <td className="text-end">
                                                <button
                                                    onClick={() => handleEdit(item)}
                                                    className="btn btn-sm btn-light me-1"
                                                    title="Edit"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item)}
                                                    className="btn btn-sm btn-light text-danger"
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

            {/* Modal */}
            {isModalOpen && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">{currentItem ? 'Edit' : 'Create'} {title}</h5>
                                <button type="button" className="btn-close" onClick={() => setIsModalOpen(false)}></button>
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="modal-body">
                                    {error && <div className="alert alert-danger">{error}</div>}
                                    {formFields.map((field) => (
                                        <div key={field.name} className="mb-3">
                                            <label className="form-label">
                                                {field.label} {field.required && <span className="text-danger">*</span>}
                                            </label>
                                            {field.type === 'select' ? (
                                                <select
                                                    className="form-select"
                                                    value={formData[field.name] || ''}
                                                    onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                                                    required={field.required}
                                                >
                                                    <option value="">Select...</option>
                                                    {field.options?.map(opt => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    type={field.type || 'text'}
                                                    step={field.step}
                                                    className="form-control"
                                                    value={formData[field.name] || ''}
                                                    onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                                                    required={field.required}
                                                    placeholder={field.placeholder}
                                                />
                                            )}
                                            {field.help && <small className="text-muted">{field.help}</small>}
                                        </div>
                                    ))}
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                                        {submitting ? 'Saving...' : (currentItem ? 'Update' : 'Create')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {deleteModalOpen && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Confirm Delete</h5>
                                <button type="button" className="btn-close" onClick={() => setDeleteModalOpen(false)}></button>
                            </div>
                            <div className="modal-body">
                                <p>Are you sure you want to delete this item?</p>
                                <p className="text-muted mb-0">This action cannot be undone.</p>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setDeleteModalOpen(false)}>
                                    Cancel
                                </button>
                                <button type="button" className="btn btn-danger" onClick={confirmDelete}>
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

export default SimpleConfigPage;
