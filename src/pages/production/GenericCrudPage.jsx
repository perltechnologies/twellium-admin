import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Plus, Edit, Trash2, Eye, X, AlertCircle, CheckCircle, List } from 'lucide-react';
import { Button, Card, CardHeader, CardBody, Badge } from '../../components/ui';

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
    showStats = false,
    subtitle,
    createButtonLabel = 'Add New',
    tableTitle = 'All Records',
    emptyStateTitle = 'No records found',
    emptyStateDescription = 'Try adjusting your search and add a new item.',
    showActionsOnHover = false
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
            <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-3 animate__animated animate__fadeInDown">
                <div>
                    <h4 className="mb-1 text-slate-900 dark:text-white">{title}</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-0">{subtitle || `Manage ${title.toLowerCase()}`}</p>
                </div>
                <Button onClick={handleCreate} variant="primary" className="shadow-lg hover:shadow-xl">
                    <Plus className="h-4 w-4" />
                    <span>{createButtonLabel}</span>
                </Button>
            </div>

            {/* Stats Cards */}
            {showStats && (
                <div className="row row-gap-3 mb-4 animate__animated animate__fadeInUp">
                    <div className="col-xl-3 col-sm-6">
                        <Card hover className="h-100">
                            <CardBody>
                                <div className="d-flex align-items-start justify-content-between">
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total {title}</p>
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-0">
                                            {loading ? <span className="animate-pulse">...</span> : stats.total}
                                        </h2>
                                    </div>
                                    <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/20">
                                        <List className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </div>
                    <div className="col-xl-3 col-sm-6">
                        <Card hover className="h-100">
                            <CardBody>
                                <div className="d-flex align-items-start justify-content-between">
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Active Records</p>
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-0">
                                            {loading ? <span className="animate-pulse">...</span> : stats.active}
                                        </h2>
                                    </div>
                                    <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/20">
                                        <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </div>
                </div>
            )}

            {/* Card with Table */}
            <Card className="animate__animated animate__fadeInUp">
                <CardHeader>
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 w-100">
                        <h6 className="mb-0">{tableTitle}</h6>
                        <div className="d-flex align-items-center gap-2">
                            <div className="input-group" style={{ maxWidth: '300px' }}>
                                <span className="input-group-text bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                    <Search className="h-4 w-4 text-slate-400" />
                                </span>
                                <input
                                    type="text"
                                    className="form-control border-slate-200 dark:border-slate-700"
                                    placeholder={searchPlaceholder || `Search ${title}...`}
                                    value={params.search}
                                    onChange={handleSearch}
                                />
                            </div>
                            <Button variant="secondary" className="btn-icon" onClick={fetchData} title="Refresh">
                                <RefreshCw className={`h-4 w-4${loading ? ' spin' : ''}`} />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardBody className="p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    ) : data.length === 0 ? (
                        <div className="text-center py-5">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                <AlertCircle className="h-8 w-8 text-slate-400" />
                            </div>
                            <p className="text-slate-700 dark:text-slate-300 mb-1 fw-medium">{emptyStateTitle}</p>
                            <p className="text-slate-500 dark:text-slate-400 mb-0 text-sm">{emptyStateDescription}</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead className="bg-slate-50 dark:bg-slate-800/50">
                                    <tr>
                                        {columns.map((col) => (
                                            <th key={col.accessor || col.header} className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                                {col.header}
                                            </th>
                                        ))}
                                        <th className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {data.map((row, idx) => (
                                        <tr key={row.id || idx} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            {columns.map((col) => (
                                                <td key={col.accessor || col.header} className="text-slate-600 dark:text-slate-300">
                                                    {col.render ? col.render(row) : row[col.accessor]}
                                                </td>
                                            ))}
                                            <td className="text-end">
                                                <div className={`d-flex gap-2 justify-content-end ${showActionsOnHover ? 'actions-on-hover' : ''}`}>
                                                    {onView && (
                                                        <button
                                                            className="btn btn-sm btn-icon btn-outline-primary rounded-lg"
                                                            onClick={() => onView(row)}
                                                            title="View"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        className="btn btn-sm btn-icon btn-outline-info rounded-lg"
                                                        onClick={() => handleEditInternal(row)}
                                                        title="Edit"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-icon btn-outline-danger rounded-lg"
                                                        onClick={() => handleDelete(row)}
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardBody>
                {totalPages > 1 && (
                    <div className="card-footer d-flex align-items-center justify-content-between bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                        <p className="mb-0 text-sm text-slate-500 dark:text-slate-400">
                            Showing <span className="font-medium text-slate-700 dark:text-slate-300">{((currentPage - 1) * pageSize) + 1}</span> to <span className="font-medium text-slate-700 dark:text-slate-300">{Math.min(currentPage * pageSize, totalCount)}</span> of <span className="font-medium text-slate-700 dark:text-slate-300">{totalCount}</span> entries
                        </p>
                        <nav>
                            <ul className="pagination mb-0 gap-1">
                                <li className={`page-item ${!paginationLinks.previous ? 'disabled' : ''}`}>
                                    <button className="page-link rounded-lg" onClick={() => handlePageChange(currentPage - 1)} disabled={!paginationLinks.previous}>
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
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
                                    <button className="page-link rounded-lg" onClick={() => handlePageChange(currentPage + 1)} disabled={!paginationLinks.next}>
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    </button>
                                </li>
                            </ul>
                        </nav>
                    </div>
                )}
            </Card>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setIsModalOpen(false)}>
                    <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-content border-0 shadow-xl">
                            <div className="modal-header border-slate-200 dark:border-slate-700">
                                <h5 className="modal-title">{currentItem ? 'Edit Item' : 'Create New Item'}</h5>
                                <button type="button" className="btn-close" onClick={() => setIsModalOpen(false)}></button>
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="modal-body">
                                    {error && (
                                        <div className="alert alert-danger py-3 mb-3 d-flex align-items-center gap-3">
                                            <AlertCircle className="h-5 w-5 flex-shrink-0" />
                                            <span>{error}</span>
                                        </div>
                                    )}
                                    {formFields.map((field, idx) => (
                                        <div key={field.name} className="mb-3">
                                            <label className="form-label text-sm fw-medium">{field.label}</label>
                                            {field.type === 'select' ? (
                                                <select
                                                    className="form-select"
                                                    name={field.name}
                                                    value={formData[field.name] || ''}
                                                    onChange={handleChange}
                                                    required={field.required}
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
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="modal-footer border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                    <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                                    <Button type="submit" disabled={submitting}>
                                        {submitting ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2"></span>Saving...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                Save
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModalOpen && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setDeleteModalOpen(false)}>
                    <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-content border-0 shadow-xl">
                            <div className="modal-header border-slate-200 dark:border-slate-700">
                                <h5 className="modal-title">Confirm Deletion</h5>
                                <button type="button" className="btn-close" onClick={() => setDeleteModalOpen(false)}></button>
                            </div>
                            <div className="modal-body py-4">
                                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-3">
                                    <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
                                </div>
                                <p className="text-slate-600 dark:text-slate-300 mb-0">Are you sure you want to delete this item? This action cannot be undone.</p>
                            </div>
                            <div className="modal-footer border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                <Button variant="secondary" onClick={() => setDeleteModalOpen(false)}>Cancel</Button>
                                <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
                                    {deleting ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2"></span>Deleting...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default GenericCrudPage;
