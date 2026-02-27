import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usersApi } from '../../api/users';

const UserList = () => {
    const navigate = useNavigate();
    const [users, setUsers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [filters, setFilters] = React.useState({
        search: '',
        role: '',
        page: 1,
        page_size: 15
    });
    const [totalCount, setTotalCount] = React.useState(0);
    const [paginationLinks, setPaginationLinks] = React.useState({ next: null, previous: null });
    const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
    const [itemToDelete, setItemToDelete] = React.useState(null);
    const [deleting, setDeleting] = React.useState(false);
    const [stats, setStats] = React.useState({
        totalUsers: 0,
        adminCount: 0,
        managerCount: 0,
        userCount: 0
    });

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const params = {
                search: filters.search,
                role: filters.role,
                page: filters.page,
                page_size: filters.page_size
            };
            const res = await usersApi.getUsers(params);
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

            setUsers(listData);
            setTotalCount(count);
            setPaginationLinks({ next, previous });

            // Calculate stats by role
            const adminCount = listData.filter(u => u.role?.toLowerCase() === 'admin').length;
            const managerCount = listData.filter(u => u.role?.toLowerCase() === 'manager').length;
            const userCount = listData.filter(u => u.role?.toLowerCase() === 'user').length;

            setStats({
                totalUsers: count,
                adminCount,
                managerCount,
                userCount
            });
        } catch (error) {
            console.error("Failed to fetch users", error);
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchUsers();
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
            await usersApi.deleteUser(itemToDelete.id);
            setDeleteModalOpen(false);
            setItemToDelete(null);
            fetchUsers();
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
                <h4 className="mb-0">User Management</h4>
                <button className="btn btn-primary" onClick={() => navigate('/dashboard/users/new')}>
                    <i className="ti ti-plus me-2"></i>Add New User
                </button>
            </div>

            {/* Stats Cards */}
            <div className="row row-gap-3 mb-4" style={{ animation: 'fadeInUp 0.6s ease-out 0.1s both' }}>
                <div className="col-xl-3 col-sm-6">
                    <div className="card mb-0">
                        <div className="card-body">
                            <div className="d-flex align-items-start justify-content-between">
                                <div>
                                    <p className="fs-14 mb-1">Total Users</p>
                                    <h2 className="mb-1 fs-16">{loading ? '...' : stats.totalUsers}</h2>
                                </div>
                                <span className="avatar avatar-md rounded-circle bg-soft-primary border border-primary">
                                    <i className="ti ti-users fs-16 text-primary"></i>
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
                                    <p className="fs-14 mb-1">Admins</p>
                                    <h2 className="mb-1 fs-16">{loading ? '...' : stats.adminCount}</h2>
                                </div>
                                <span className="avatar avatar-md rounded-circle bg-soft-danger border border-danger">
                                    <i className="ti ti-shield-check fs-16 text-danger"></i>
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
                                    <p className="fs-14 mb-1">Managers</p>
                                    <h2 className="mb-1 fs-16">{loading ? '...' : stats.managerCount}</h2>
                                </div>
                                <span className="avatar avatar-md rounded-circle bg-soft-warning border border-warning">
                                    <i className="ti ti-user-star fs-16 text-warning"></i>
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
                                    <p className="fs-14 mb-1">Users</p>
                                    <h2 className="mb-1 fs-16">{loading ? '...' : stats.userCount}</h2>
                                </div>
                                <span className="avatar avatar-md rounded-circle bg-soft-success border border-success">
                                    <i className="ti ti-user fs-16 text-success"></i>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="card mb-4" style={{ animation: 'fadeInUp 0.6s ease-out 0.15s both' }}>
                <div className="card-body">
                    <div className="row g-3">
                        <div className="col-md-5">
                            <label className="form-label">Search</label>
                            <div className="input-group">
                                <span className="input-group-text"><i className="ti ti-search"></i></span>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Search by username, name, or email..."
                                    value={filters.search}
                                    onChange={handleSearch}
                                />
                            </div>
                        </div>
                        <div className="col-md-3">
                            <label className="form-label">Role</label>
                            <select
                                className="form-select"
                                value={filters.role}
                                onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value, page: 1 }))}
                            >
                                <option value="">All Roles</option>
                                <option value="admin">Admin</option>
                                <option value="manager">Manager</option>
                                <option value="user">User</option>
                            </select>
                        </div>
                        <div className="col-md-2 d-flex align-items-end">
                            <button className="btn btn-outline-secondary w-100" onClick={fetchUsers}>
                                <i className={`ti ti-refresh${loading ? ' spin' : ''} me-2`}></i>Refresh
                            </button>
                        </div>
                        <div className="col-md-2 d-flex align-items-end">
                            <button 
                                className="btn btn-outline-danger w-100" 
                                onClick={() => setFilters({ search: '', role: '', page: 1, page_size: 15 })}
                            >
                                <i className="ti ti-x me-2"></i>Clear
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table Card */}
            <div className="card" style={{ animation: 'fadeInUp 0.6s ease-out 0.2s both' }}>
                <div className="card-header d-flex align-items-center justify-content-between">
                    <h6 className="mb-0">All Users ({totalCount})</h6>
                </div>
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-5">
                            <i className="ti ti-user-off fs-1 text-muted mb-3 d-block"></i>
                            <p className="text-muted mb-0">No users found</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th>ID</th>
                                        <th>Username</th>
                                        <th>Full Name</th>
                                        <th>Email</th>
                                        <th>Role</th>
                                        <th>Company</th>
                                        <th className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((row, idx) => (
                                        <tr key={row.id} style={{
                                            animation: `fadeInUp 0.4s ease-out ${idx * 0.05}s both`
                                        }}>
                                            <td>{row.id}</td>
                                            <td><span className="fw-medium">{row.username}</span></td>
                                            <td>{row.full_name}</td>
                                            <td>{row.email}</td>
                                            <td>
                                                <span className={`badge ${
                                                    row.role?.toLowerCase() === 'admin' ? 'bg-soft-danger text-danger' :
                                                    row.role?.toLowerCase() === 'manager' ? 'bg-soft-warning text-warning' :
                                                    'bg-soft-success text-success'
                                                }`}>
                                                    {row.role}
                                                </span>
                                            </td>
                                            <td>{row.company_name || '-'}</td>
                                            <td className="text-end">
                                                <div className="d-flex gap-2 justify-content-end">
                                                    <button
                                                        className="btn btn-sm btn-icon btn-outline-info"
                                                        onClick={() => navigate(`/dashboard/users/${row.id}/edit`)}
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
                                <h5 className="modal-title">Delete User</h5>
                                <button type="button" className="btn-close" onClick={() => setDeleteModalOpen(false)}></button>
                            </div>
                            <div className="modal-body">
                                <p className="mb-0">Are you sure you want to delete this user? This action cannot be undone.</p>
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

export default UserList;
