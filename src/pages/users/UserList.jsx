import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usersApi } from '../../api/users';
import { FALLBACK_BASE_ROLES } from './accessControlUtils';

const getInitials = (user) => {
    const source = (user.full_name || user.username || '?').trim();
    const parts = source.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
};

const UserList = ({ embedded = false, initialRole = '' }) => {
    const navigate = useNavigate();
    const [users, setUsers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [filters, setFilters] = React.useState({
        search: '',
        role: initialRole,
        page: 1,
        page_size: 10
    });
    const [totalCount, setTotalCount] = React.useState(0);
    const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
    const [itemToDelete, setItemToDelete] = React.useState(null);
    const [deleting, setDeleting] = React.useState(false);

    const fetchUsers = React.useCallback(async () => {
        setLoading(true);
        try {
            const requiresClientFiltering = Boolean(filters.role || filters.search.trim());
            const params = {
                page: requiresClientFiltering ? 1 : filters.page,
                page_size: requiresClientFiltering ? 1000 : filters.page_size
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

            if (requiresClientFiltering) {
                const searchTerm = filters.search.trim().toLowerCase();
                const filteredUsers = listData.filter((user) => {
                    const matchesRole = !filters.role || user.role === filters.role;
                    const searchableText = [user.username, user.full_name, user.email, user.company_name]
                        .filter(Boolean)
                        .join(' ')
                        .toLowerCase();
                    const matchesSearch = !searchTerm || searchableText.includes(searchTerm);
                    return matchesRole && matchesSearch;
                });
                count = filteredUsers.length;
                const startIndex = (filters.page - 1) * filters.page_size;
                listData = filteredUsers.slice(startIndex, startIndex + filters.page_size);
            }

            setUsers(listData);
            setTotalCount(count);
        } catch (error) {
            console.error("Failed to fetch users", error);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    React.useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchUsers();
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [fetchUsers]);

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

    const totalPages = Math.max(1, Math.ceil(totalCount / filters.page_size));
    const hasActiveFilters = Boolean(filters.search || filters.role);
    const getRoleBadge = (role) => {
        const roleMap = {
            'ADMIN': 'danger',
            'SUPERVISOR': 'warning',
            'OPERATOR': 'primary',
            'QUALITY_CONTROL': 'info',
            'WAREHOUSE_CLERK': 'success',
            'DRIVER': 'dark',
            'DISPATCHER': 'success',
            'VIEWER': 'secondary'
        };
        return roleMap[role] || 'secondary';
    };

    return (
        <>
            {!embedded && <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h4 className="mb-1">User Management</h4>
                    <p className="text-muted mb-0">Manage system users and their permissions</p>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/dashboard/users/new')}>
                    <i className="ti ti-plus me-2"></i>
                    Add New User
                </button>
            </div>}

            <div className="card mb-3">
                <div className="card-body py-3">
                    <div className="row g-2 align-items-center">
                        <div className="col-lg-5 col-md-12">
                            <div className="input-group">
                                <span className="input-group-text"><i className="ti ti-search"></i></span>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Search by username, name, email or company..."
                                    value={filters.search}
                                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
                                />
                                {filters.search && (
                                    <button className="btn btn-outline-secondary" type="button" onClick={() => setFilters(prev => ({ ...prev, search: '', page: 1 }))} aria-label="Clear search">
                                        <i className="ti ti-x"></i>
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="col-lg-3 col-md-6">
                            <select
                                className="form-select"
                                aria-label="Filter by role"
                                value={filters.role}
                                onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value, page: 1 }))}
                            >
                                <option value="">All roles</option>
                                {FALLBACK_BASE_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                            </select>
                        </div>
                        <div className="col-lg-4 col-md-6 d-flex justify-content-lg-end gap-2">
                            {hasActiveFilters && (
                                <button className="btn btn-link text-danger text-decoration-none" onClick={() => setFilters(prev => ({ ...prev, search: '', role: '', page: 1 }))}>
                                    <i className="ti ti-filter-off me-1"></i>Clear filters
                                </button>
                            )}
                            <button className="btn btn-outline-secondary" onClick={fetchUsers} disabled={loading}>
                                <i className={`ti ti-refresh me-1 ${loading ? 'spin' : ''}`}></i>Refresh
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header d-flex align-items-center justify-content-between">
                    <h6 className="mb-0">{hasActiveFilters ? 'Matching users' : 'All users'} <span className="badge bg-primary-subtle text-primary ms-1">{totalCount}</span></h6>
                    <div className="d-flex align-items-center gap-2 text-muted small">
                        <label htmlFor="user-page-size" className="mb-0">Rows</label>
                        <select
                            id="user-page-size"
                            className="form-select form-select-sm"
                            style={{ width: 'auto' }}
                            value={filters.page_size}
                            onChange={(e) => setFilters(prev => ({ ...prev, page_size: Number(e.target.value), page: 1 }))}
                        >
                            {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                        </select>
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
                            <p className="text-muted mt-3 mb-2">{hasActiveFilters ? 'No users match your filters' : 'No users found'}</p>
                            {hasActiveFilters && (
                                <button className="btn btn-outline-primary btn-sm" onClick={() => setFilters(prev => ({ ...prev, search: '', role: '', page: 1 }))}>Clear filters</button>
                            )}
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th>User</th>
                                        <th>Role</th>
                                        <th>Custom Role</th>
                                        <th>Company</th>
                                        <th>Access</th>
                                        <th className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((row) => (
                                        <tr key={row.id}>
                                            <td>
                                                <div className="d-flex align-items-center gap-3">
                                                    <span
                                                        className={`rounded-circle bg-${getRoleBadge(row.role)}-subtle text-${getRoleBadge(row.role)} fw-bold d-flex align-items-center justify-content-center flex-shrink-0`}
                                                        style={{ width: 38, height: 38, fontSize: '0.85rem' }}
                                                    >
                                                        {getInitials(row)}
                                                    </span>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div className="fw-semibold text-truncate">{row.full_name || row.username}</div>
                                                        <div className="small text-muted text-truncate">
                                                            {row.full_name && <span>@{row.username}</span>}
                                                            {row.full_name && row.email && ' · '}
                                                            {row.email}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`badge bg-${getRoleBadge(row.role)}`}>
                                                    {row.role_display || row.role}
                                                </span>
                                            </td>
                                            <td>{row.custom_role_detail?.name || <span className="text-muted">—</span>}</td>
                                            <td>{row.company_name || <span className="text-muted">—</span>}</td>
                                            <td>
                                                {row.role === 'ADMIN' ? (
                                                    <span className="badge bg-danger-subtle text-danger">Full access</span>
                                                ) : row.custom_role_detail ? (
                                                    <span className="badge bg-primary-subtle text-primary">
                                                        {row.custom_role_detail.permission_count ?? row.custom_role_detail.permissions?.length ?? 0} permissions
                                                    </span>
                                                ) : (
                                                    <span className="badge bg-light text-dark border">Base role only</span>
                                                )}
                                            </td>
                                            <td className="text-end text-nowrap">
                                                <div className="btn-group btn-group-sm">
                                                    <button
                                                        className="btn btn-outline-primary"
                                                        onClick={() => navigate(`/dashboard/users/${row.id}/edit`)}
                                                        title="Edit"
                                                    >
                                                        <i className="ti ti-edit me-1"></i>Edit
                                                    </button>
                                                    <button
                                                        className="btn btn-outline-danger"
                                                        onClick={() => handleDelete(row)}
                                                        title="Delete"
                                                        aria-label={`Delete ${row.username}`}
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
