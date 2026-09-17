import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usersApi } from '../../api/users';
import {
    getPagePrivileges,
    hasExplicitPagePrivileges,
    PAGE_PRIVILEGES,
} from '../../config/pagePrivileges';
import UserList from './UserList';

const ROLES = [
    { key: 'ADMIN', name: 'Administrator', description: 'Full system access, including user, role, and permission administration.', badge: 'danger' },
    { key: 'SUPERVISOR', name: 'Supervisor', description: 'Supervises production activity with explicitly assigned page access.', badge: 'warning' },
    { key: 'OPERATOR', name: 'Operator', description: 'Records and reviews operational production information.', badge: 'primary' },
    { key: 'WAREHOUSE_CLERK', name: 'Warehouse Clerk', description: 'Handles warehouse, pallet, staging, and inventory workflows.', badge: 'success' },
    { key: 'DRIVER', name: 'Driver', description: 'Uses assigned dispatch and transport workflow pages.', badge: 'dark' },
    { key: 'DISPATCHER', name: 'Dispatcher', description: 'Coordinates loading, dispatch, vehicles, and drivers.', badge: 'success' },
    { key: 'QUALITY_CONTROL', name: 'Quality Control', description: 'Reviews assigned production and quality-related pages.', badge: 'info' },
    { key: 'VIEWER', name: 'Viewer', description: 'Read-oriented account limited to explicitly assigned pages.', badge: 'secondary' },
];

const unwrapUsers = (response) => {
    const payload = response?.data?.data ?? response?.data ?? response;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
};

