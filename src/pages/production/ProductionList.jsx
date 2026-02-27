import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { productionApi } from '../../api/production';

const ProductionList = () => {
    const navigate = useNavigate();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        production_date: '',
        status: '',
        search: '',
        pet: '',
        page: 1,
        page_size: 15
    });
    const [totalCount, setTotalCount] = useState(0);
    const [paginationLinks, setPaginationLinks] = useState({ next: null, previous: null });
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [reportToDelete, setReportToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [pets, setPets] = useState([]);
    const [stats, setStats] = useState({
        totalReports: 0,
        completedReports: 0,
        totalOutput: 0,
        avgOutput: 0,
        activeLines: 0,
        totalStoppages: 0,
        totalDowntime: 0,
        approvalRate: 0
    });

    const fetchReports = async () => {
        setLoading(true);
        try {
            const params = {
                production_date: filters.production_date,
                status: filters.status,
                search: filters.search,
                pet: filters.pet,
                page: filters.page,
                page_size: filters.page_size
            };
            const res = await productionApi.getReports(params);
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

            setReports(listData);
            setTotalCount(count);
            setPaginationLinks({ next, previous });

            // Calculate stats
            const completed = listData.filter(r => r.status === 'COMPLETED' || r.status === 'APPROVED').length;
            const totalOutput = listData.reduce((sum, r) => sum + (r.total_bottles_produced || 0), 0);
            const approved = listData.filter(r => r.status === 'APPROVED').length;
            
            setStats({
                totalReports: count,
                completedReports: completed,
                totalOutput: totalOutput,
                avgOutput: listData.length > 0 ? Math.round(totalOutput / listData.length) : 0,
                activeLines: 0,
                totalStoppages: 0,
                totalDowntime: 0,
                approvalRate: listData.length > 0 ? Math.round((approved / listData.length) * 100) : 0
            });

            // Fetch additional stats
            const [petsRes, stoppagesRes] = await Promise.all([
                productionApi.getPets({ page_size: 100 }),
                productionApi.getStoppages({ page_size: 500 })
            ]);

            const petsData = Array.isArray(petsRes.data) ? petsRes.data : petsRes.data?.results || [];
            const stoppages = Array.isArray(stoppagesRes.data) ? stoppagesRes.data : stoppagesRes.data?.results || [];
            const totalDowntime = stoppages.reduce((sum, s) => sum + (s.downtime_minutes || s.duration || 0), 0);

            setPets(petsData);
            setStats(prev => ({
                ...prev,
                activeLines: petsData.length,
                totalStoppages: stoppages.length,
                totalDowntime: Math.round(totalDowntime)
            }));

        } catch (error) {
            console.error("Failed to fetch reports", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Debounce search
        const timeoutId = setTimeout(() => {
            fetchReports();
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [filters]);

    const handlePageChange = (newPage) => {
        setFilters(prev => ({ ...prev, page: newPage }));
    };

    const handleDelete = (item) => {
        setReportToDelete(item);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!reportToDelete) return;
        setDeleting(true);
        try {
            await productionApi.deleteReport(reportToDelete.id);
            setDeleteModalOpen(false);
            setReportToDelete(null);
            fetchReports();
        } catch (error) {
            console.error("Failed to delete report:", error);
        } finally {
            setDeleting(false);
        }
    };

    const handleView = (item) => {
        navigate(`/dashboard/production/${item.id}`);
    };

    const handleStatusChange = async (report, newStatus) => {
        try {
            await productionApi.updateStatus(report.id, newStatus);
            fetchReports(); // Refresh
        } catch (error) {
            console.error('Failed to update status', error);
        }
    };

    const handleSearch = (e) => {
        setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }));
    };

    const STATUS_BADGES = {
        STARTED: 'badge bg-soft-info text-info',
        COMPLETED: 'badge bg-soft-success text-success',
        APPROVED: 'badge bg-soft-purple text-purple',
        DECLINED: 'badge bg-soft-danger text-danger',
        INCOMPLETE: 'badge bg-soft-warning text-warning',
        IDLE: 'badge bg-soft-secondary text-secondary',
    };

    const totalPages = Math.ceil(totalCount / filters.page_size);

    return (
        <>
            {/* Page Header */}
            <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2" style={{
                animation: 'fadeInDown 0.5s ease-out'
            }}>
                <h4 className="mb-0">Production Reports</h4>
                <button className="btn btn-primary" onClick={() => navigate('/dashboard/production/new')}>
                    <i className="ti ti-plus me-2"></i>Create New Report
                </button>
            </div>

            {/* Top Filters - Date and PET */}
            <div className="card mb-4" style={{ animation: 'fadeInUp 0.5s ease-out 0.05s both' }}>
                <div className="card-body">
                    <div className="row g-3 align-items-end">
                        <div className="col-md-3">
                            <label className="form-label fw-medium">Production Date</label>
                            <input
                                type="date"
                                className="form-control"
                                value={filters.production_date}
                                onChange={(e) => setFilters(prev => ({ ...prev, production_date: e.target.value, page: 1 }))}
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
                            <button className="btn btn-primary w-100" onClick={fetchReports}>
                                <i className={`ti ti-filter${loading ? ' spin' : ''} me-2`}></i>Apply Filter
                            </button>
                        </div>
                        <div className="col-md-2">
                            <button 
                                className="btn btn-outline-secondary w-100" 
                                onClick={() => setFilters({ production_date: '', status: '', search: '', pet: '', page: 1, page_size: 15 })}
                            >
                                <i className="ti ti-x me-2"></i>Clear All
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards - Row 1 */}
            <div className="row row-gap-3 mb-4" style={{ animation: 'fadeInUp 0.6s ease-out 0.1s both' }}>
                <div className="col-xl-3 col-sm-6">
                    <div className="card mb-0">
                        <div className="card-body">
                            <div className="d-flex align-items-start justify-content-between">
                                <div>
                                    <p className="fs-14 mb-1">Total Reports</p>
                                    <h2 className="mb-1 fs-16">{loading ? '...' : stats.totalReports}</h2>
                                </div>
                                <span className="avatar avatar-md rounded-circle bg-soft-primary border border-primary">
                                    <i className="ti ti-file-report fs-16 text-primary"></i>
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
                                    <p className="fs-14 mb-1">Completed</p>
                                    <h2 className="mb-1 fs-16">{loading ? '...' : stats.completedReports}</h2>
                                </div>
                                <span className="avatar avatar-md rounded-circle bg-soft-success border border-success">
                                    <i className="ti ti-check fs-16 text-success"></i>
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
                                    <p className="fs-14 mb-1">Total Output</p>
                                    <h2 className="mb-1 fs-16">{loading ? '...' : stats.totalOutput.toLocaleString()}</h2>
                                </div>
                                <span className="avatar avatar-md rounded-circle bg-soft-info border border-info">
                                    <i className="ti ti-bottle fs-16 text-info"></i>
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
                                    <p className="fs-14 mb-1">Avg Output</p>
                                    <h2 className="mb-1 fs-16">{loading ? '...' : stats.avgOutput.toLocaleString()}</h2>
                                </div>
                                <span className="avatar avatar-md rounded-circle bg-soft-warning border border-warning">
                                    <i className="ti ti-chart-line fs-16 text-warning"></i>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards - Row 2 */}
            <div className="row row-gap-3 mb-4" style={{ animation: 'fadeInUp 0.6s ease-out 0.15s both' }}>
                <div className="col-xl-3 col-sm-6">
                    <div className="card mb-0">
                        <div className="card-body">
                            <div className="d-flex align-items-start justify-content-between">
                                <div>
                                    <p className="fs-14 mb-1">Active PET Lines</p>
                                    <h2 className="mb-1 fs-16">{loading ? '...' : stats.activeLines}</h2>
                                </div>
                                <span className="avatar avatar-md rounded-circle bg-soft-success border border-success">
                                    <i className="ti ti-building-factory-2 fs-16 text-success"></i>
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
                                    <p className="fs-14 mb-1">Approval Rate</p>
                                    <h2 className="mb-1 fs-16">{loading ? '...' : `${stats.approvalRate}%`}</h2>
                                </div>
                                <span className="avatar avatar-md rounded-circle bg-soft-purple border border-purple">
                                    <i className="ti ti-thumb-up fs-16 text-purple"></i>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Additional Filters */}
            <div className="card mb-4" style={{ animation: 'fadeInUp 0.6s ease-out 0.2s both' }}>
                <div className="card-body">
                    <div className="row g-3">
                        <div className="col-md-5">
                            <label className="form-label">Search</label>
                            <div className="input-group">
                                <span className="input-group-text"><i className="ti ti-search"></i></span>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Search by report code..."
                                    value={filters.search}
                                    onChange={handleSearch}
                                />
                            </div>
                        </div>
                        <div className="col-md-3">
                            <label className="form-label">Status</label>
                            <select
                                className="form-select"
                                value={filters.status}
                                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
                            >
                                <option value="">All Statuses</option>
                                {['STARTED', 'COMPLETED', 'APPROVED', 'DECLINED', 'INCOMPLETE', 'IDLE'].map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-2 d-flex align-items-end">
                            <button className="btn btn-outline-secondary w-100" onClick={fetchReports}>
                                <i className={`ti ti-refresh${loading ? ' spin' : ''} me-2`}></i>Refresh
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table Card */}
            <div className="card" style={{ animation: 'fadeInUp 0.6s ease-out 0.2s both' }}>
                <div className="card-header d-flex align-items-center justify-content-between">
                    <h6 className="mb-0">All Reports ({totalCount})</h6>
                </div>
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="text-center py-5">
                            <i className="ti ti-file-off fs-1 text-muted mb-3 d-block"></i>
                            <p className="text-muted mb-0">No reports found</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th>Code</th>
                                        <th>Date</th>
                                        <th>PET Line</th>
                                        <th>Shift</th>
                                        <th>Output</th>
                                        <th>Packs/Pallet</th>
                                        <th>Status</th>
                                        <th className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reports.map((row, idx) => (
                                        <tr key={row.id} style={{
                                            animation: `fadeInUp 0.4s ease-out ${idx * 0.05}s both`,
                                            cursor: 'pointer'
                                        }} onClick={() => navigate(`/dashboard/production/${row.id}`)}>
                                            <td>
                                                <div className="d-flex align-items-center gap-2">
                                                    <span className="avatar avatar-sm bg-soft-primary text-primary">
                                                        <i className="ti ti-file-text"></i>
                                                    </span>
                                                    <span className="fw-medium">{row.report_code}</span>
                                                </div>
                                            </td>
                                            <td>{format(new Date(row.production_date), 'MMM dd, yyyy')}</td>
                                            <td>{row.pet_name || '-'}</td>
                                            <td>
                                                <span className="badge bg-light text-dark border">
                                                    {row.shift_name}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="text-success fw-medium">
                                                    <i className="ti ti-trending-up me-1"></i>
                                                    {row.total_bottles_produced?.toLocaleString() || 0}
                                                </span>
                                            </td>
                                            <td>{row.packs_per_pallet || '-'}</td>
                                            <td onClick={(e) => e.stopPropagation()}>
                                                <select
                                                    value={row.status || 'STARTED'}
                                                    onChange={(e) => handleStatusChange(row, e.target.value)}
                                                    className={`form-select form-select-sm ${STATUS_BADGES[row.status || 'STARTED']}`}
                                                    style={{ width: 'auto', cursor: 'pointer' }}
                                                >
                                                    {['STARTED', 'COMPLETED', 'APPROVED', 'DECLINED', 'INCOMPLETE', 'IDLE'].map(s => (
                                                        <option key={s} value={s}>{s}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="text-end" onClick={(e) => e.stopPropagation()}>
                                                <div className="d-flex gap-2 justify-content-end">
                                                    <button
                                                        className="btn btn-sm btn-icon btn-outline-primary"
                                                        onClick={() => navigate(`/dashboard/production/${row.id}`)}
                                                        title="View"
                                                    >
                                                        <i className="ti ti-eye"></i>
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-icon btn-outline-info"
                                                        onClick={() => navigate(`/dashboard/production/${row.id}/edit`)}
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
                                <h5 className="modal-title">Delete Report</h5>
                                <button type="button" className="btn-close" onClick={() => setDeleteModalOpen(false)}></button>
                            </div>
                            <div className="modal-body">
                                <p className="mb-0">Are you sure you want to delete this report? This action cannot be undone.</p>
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
                                            <i className="ti ti-trash me-2"></i>Delete Report
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

export default ProductionList;
