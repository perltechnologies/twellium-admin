import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usersApi } from '../../api/users';
import { Users, Shield, UserCog, User, Search, RefreshCw, X, Plus, Edit, Trash2 } from 'lucide-react';
import { Button, Input, Card, CardHeader, CardBody, Badge } from '../../components/ui';

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

    const StatCard = ({ title, value, icon: Icon, color }) => (
        <div className="col-xl-3 col-sm-6">
            <Card hover className="h-100">
                <CardBody>
                    <div className="d-flex align-items-start justify-content-between">
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{title}</p>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-0">
                                {loading ? <span className="animate-pulse">...</span> : value}
                            </h2>
                        </div>
                        <div className={`p-3 rounded-xl bg-${color}-100 dark:bg-${color}-900/20`}>
                            <Icon className={`h-6 w-6 text-${color}-600 dark:text-${color}-400`} />
                        </div>
                    </div>
                </CardBody>
            </Card>
        </div>
    );

    return (
        <>
            {/* Page Header */}
            <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2 animate__animated animate__fadeInDown">
                <div>
                    <h4 className="mb-1 text-slate-900 dark:text-white">User Management</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-0">Manage system users and their permissions</p>
                </div>
                <Button onClick={() => navigate('/dashboard/users/new')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add New User
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="row row-gap-3 mb-4 animate__animated animate__fadeInUp">
                <StatCard title="Total Users" value={stats.totalUsers} icon={Users} color="blue" />
                <StatCard title="Admins" value={stats.adminCount} icon={Shield} color="red" />
                <StatCard title="Managers" value={stats.managerCount} icon={UserCog} color="amber" />
                <StatCard title="Users" value={stats.userCount} icon={User} color="green" />
            </div>

            {/* Filters */}
            <Card className="mb-4 animate__animated animate__fadeInUp">
                <CardBody>
                    <div className="row g-3">
                        <div className="col-md-5">
                            <label className="form-label text-sm fw-medium">Search</label>
                            <div className="input-group">
                                <span className="input-group-text bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                    <Search className="h-4 w-4 text-slate-400" />
                                </span>
                                <input
                                    type="text"
                                    className="form-control border-slate-200 dark:border-slate-700"
                                    placeholder="Search by username, name, or email..."
                                    value={filters.search}
                                    onChange={handleSearch}
                                />
                            </div>
                        </div>
                        <div className="col-md-3">
                            <label className="form-label text-sm fw-medium">Role</label>
                            <select
                                className="form-select border-slate-200 dark:border-slate-700"
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
                            <Button variant="secondary" className="w-100" onClick={fetchUsers}>
                                <RefreshCw className={`h-4 w-4 mr-2${loading ? ' spin' : ''}`} />
                                Refresh
                            </Button>
                        </div>
                        <div className="col-md-2 d-flex align-items-end">
                            <Button variant="ghost" className="w-100 text-danger" onClick={() => setFilters({ search: '', role: '', page: 1, page_size: 15 })}>
                                <X className="h-4 w-4 mr-2" />
                                Clear
                            </Button>
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Table Card */}
            <Card className="animate__animated animate__fadeInUp">
                <CardHeader>
                    <h6 className="mb-0">All Users ({totalCount})</h6>
                </CardHeader>
                <CardBody className="p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-5">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                <User className="h-8 w-8 text-slate-400" />
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 mb-0">No users found</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead className="bg-slate-50 dark:bg-slate-800/50">
                                    <tr>
                                        <th className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">ID</th>
                                        <th className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Username</th>
                                        <th className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Full Name</th>
                                        <th className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Email</th>
                                        <th className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Role</th>
                                        <th className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Company</th>
                                        <th className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {users.map((row, idx) => (
                                        <tr key={row.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="text-slate-600 dark:text-slate-300">{row.id}</td>
                                            <td><span className="fw-medium text-slate-900 dark:text-white">{row.username}</span></td>
                                            <td className="text-slate-600 dark:text-slate-300">{row.full_name}</td>
                                            <td className="text-slate-600 dark:text-slate-300">{row.email}</td>
                                            <td>
                                                <Badge variant={
                                                    row.role?.toLowerCase() === 'admin' ? 'danger' :
                                                    row.role?.toLowerCase() === 'manager' ? 'warning' :
                                                    'success'
                                                }>
                                                    {row.role}
                                                </Badge>
                                            </td>
                                            <td className="text-slate-600 dark:text-slate-300">{row.company_name || '-'}</td>
                                            <td className="text-end">
                                                <div className="d-flex gap-2 justify-content-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        className="btn btn-sm btn-icon btn-outline-info rounded-lg"
                                                        onClick={() => navigate(`/dashboard/users/${row.id}/edit`)}
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
                            Showing <span className="font-medium text-slate-700 dark:text-slate-300">{((filters.page - 1) * filters.page_size) + 1}</span> to <span className="font-medium text-slate-700 dark:text-slate-300">{Math.min(filters.page * filters.page_size, totalCount)}</span> of <span className="font-medium text-slate-700 dark:text-slate-300">{totalCount}</span> entries
                        </p>
                        <nav>
                            <ul className="pagination mb-0 gap-1">
                                <li className={`page-item ${!paginationLinks.previous ? 'disabled' : ''}`}>
                                    <button className="page-link rounded-lg" onClick={() => handlePageChange(filters.page - 1)} disabled={!paginationLinks.previous}>
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
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
                                    <button className="page-link rounded-lg" onClick={() => handlePageChange(filters.page + 1)} disabled={!paginationLinks.next}>
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    </button>
                                </li>
                            </ul>
                        </nav>
                    </div>
                )}
            </Card>

            {/* Delete Modal */}
            {deleteModalOpen && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setDeleteModalOpen(false)}>
                    <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-content border-0 shadow-xl">
                            <div className="modal-header border-slate-200 dark:border-slate-700">
                                <h5 className="modal-title">Delete User</h5>
                                <button type="button" className="btn-close" onClick={() => setDeleteModalOpen(false)}></button>
                            </div>
                            <div className="modal-body py-4">
                                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-3">
                                    <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
                                </div>
                                <p className="text-slate-600 dark:text-slate-300 mb-0">Are you sure you want to delete this user? This action cannot be undone.</p>
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

export default UserList;
