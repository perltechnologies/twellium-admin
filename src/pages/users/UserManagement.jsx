import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usersApi } from '../../api/users';
import PermissionManagement from './PermissionManagement';
import RoleManagement from './RoleManagement';
import UserList from './UserList';
import { unwrapData } from './accessControlUtils';

const TABS = [
    { key: 'users', icon: 'ti-users', label: 'Users', hint: 'Accounts and their base role' },
    { key: 'roles', icon: 'ti-user-shield', label: 'Roles', hint: 'Custom permission groups' },
    { key: 'permissions', icon: 'ti-lock-access', label: 'Permissions', hint: 'API permission directory' },
];

const readCount = (response) => {
    const payload = unwrapData(response);
    if (typeof payload?.count === 'number') return payload.count;
    if (Array.isArray(payload)) return payload.length;
    if (Array.isArray(payload?.results)) return payload.results.length;
    return null;
};

const UserManagement = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedTab = searchParams.get('tab');
    const activeTab = TABS.some((tab) => tab.key === requestedTab) ? requestedTab : 'users';
    const setActiveTab = (tab) => setSearchParams(tab === 'users' ? {} : { tab });
    const [counts, setCounts] = useState({ users: null, roles: null, permissions: null });

    const loadCounts = useCallback(async () => {
        const [users, roles, permissions] = await Promise.allSettled([
            usersApi.getUsers({ page: 1, page_size: 1 }),
            usersApi.getRoles({ page: 1, page_size: 1 }),
            usersApi.getPermissions({ page: 1, page_size: 1 }),
        ]);
        const value = (result) => (result.status === 'fulfilled' ? readCount(result.value) : null);
        setCounts({ users: value(users), roles: value(roles), permissions: value(permissions) });
    }, []);

    // Refresh the tab badges whenever the user switches section (data may have changed).
    useEffect(() => { loadCounts(); }, [loadCounts, activeTab]);

    const current = TABS.find((tab) => tab.key === activeTab);

    return <div className="container-fluid">
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4 pb-3 border-bottom">
            <div>
                <h4 className="fw-bold mb-1">Access Management</h4>
                <p className="text-muted mb-0">Manage users, custom roles, and API permissions.</p>
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard/users/new')}><i className="ti ti-user-plus me-2" />Add New User</button>
        </div>

        <div className="row g-3 mb-4" role="tablist" aria-label="Access management sections">
            {TABS.map((tab) => {
                const selected = activeTab === tab.key;
                return <div className="col-md-4" key={tab.key}>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => setActiveTab(tab.key)}
                        className={`card w-100 text-start shadow-none ${selected ? 'border-primary' : 'border'}`}
                        style={{ borderWidth: selected ? 2 : 1, cursor: 'pointer', background: selected ? 'var(--bs-primary-bg-subtle, rgba(59,130,246,0.08))' : undefined }}
                    >
                        <span className="card-body p-3 d-flex align-items-center gap-3">
                            <span className={`rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 ${selected ? 'bg-primary text-white' : 'bg-light text-muted'}`} style={{ width: 42, height: 42 }}>
                                <i className={`ti ${tab.icon}`} style={{ fontSize: 20 }} />
                            </span>
                            <span className="flex-grow-1" style={{ minWidth: 0 }}>
                                <span className="d-block fw-semibold">{tab.label}</span>
                                <span className="d-block small text-muted text-truncate">{tab.hint}</span>
                            </span>
                            <span className="fw-bold fs-4">{counts[tab.key] ?? '–'}</span>
                        </span>
                    </button>
                </div>;
            })}
        </div>

        <div role="tabpanel" aria-label={current.label}>
            {activeTab === 'users' && <UserList embedded />}
            {activeTab === 'roles' && <RoleManagement />}
            {activeTab === 'permissions' && <PermissionManagement />}
        </div>
    </div>;
};

export default UserManagement;