const UserManagement = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedTab = searchParams.get('tab');
    const activeTab = ['users', 'roles', 'permissions'].includes(requestedTab) ? requestedTab : 'users';
    const [users, setUsers] = useState([]);
    const [loadingSummary, setLoadingSummary] = useState(true);
    const [summaryError, setSummaryError] = useState('');
    const [roleFilter, setRoleFilter] = useState('');

    const loadSummary = useCallback(async () => {
        setLoadingSummary(true);
        setSummaryError('');
        try {
            const response = await usersApi.getUsers({ page_size: 1000 });
            setUsers(unwrapUsers(response));
        } catch (error) {
            console.error('Failed to load user-management summary', error);
            setSummaryError('Role and permission summaries could not be loaded.');
        } finally {
            setLoadingSummary(false);
        }
    }, []);

    useEffect(() => {
        loadSummary();
    }, [loadSummary]);

    const setActiveTab = (tab) => {
        setSearchParams(tab === 'users' ? {} : { tab });
    };

    const viewRoleMembers = (role) => {
        setRoleFilter(role);
        setActiveTab('users');
    };

    const permissionGroups = useMemo(() => PAGE_PRIVILEGES.reduce((groups, privilege) => {
        if (!groups[privilege.section]) groups[privilege.section] = [];
        groups[privilege.section].push(privilege);
        return groups;
    }, {}), []);
    const explicitUsers = useMemo(() => users.filter(hasExplicitPagePrivileges), [users]);
    const roleCount = (role) => users.filter((user) => user.role === role).length;
    const assignedCount = (privilege) => privilege.adminOnly
        ? roleCount('ADMIN')
        : explicitUsers.filter((user) => getPagePrivileges(user).includes(privilege.key)).length;

    return (
        <div className="container-fluid">
            <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
                <div>
                    <h4 className="mb-1">Access Management</h4>
                    <p className="text-muted mb-0">Manage user accounts, role membership, and page privileges.</p>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/dashboard/users/new')}>
                    <i className="ti ti-user-plus me-2"></i>Add New User
                </button>
            </div>

            <div className="card mb-4">
                <div className="card-body pb-0">
                    <ul className="nav nav-tabs border-bottom-0" role="tablist" aria-label="Access management sections">
                        <li className="nav-item" role="presentation">
                            <button className={`nav-link ${activeTab === 'users' ? 'active' : ''}`} type="button" role="tab" aria-selected={activeTab === 'users'} onClick={() => setActiveTab('users')}>
                                <i className="ti ti-users me-2"></i>Users
                            </button>
                        </li>
                        <li className="nav-item" role="presentation">
                            <button className={`nav-link ${activeTab === 'roles' ? 'active' : ''}`} type="button" role="tab" aria-selected={activeTab === 'roles'} onClick={() => setActiveTab('roles')}>
                                <i className="ti ti-user-shield me-2"></i>Roles
                            </button>
                        </li>
                        <li className="nav-item" role="presentation">
                            <button className={`nav-link ${activeTab === 'permissions' ? 'active' : ''}`} type="button" role="tab" aria-selected={activeTab === 'permissions'} onClick={() => setActiveTab('permissions')}>
                                <i className="ti ti-lock-access me-2"></i>Permissions
                            </button>
                        </li>
                    </ul>
                </div>
            </div>

            {activeTab === 'users' && (
                <div role="tabpanel" aria-label="Users">
                    {roleFilter && (
                        <div className="alert alert-light border d-flex align-items-center justify-content-between py-2">
                            <span>Showing members of <strong>{ROLES.find((role) => role.key === roleFilter)?.name || roleFilter}</strong></span>
                            <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => setRoleFilter('')}>Show all users</button>
                        </div>
                    )}
                    <UserList key={roleFilter || 'all-users'} embedded initialRole={roleFilter} />
                </div>
            )}

            {activeTab === 'roles' && (
                <div role="tabpanel" aria-label="Roles">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                        <div>
                            <h5 className="mb-1">System roles</h5>
                            <p className="text-muted mb-0">Roles identify a user's responsibility. Page access is assigned separately.</p>
                        </div>
                        <button className="btn btn-outline-secondary btn-sm" type="button" onClick={loadSummary} disabled={loadingSummary}>
                            <i className="ti ti-refresh me-1"></i>Refresh
                        </button>
                    </div>
                    {summaryError && <div className="alert alert-danger">{summaryError}</div>}
                    <div className="row g-3">
                        {ROLES.map((role) => (
                            <div className="col-xl-3 col-md-6" key={role.key}>
                                <div className="card h-100 mb-0">
                                    <div className="card-body d-flex flex-column">
                                        <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
                                            <span className={`badge bg-${role.badge}-subtle text-${role.badge}`}>{role.key}</span>
                                            <span className="fw-bold fs-5">{loadingSummary ? '—' : roleCount(role.key)}</span>
                                        </div>
                                        <h6>{role.name}</h6>
                                        <p className="text-muted small flex-grow-1">{role.description}</p>
                                        <button className="btn btn-sm btn-outline-primary" type="button" onClick={() => viewRoleMembers(role.key)}>
                                            Manage members
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'permissions' && (
                <div role="tabpanel" aria-label="Permissions">
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                        <div>
                            <h5 className="mb-0">Page permission directory</h5>
                            <small className="text-muted">Permission keys control menus and direct route access.</small>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                            <span className="badge bg-primary-subtle text-primary">{PAGE_PRIVILEGES.length} permissions</span>
                            <span className="badge bg-success-subtle text-success">{explicitUsers.length} configured users</span>
                        </div>
                    </div>
                    {summaryError && <div className="alert alert-danger">{summaryError}</div>}
                    {!loadingSummary && users.length > 0 && explicitUsers.length === 0 && (
                        <div className="alert alert-warning py-2 mb-2 small">
                            No users currently have persisted page privileges. Existing accounts are using legacy access rules.
                        </div>
                    )}
                    <div className="row g-2">
                        {Object.entries(permissionGroups).map(([section, privileges]) => (
                            <div className="col-xxl-4 col-lg-6" key={section}>
                                <div className="card h-100 mb-0">
                                    <div className="card-header d-flex align-items-center justify-content-between py-2 px-3">
                                        <h6 className="mb-0 small fw-bold">{section}</h6>
                                        <span className="badge bg-light text-dark">{privileges.length}</span>
                                    </div>
                                    <div className="card-body p-0">
                                        <div className="table-responsive" style={{ fontSize: '0.78rem' }}>
                                            <table className="table table-sm table-hover align-middle mb-0 permission-directory-table">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th className="ps-3 py-1">Page and permission key</th>
                                                        <th className="text-end pe-3 py-1" style={{ width: 64 }}>Users</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {privileges.map((privilege) => (
                                                        <tr key={privilege.key}>
                                                            <td className="ps-3 py-1">
                                                                <span className="d-block fw-medium lh-sm">{privilege.label}</span>
                                                                <code className="text-muted" style={{ fontSize: '0.68rem' }}>{privilege.key}</code>
                                                            </td>
                                                            <td className="text-end pe-3 py-1">
                                                                <span className="badge bg-light text-dark">{loadingSummary ? '—' : assignedCount(privilege)}</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="card mt-2 mb-0">
                        <div className="card-body py-2 px-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
                            <div>
                                <span className="fw-semibold me-2">Assign permissions</span>
                                <small className="text-muted">Open a user record to change its role and page privileges.</small>
                            </div>
                            <button className="btn btn-primary btn-sm" type="button" onClick={() => setActiveTab('users')}>Manage assignments</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
