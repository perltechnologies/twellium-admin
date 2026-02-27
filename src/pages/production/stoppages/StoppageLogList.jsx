import React from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { productionApi } from '../../../api/production';

const StoppageLogList = () => {
    const navigate = useNavigate();
    const [stoppages, setStoppages] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [filters, setFilters] = React.useState({
        log_date: '',
        pet: '',
        search: '',
        page: 1,
        page_size: 15
    });
    const [pets, setPets] = React.useState([]);
    const [totalCount, setTotalCount] = React.useState(0);
    const [paginationLinks, setPaginationLinks] = React.useState({ next: null, previous: null });
    const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
    const [itemToDelete, setItemToDelete] = React.useState(null);
    const [deleting, setDeleting] = React.useState(false);
    const [stats, setStats] = React.useState({
        totalStoppages: 0,
        totalDowntime: 0,
        avgDowntime: 0,
        avgEfficiency: 0
    });

    const fetchStoppages = async () => {
        setLoading(true);
        try {
            const params = {
                log_date: filters.log_date,
                pet: filters.pet,
                search: filters.search,
                page: filters.page,
                page_size: filters.page_size
            };
            const res = await productionApi.getStoppages(params);
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

            setStoppages(listData);
            setTotalCount(count);
            setPaginationLinks({ next, previous });

            // Calculate stats
            const totalDowntime = listData.reduce((sum, s) => sum + (s.downtime_minutes || 0), 0);
            const avgEfficiency = listData.length > 0 
                ? listData.reduce((sum, s) => sum + (s.efficiency || 0), 0) / listData.length 
                : 0;

            setStats({
                totalStoppages: count,
                totalDowntime: Math.round(totalDowntime),
                avgDowntime: listData.length > 0 ? Math.round(totalDowntime / listData.length) : 0,
                avgEfficiency: Math.round(avgEfficiency)
            });
        } catch (error) {
            console.error("Failed to fetch stoppages", error);
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        const loadPets = async () => {
            try {
                const res = await productionApi.getPets({ page_size: 100 });
                const results = res.data.data || res.data.results || res.data || [];
                setPets(results);
            } catch (err) {
                console.error("Failed to load pets", err);
            }
        };
        loadPets();
    }, []);

    React.useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchStoppages();
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [filters]);

    const handlePageChange = (newPage) => {
        setFilters(prev => ({ ...prev, page: newPage }));
    };

    const handleSearch = (e) => {
        setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }));
    };

    const handleDelete = (item) => {
        setItemToDelete(item);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        setDeleting(true);
        try {
            await productionApi.deleteStoppage(itemToDelete.id);
            setDeleteModalOpen(false);
            setItemToDelete(null);
            fetchStoppages();
        } catch (error) {
            console.error("Failed to delete:", error);
        } finally {
            setDeleting(false);
        }
    };

    const totalPages = Math.ceil(totalCount / filters.page_size);

    return (
        <>
            {/* Page Header */}
            <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2" style={{
                animation: 'fadeInDown 0.5s ease-out'
            }}>
                <h4 className="mb-0">Stoppage Logs</h4>
                <button className="btn btn-primary" onClick={() => navigate('/dashboard/production/stoppages/new')}>
                    <i className="ti ti-plus me-2"></i>Create New Stoppage
                </button>
            </div>

            {/* Top Filters */}
            <div className="card mb-4" style={{ animation: 'fadeInUp 0.5s ease-out 0.05s both' }}>
                <div className="card-body">
                    <div className="row g-3 align-items-end">
                        <div className="col-md-3">
                            <label className="form-label fw-medium">Date</label>
                            <input
                                type="date"
                                className="form-control"
                                value={filters.log_date}
                                onChange={(e) => setFilters(prev => ({ ...prev, log_date: e.target.value, page: 1 }))}
                            />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label fw-medium">PET Line</label>
                            <select
                                className="form-select"
                                value={filters.pet}
                                onChange={(e) => setFilters(prev => ({ ...prev, pet: e.target.value, page: 1 }))}
                            >
                                <option value="">All Lines</option>
                                {pets.map(pet => (
                                    <option key={pet.id} value={pet.id}>{pet.pet_name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-2">
                            <button className="btn btn-primary w-100" onClick={fetchStoppages}>
                                <i className={`ti ti-filter${loading ? ' spin' : ''} me-2`}></i>Apply Filter
                            </button>
                        </div>
                        <div className="col-md-2">
                            <button 
                                className="btn btn-outline-secondary w-100" 
                                onClick={() => setFilters({ log_date: '', pet: '', search: '', page: 1, page_size: 15 })}
                            >
                                <i className="ti ti-x me-2"></i>Clear All
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="row row-gap-3 mb-4" style={{ animation: 'fadeInUp 0.6s ease-out 0.1s both' }}>
                <div className="col-xl-3 col-sm-6">
                    <div className="card mb-0">
                        <div className="card-body">
                            <div className="d-flex align-items-start justify-content-between">
                                <div>
                                    <p className="fs-14 mb-1">Total Stoppages</p>
                                    <h2 className="mb-1 fs-16">{loading ? '...' : stats.totalStoppages}</h2>
                                </div>
                                <span className="avatar avatar-md rounded-circle bg-soft-warning border border-warning">
                                    <i className="ti ti-alert-triangle fs-16 text-warning"></i>
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
                                    <p className="fs-14 mb-1">Total Downtime</p>
                                    <h2 className="mb-1 fs-16">{loading ? '...' : `${stats.totalDowntime} min`}</h2>
                                </div>
                                <span className="avatar avatar-md rounded-circle bg-soft-danger border border-danger">
                                    <i className="ti ti-clock-pause fs-16 text-danger"></i>
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
                                    <p className="fs-14 mb-1">Avg Downtime</p>
                                    <h2 className="mb-1 fs-16">{loading ? '...' : `${stats.avgDowntime} min`}</h2>
                                </div>
                                <span className="avatar avatar-md rounded-circle bg-soft-info border border-info">
                                    <i className="ti ti-clock fs-16 text-info"></i>
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
                                    <p className="fs-14 mb-1">Avg Efficiency</p>
                                    <h2 className="mb-1 fs-16">{loading ? '...' : `${stats.avgEfficiency}%`}</h2>
                                </div>
                                <span className="avatar avatar-md rounded-circle bg-soft-success border border-success">
                                    <i className="ti ti-chart-line fs-16 text-success"></i>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="card mb-4" style={{ animation: 'fadeInUp 0.6s ease-out 0.15s both' }}>
                <div className="card-body">
                    <div className="row g-3">
                        <div className="col-md-6">
                            <label className="form-label">Search</label>
                            <div className="input-group">
                                <span className="input-group-text"><i className="ti ti-search"></i></span>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Search stoppage logs..."
                                    value={filters.search}
                                    onChange={handleSearch}
                                />
                            </div>
                        </div>
                        <div className="col-md-2 d-flex align-items-end">
                            <button className="btn btn-outline-secondary w-100" onClick={fetchStoppages}>
                                <i className={`ti ti-refresh${loading ? ' spin' : ''} me-2`}></i>Refresh
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table Card */}
            <div className="card" style={{ animation: 'fadeInUp 0.6s ease-out 0.2s both' }}>
                <div className="card-header d-flex align-items-center justify-content-between">
                    <h6 className="mb-0">All Stoppages ({totalCount})</h6>
                </div>
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    ) : stoppages.length === 0 ? (
                        <div className="text-center py-5">
                            <i className="ti ti-alert-circle-off fs-1 text-muted mb-3 d-block"></i>
                            <p className="text-muted mb-0">No stoppages found</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th>Date & Time</th>
                                        <th>Report Code</th>
                                        <th>PET Line</th>
                                        <th>Hour</th>
                                        <th>Efficiency</th>
                                        <th>Downtime</th>
                                        <th>Output</th>
                                        <th className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stoppages.map((row, idx) => (
                                        <tr key={row.id} style={{
                                            animation: `fadeInUp 0.4s ease-out ${idx * 0.05}s both`,
                                            cursor: 'pointer'
                                        }} onClick={() => navigate(`/dashboard/production/stoppages/${row.id}`)}>
                                            <td>
                                                <div>
                                                    <div className="fw-medium">{format(new Date(row.log_date), 'MMM dd, yyyy')}</div>
                                                    <small className="text-muted">{row.log_time ? format(new Date(`2000-01-01T${row.log_time}`), 'hh:mm a') : '-'}</small>
                                                </div>
                                            </td>
                                            <td><span className="badge bg-soft-primary text-primary">{row.report_code}</span></td>
                                            <td>{row.pet_name}</td>
                                            <td>Hour {row.hour_index}</td>
                                            <td>
                                                <span className="text-info">
                                                    <i className="ti ti-activity me-1"></i>{row.efficiency}%
                                                </span>
                                            </td>
                                            <td>
                                                <span className="text-warning">
                                                    <i className="ti ti-clock me-1"></i>{row.downtime_minutes} min
                                                </span>
                                            </td>
                                            <td>{row.bottles_produced?.toLocaleString()}</td>
                                            <td className="text-end" onClick={(e) => e.stopPropagation()}>
                                                <div className="d-flex gap-2 justify-content-end">
                                                    <button
                                                        className="btn btn-sm btn-icon btn-outline-primary"
                                                        onClick={() => navigate(`/dashboard/production/stoppages/${row.id}`)}
                                                        title="View"
                                                    >
                                                        <i className="ti ti-eye"></i>
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-icon btn-outline-info"
                                                        onClick={() => navigate(`/dashboard/production/stoppages/${row.id}/edit`)}
                                                        title="Edit"
                                                    >
                                                        <i className="ti ti-edit"></i>
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-icon btn-outline-danger"
                                                        onClick={() => handleDelete(row)}
                                                        title="Delete"
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
                            Showing {((filters.page - 1) * filters.page_size) + 1} to {Math.min(filters.page * filters.page_size, totalCount)} of {totalCount} entries
                        </p>
                        <nav>
                            <ul className="pagination mb-0">
                                <li className={`page-item ${!paginationLinks.previous ? 'disabled' : ''}`}>
                                    <button className="page-link" onClick={() => handlePageChange(filters.page - 1)} disabled={!paginationLinks.previous}>
                                        <i className="ti ti-chevron-left"></i>
                                    </button>
                                </li>
                                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                    const pageNum = i + 1;
                                    return (
                                        <li key={pageNum} className={`page-item ${filters.page === pageNum ? 'active' : ''}`}>
                                            <button className="page-link" onClick={() => handlePageChange(pageNum)}>
                                                {pageNum}
                                            </button>
                                        </li>
                                    );
                                })}
                                <li className={`page-item ${!paginationLinks.next ? 'disabled' : ''}`}>
                                    <button className="page-link" onClick={() => handlePageChange(filters.page + 1)} disabled={!paginationLinks.next}>
                                        <i className="ti ti-chevron-right"></i>
                                    </button>
                                </li>
                            </ul>
                        </nav>
                    </div>
                )}
            </div>

            {/* Delete Modal */}
            {deleteModalOpen && (
                <div className="modal fade show d-block" style={{ 
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    animation: 'fadeIn 0.2s ease-out'
                }} onClick={() => setDeleteModalOpen(false)}>
                    <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Delete Stoppage</h5>
                                <button type="button" className="btn-close" onClick={() => setDeleteModalOpen(false)}></button>
                            </div>
                            <div className="modal-body">
                                <p className="mb-0">Are you sure you want to delete this stoppage log? This action cannot be undone.</p>
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

export default StoppageLogList;
