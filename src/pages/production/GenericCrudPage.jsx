import React, { useState, useEffect } from 'react';

const GenericCrudPage = ({
    title,
    columns,
    api,
    formFields,
    transformPayload,
    onAdd,
    onEdit,
    onView,
    filters = [],
    searchPlaceholder,
    showStats = false
}) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [formData, setFormData] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [params, setParams] = useState({
        search: '',
        ...filters.reduce((acc, f) => ({ ...acc, [f.name]: '' }), {})
    });
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(15);
    const [totalCount, setTotalCount] = useState(0);
    const [paginationLinks, setPaginationLinks] = useState({ next: null, previous: null });
    const [stats, setStats] = useState({ total: 0, active: 0 });

    const fetchData = async () => {
        setLoading(true);
        try {
            const apiParams = { page: currentPage, page_size: pageSize, ...params };
            const res = await api.list(apiParams);
            const responseData = res.data;
            let listData = [];
            let count = 0;
            let next = null;
            let previous = null;

            if (Array.isArray(responseData)) {
                listData = responseData;
                count = responseData.length;
            } else if (responseData.results && Array.isArray(responseData.results)) {
                listData = responseData.results;
                count = responseData.count || responseData.results.length;
                next = responseData.next;
                previous = responseData.previous;
            } else if (responseData.data && Array.isArray(responseData.data)) {
                listData = responseData.data;
                count = responseData.count || responseData.total || responseData.data.length;
                next = responseData.next;
                previous = responseData.previous;
            } else if (responseData.data?.results && Array.isArray(responseData.data.results)) {
                listData = responseData.data.results;
                count = responseData.data.count || responseData.data.results.length;
                next = responseData.data.next;
                previous = responseData.data.previous;
            }

            setData(listData);
            setTotalCount(count);
            setPaginationLinks({ next, previous });
            
            if (showStats) {
                setStats({
                    total: count,
                    active: listData.length
                });
            }
        } catch (err) {
            console.error("Failed to fetch data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setCurrentPage(1);
        setParams(prev => ({ ...prev, search: '' }));
    }, [title]);

    useEffect(() => {
        fetchData();
    }, [currentPage, title, params]);

    const handlePageChange = (newPage) => {
        if (newPage > 0) setCurrentPage(newPage);
    };

    const handleSearch = (e) => {
        setCurrentPage(1);
        setParams(prev => ({ ...prev, search: e.target.value }));
    };

    const handleCreate = () => {
        if (onAdd) {
            onAdd();
            return;
        }
        setCurrentItem(null);
        setFormData({});
        setError('');
        setIsModalOpen(true);
    };

    const handleEditInternal = (item) => {
        if (onEdit) {
            onEdit(item);
            return;
        }
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
        setDeleting(true);
        try {
            await api.delete(itemToDelete.id);
            setDeleteModalOpen(false);
            setItemToDelete(null);
            fetchData();
        } catch (err) {
            console.error("Failed to delete", err);
        } finally {
            setDeleting(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            const payload = transformPayload ? transformPayload(formData) : formData;
            console.log('Submitting payload:', payload);
            
            if (currentItem) {
                const response = await api.update(currentItem.id, payload);
                console.log('Update response:', response);
            } else {
                const response = await api.create(payload);
                console.log('Create response:', response);
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            console.error("Failed to save:", err);
            console.error("Error response:", err.response?.data);
            const errorMsg = err.response?.data?.message 
                || err.response?.data?.detail
                || Object.values(err.response?.data || {}).flat().join(', ')
                || err.message 
                || 'Failed to save';
            setError(errorMsg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const totalPages = Math.ceil(totalCount / pageSize);

    return (
        <>
            {/* Page Header */}
            <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2" style={{
                animation: 'fadeInDown 0.5s ease-out'
            }}>
                <h4 className="mb-0">{title}</h4>
                <button className="btn btn-primary" onClick={handleCreate}>
                    <i className="ti ti-plus me-2"></i>Add New
                </button>
            </div>

            {/* Stats Cards */}
            {showStats && (
                <div className="row row-gap-3 mb-4" style={{ animation: 'fadeInUp 0.6s ease-out 0.1s both' }}>
                    <div className="col-xl-3 col-sm-6">
                        <div className="card mb-0">
                            <div className="card-body">
                                <div className="d-flex align-items-start justify-content-between">
                                    <div>
                                        <p className="fs-14 mb-1">Total {title}</p>
                                        <h2 className="mb-1 fs-16">{loading ? '...' : stats.total}</h2>
                                    </div>
                                    <span className="avatar avatar-md rounded-circle bg-soft-primary border border-primary">
                                        <i className="ti ti-list fs-16 text-primary"></i>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="col-xl-3 col-sm-6">
                        <div className="card mb-0">
                            <div className="card-body">
                                <div className="d-flex align-items-start justify-content-between">
                                    <div>
                                        <p className="fs-14 mb-1">Active Records</p>
                                        <h2 className="mb-1 fs-16">{loading ? '...' : stats.active}</h2>
                                    </div>
                                    <span className="avatar avatar-md rounded-circle bg-soft-success border border-success">
                                        <i className="ti ti-circle-check fs-16 text-success"></i>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Card with Table */}
            <div className="card" style={{
                animation: 'fadeInUp 0.6s ease-out 0.1s both'
            }}>
                <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <h6 className="mb-0">All Records</h6>
                    <div className="d-flex align-items-center gap-2">
                        <div className="input-group" style={{ maxWidth: '300px' }}>
                            <span className="input-group-text"><i className="ti ti-search"></i></span>
                            <input
                                type="text"
                                className="form-control"
                                placeholder={searchPlaceholder || `Search ${title}...`}
                                value={params.search}
                                onChange={handleSearch}
                                style={{ transition: 'all 0.3s ease' }}
                            />
                        </div>
                        <button className="btn btn-icon btn-outline-light" onClick={fetchData} title="Refresh">
                            <i className={`ti ti-refresh${loading ? ' spin' : ''}`}></i>
                        </button>
                    </div>
                </div>
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    ) : data.length === 0 ? (
                        <div className="text-center py-5" style={{ animation: 'fadeIn 0.4s ease-out' }}>
                            <i className="ti ti-database-off fs-1 text-muted mb-3 d-block"></i>
                            <p className="text-muted mb-0">No records found</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead className="table-light">
                                    <tr>
                                        {columns.map((col) => (
                                            <th key={col.accessor || col.header}>{col.header}</th>
                                        ))}
                                        <th className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((row, idx) => (
                                        <tr key={row.id || idx} style={{
                                            animation: `fadeInUp 0.4s ease-out ${idx * 0.05}s both`
                                        }}>
                                            {columns.map((col) => (
                                                <td key={col.accessor || col.header}>
                                                    {col.render ? col.render(row) : row[col.accessor]}
                                                </td>
                                            ))}
                                            <td className="text-end">
                                                <div className="d-flex gap-2 justify-content-end">
                                                    {onView && (
                                                        <button
                                                            className="btn btn-sm btn-icon btn-outline-primary"
                                                            onClick={() => onView(row)}
                                                            title="View"
                                                            style={{ transition: 'all 0.2s ease' }}
                                                        >
                                                            <i className="ti ti-eye"></i>
                                                        </button>
                                                    )}
                                                    <button
                                                        className="btn btn-sm btn-icon btn-outline-info"
                                                        onClick={() => handleEditInternal(row)}
                                                        title="Edit"
                                                        style={{ transition: 'all 0.2s ease' }}
                                                    >
                                                        <i className="ti ti-edit"></i>
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-icon btn-outline-danger"
                                                        onClick={() => handleDelete(row)}
                                                        title="Delete"
                                                        style={{ transition: 'all 0.2s ease' }}
                                                    >
                                                        <i className="ti ti-trash"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                {totalPages > 1 && (
                    <div className="card-footer d-flex align-items-center justify-content-between">
                        <p className="mb-0 text-muted">
                            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} entries
                        </p>
                        <nav>
                            <ul className="pagination mb-0">
                                <li className={`page-item ${!paginationLinks.previous ? 'disabled' : ''}`}>
                                    <button className="page-link" onClick={() => handlePageChange(currentPage - 1)} disabled={!paginationLinks.previous}>
                                        <i className="ti ti-chevron-left"></i>
                                    </button>
                                </li>
                                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                    const pageNum = i + 1;
                                    return (
                                        <li key={pageNum} className={`page-item ${currentPage === pageNum ? 'active' : ''}`}>
                                            <button className="page-link" onClick={() => handlePageChange(pageNum)}>
                                                {pageNum}
                                            </button>
                                        </li>
                                    );
                                })}
                                <li className={`page-item ${!paginationLinks.next ? 'disabled' : ''}`}>
                                    <button className="page-link" onClick={() => handlePageChange(currentPage + 1)} disabled={!paginationLinks.next}>
                                        <i className="ti ti-chevron-right"></i>
                                    </button>
                                </li>
                            </ul>
                        </nav>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="modal fade show d-block" style={{ 
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    animation: 'fadeIn 0.2s ease-out'
                }} onClick={() => setIsModalOpen(false)}>
                    <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()} style={{
                        animation: 'zoomIn 0.3s ease-out'
                    }}>
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">{currentItem ? 'Edit Item' : 'Create New Item'}</h5>
                                <button type="button" className="btn-close" onClick={() => setIsModalOpen(false)}></button>
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="modal-body">
                                    {error && (
                                        <div className="alert alert-danger py-2 mb-3" role="alert">
                                            <i className="ti ti-alert-circle me-2"></i>
                                            {error}
                                        </div>
                                    )}
                                    {formFields.map((field, idx) => (
                                        <div key={field.name} className="mb-3" style={{
                                            animation: `fadeInUp 0.3s ease-out ${idx * 0.05}s both`
                                        }}>
                                            <label className="form-label">{field.label}</label>
                                            {field.type === 'select' ? (
                                                <select
                                                    className="form-select"
                                                    name={field.name}
                                                    value={formData[field.name] || ''}
                                                    onChange={handleChange}
                                                    required={field.required}
                                                    style={{ transition: 'all 0.3s ease' }}
                                                >
                                                    <option value="">Select...</option>
                                                    {(field.options || []).map((opt) => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    type={field.type || 'text'}
                                                    className="form-control"
                                                    name={field.name}
                                                    value={formData[field.name] || ''}
                                                    onChange={handleChange}
                                                    required={field.required}
                                                    placeholder={field.placeholder}
                                                    step={field.step}
                                                    style={{ transition: 'all 0.3s ease' }}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                                        {submitting ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2"></span>Saving...
                                            </>
                                        ) : (
                                            <>
                                                <i className="ti ti-check me-2"></i>Save
                                            </>
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
                <div className="modal fade show d-block" style={{ 
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    animation: 'fadeIn 0.2s ease-out'
                }} onClick={() => setDeleteModalOpen(false)}>
                    <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()} style={{
                        animation: 'shake 0.5s ease-out'
                    }}>
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Confirm Deletion</h5>
                                <button type="button" className="btn-close" onClick={() => setDeleteModalOpen(false)}></button>
                            </div>
                            <div className="modal-body">
                                <p className="mb-0">Are you sure you want to delete this item? This action cannot be undone.</p>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setDeleteModalOpen(false)}>Cancel</button>
                                <button type="button" className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>
                                    {deleting ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2"></span>Deleting...
                                        </>
                                    ) : (
                                        <>
                                            <i className="ti ti-trash me-2"></i>Delete
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default GenericCrudPage;
