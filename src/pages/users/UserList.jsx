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
        page_size: 10
    });
    const [totalCount, setTotalCount] = React.useState(0);
    const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
    const [itemToDelete, setItemToDelete] = React.useState(null);
    const [deleting, setDeleting] = React.useState(false);

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

            if (Array.isArray(responseData)) {
                listData = responseData;
                count = responseData.length;
            } else if (responseData.results) {
                listData = responseData.results;
                count = responseData.count || responseData.results.length;
            } else if (responseData.data) {
                listData = responseData.data.results || responseData.data;
                count = responseData.data.count || responseData.count || listData.length;
            }

            setUsers(listData);
            setTotalCount(count);
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
    const getRoleBadge = (role) => {
        const roleMap = {
            'ADMIN': 'danger',
            'SUPERVISOR': 'warning',
            'OPERATOR': 'primary',
            'QUALITY_CONTROL': 'info',
            'LOGISTICS_MANAGER': 'success'
        };
        return roleMap[role] || 'secondary';
    };

    return (
        <>
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h4 className="mb-1">User Management</h4>
                    <p className="text-muted mb-0">Manage system users and their permissions</p>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/dashboard/users/new')}>
                    <i className="ti ti-plus me-2"></i>
                    Add New User
                </button>
            </div>

            <div className="card mb-4">
                <div className="card-body">
                    <div className="row g-3">
                        <div className="col-md-6">
                            <label className="form-label">Search</label>
                            <div className="input-group">
                                <span className="input-group-text">
                                    <i className="ti ti-search"></i>
                                </span>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Search by username, name, or email..."
                                    value={filters.search}
                                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
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
                                <option value="ADMIN">Admin</option>
                                <option value="SUPERVISOR">Supervisor</option>
                                <option value="OPERATOR">Operator</option>
                                <option value="QUALITY_CONTROL">Quality Control</option>
                                <option value="LOGISTICS_MANAGER">Logistics Manager</option>
                            </select>
                        </div>
                        <div className="col-md-3 d-flex align-items-end gap-2">
                            <button className="btn btn-outline-secondary flex-fill" onClick={fetchUsers}>
                                <i className="ti ti-refresh me-2"></i>
                                Refresh
                            </button>
                            <button className="btn btn-outline-danger" onClick={() => setFilters({ search: '', role: '', page: 1, page_size: 10 })}>
                                <i className="ti ti-x"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header d-flex align-items-center justify-content-between">
                    <h6 className="mb-0">All Users ({totalCount})</h6>
                    <div className="text-muted small">
                        Page {filters.page} of {totalPages}
                    </div>
                </div>
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <span className="spinner-border text-primary" role="status"></span>
                            <p className="mt-3 text-muted">Loading users...</p>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-5">
                            <i className="ti ti-users" style={{ fontSize: '3rem', color: '#ccc' }}></i>
                            <p className="text-muted mt-3 mb-0">No users found</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th>Username</th>
                                        <th>Full Name</th>
                                        <th>Email</th>
                                        <th>Role</th>
                                        <th>Company</th>
                                        <th className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((row) => (
                                        <tr key={row.id}>
                                            <td className="fw-medium">{row.username}</td>
                                            <td>{row.full_name}</td>
                                            <td>{row.email}</td>
                                            <td>
                                                <span className={`badge bg-${getRoleBadge(row.role)}`}>
                                                    {row.role}
                                                </span>
                                            </td>
                                            <td>{row.company_name || '-'}</td>
                                            <td className="text-end">
                                                <div className="btn-group btn-group-sm">
                                                    <button
                                                        className="btn btn-outline-primary"
                                                        onClick={() => navigate(`/dashboard/users/${row.id}/edit`)}
                                                        title="Edit"
                                                    >
                                                        <i className="ti ti-edit"></i>
                                                    </button>
                                                    <button
                                                        className="btn btn-outline-danger"
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
                        <div className="text-muted small">
                            Showing {((filters.page - 1) * filters.page_size) + 1} to {Math.min(filters.page * filters.page_size, totalCount)} of {totalCount} entries
                        </div>
                        <nav>
                            <ul className="pagination pagination-sm mb-0">
                                <li className={`page-item ${filters.page === 1 ? 'disabled' : ''}`}>
                                    <button className="page-link" onClick={() => handlePageChange(filters.page - 1)} disabled={filters.page === 1}>
                                        <i className="ti ti-chevron-left"></i>
                                    </button>
                                </li>
                                {[...Array(totalPages)].map((_, i) => {
                                    const pageNum = i + 1;
                                    if (pageNum === 1 || pageNum === totalPages || (pageNum >= filters.page - 1 && pageNum <= filters.page + 1)) {
                                        return (
                                            <li key={pageNum} className={`page-item ${filters.page === pageNum ? 'active' : ''}`}>
                                                <button className="page-link" onClick={() => handlePageChange(pageNum)}>
                                                    {pageNum}
                                                </button>
                                            </li>
                                        );
                                    } else if (pageNum === filters.page - 2 || pageNum === filters.page + 2) {
                                        return <li key={pageNum} className="page-item disabled"><span className="page-link">...</span></li>;
                                    }
                                    return null;
                                })}
                                <li className={`page-item ${filters.page === totalPages ? 'disabled' : ''}`}>
                                    <button className="page-link" onClick={() => handlePageChange(filters.page + 1)} disabled={filters.page === totalPages}>
                                        <i className="ti ti-chevron-right"></i>
                                    </button>
                                </li>
                            </ul>
                        </nav>
                    </div>
                )}
            </div>

            {deleteModalOpen && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setDeleteModalOpen(false)}>
                    <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Delete User</h5>
                                <button type="button" className="btn-close" onClick={() => setDeleteModalOpen(false)}></button>
                            </div>
                            <div className="modal-body">
                                <div className="text-center mb-3">
                                    <i className="ti ti-alert-circle text-danger" style={{ fontSize: '3rem' }}></i>
                                </div>
                                <p className="text-center mb-0">Are you sure you want to delete user <strong>{itemToDelete?.username}</strong>? This action cannot be undone.</p>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={() => setDeleteModalOpen(false)}>Cancel</button>
                                <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>
                                    {deleting ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2"></span>Deleting...
                                        </>
                                    ) : (
                                        <>
                                            <i className="ti ti-trash me-2"></i>
                                            Delete
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
